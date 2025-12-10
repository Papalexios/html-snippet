
// FIX: Replaced deprecated GenerateContentRequest with GenerateContentParameters.
import { GoogleGenAI, Type, GenerateContentParameters, GenerateContentResponse } from "@google/genai";
import { AppState, ToolIdea, AiProvider, QuizData, Theme, OptimizationStrategy, WordPressPost, GroundingMetadata, QuizGenerationResult } from '../types';
import { AI_PROVIDERS } from "../constants";


// Helper to strip HTML tags for cleaner prompts
const stripHtml = (html: string): string => {
    if (typeof document !== 'undefined') {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        return doc.body.textContent || "";
    }
    return html.replace(/<[^>]*>/g, '');
};

// --- CENTRALIZED API CALLER ---
async function callGenericChatApi(state: AppState, prompt: string, isJson = false): Promise<string> {
    const { selectedProvider, apiKeys, openRouterModel } = state;
    const providerConfig = AI_PROVIDERS[selectedProvider];

    // --- PARANOID PRE-FLIGHT CHECK ---
    if (!apiKeys || typeof apiKeys !== 'object' || !apiKeys[selectedProvider] || typeof apiKeys[selectedProvider] !== 'string' || apiKeys[selectedProvider].trim() === '') {
        throw new Error(`API Key for ${providerConfig.name} is missing or invalid. Please configure it correctly on the main page.`);
    }

    const apiKey = apiKeys[selectedProvider];

    // --- GEMINI (uses its own SDK, now with a timeout) ---
    if (selectedProvider === AiProvider.Gemini) {
        try {
            const ai = new GoogleGenAI({ apiKey });
            const request: GenerateContentParameters = {
                model: providerConfig.defaultModel,
                contents: prompt,
            };
            if (isJson) {
                request.config = { responseMimeType: "application/json" };
            }
            
            // --- TIMEOUT IMPLEMENTATION FOR GEMINI SDK ---
            const generatePromise = ai.models.generateContent(request);
            // Increased to 90 seconds to handle large posts
            const timeoutPromise = new Promise<GenerateContentResponse>((_, reject) => 
                setTimeout(() => reject(new Error('Request timed out after 90 seconds.')), 90000)
            );

            const response = await Promise.race([generatePromise, timeoutPromise]);
            // --- END TIMEOUT IMPLEMENTATION ---
            
            return response.text || '';
        } catch (e) {
            console.error("Gemini API Error:", e);
            if (e instanceof Error && e.message.includes('timed out')) {
                throw new Error(`Request to Gemini timed out after 90 seconds. The content might be too long or the API is overloaded.`);
            }
            throw new Error(`Gemini API error: ${e instanceof Error ? e.message : 'Unknown error'}`);
        }
    }

    // --- OTHER PROVIDERS (fetch-based with timeout) ---
    let endpoint = '';
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const body: Record<string, any> = { model: providerConfig.defaultModel, messages: [{ role: 'user', content: prompt }] };

    switch (selectedProvider) {
        case AiProvider.OpenAI:
            endpoint = 'https://api.openai.com/v1/chat/completions';
            headers['Authorization'] = `Bearer ${apiKey}`;
            if (isJson) {
                body.response_format = { type: "json_object" };
            }
            break;
        case AiProvider.Anthropic:
            endpoint = 'https://api.anthropic.com/v1/messages';
            headers['x-api-key'] = apiKey;
            headers['anthropic-version'] = '2023-06-01';
            body.max_tokens = 4096; // Anthropic requires max_tokens
            // NOTE: Anthropic does not support response_format, relies on prompt for JSON.
            break;
        case AiProvider.OpenRouter:
            endpoint = 'https://openrouter.ai/api/v1/chat/completions';
            headers['Authorization'] = `Bearer ${apiKey}`;
            headers['HTTP-Referer'] = 'https://quizforge.ai'; // Recommended
            headers['X-Title'] = 'QuizForge AI'; // Recommended
            body.model = openRouterModel || providerConfig.defaultModel;
            // FIX: Many OpenRouter models do not support `response_format`. 
            // Relying on the prompt to generate JSON is more compatible and avoids freezes.
            break;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000); // 90-second "anti-freeze" timeout

    try {
        const response = await fetch(endpoint, { 
            method: 'POST', 
            headers, 
            body: JSON.stringify(body),
            signal: controller.signal 
        });
        
        clearTimeout(timeoutId); // Clear timeout if fetch responds in time

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorBody}`);
        }
        const data = await response.json();

        switch (selectedProvider) {
            case AiProvider.OpenAI:
            case AiProvider.OpenRouter:
                return data.choices[0]?.message?.content || '';
            case AiProvider.Anthropic:
                return data.content[0]?.text || '';
        }
    } catch (e) {
        clearTimeout(timeoutId); // Also clear timeout on error
        if (e instanceof Error && e.name === 'AbortError') {
            throw new Error(`Request to ${providerConfig.name} timed out after 90 seconds. The API may be overloaded, or the selected model is unresponsive.`);
        }
        console.error(`${providerConfig.name} API Error:`, e);
        throw new Error(`${providerConfig.name} request failed: ${e instanceof Error ? e.message : 'A network error occurred'}`);
    }
    return '';
}


// --- API KEY VALIDATION ---
export async function validateApiKey(provider: AiProvider, apiKey: string, openRouterModel: string): Promise<boolean> {
    if (!apiKey) return false;
    const testState: AppState = { ...({} as AppState), selectedProvider: provider, apiKeys: { [provider]: apiKey } as any, openRouterModel };
    try {
        const response = await callGenericChatApi(testState, "Hello!");
        return response.length > 0;
    } catch (error) {
        console.error(`Validation failed for ${provider}:`, error);
        return false;
    }
}


// --- IDEA GENERATION ---
const getIdeaPrompt = (postTitle: string, postContent: string): string => {
    const cleanContent = stripHtml(postContent).substring(0, 8000);
    return `
    **Persona:** You are an AEO (Answer Engine Optimization) Strategist and Engagement Expert.
    
    **Analysis Task:** Analyze this content:
    *   **Title:** "${postTitle}"
    *   **Content:** "${cleanContent}"

    **Mission:** Generate 3 quiz ideas that increase "Dwell Time" and signal "Topical Authority" to search engines.
    
    **Archetypes:**
    1.  **The Authority Check:** "How much do you actually know about [Topic]?" (Tests depth).
    2.  **The Personal Audit:** "Is your [Topic] strategy ready?" (Tests application).
    3.  **The Myth Buster:** "Fact vs Fiction: [Topic]" (Corrects misconceptions - highly viral).

    **Output (JSON Only):**
    { "ideas": [{ "title": "...", "description": "...", "icon": "list|chart|idea" }] }
    `;
};


export async function suggestToolIdeas(state: AppState, postTitle: string, postContent: string): Promise<ToolIdea[]> {
    const prompt = getIdeaPrompt(postTitle, postContent);
    let responseText = '';

    try {
        responseText = await callGenericChatApi(state, prompt, true);

        const firstBrace = responseText.indexOf('{');
        const lastBrace = responseText.lastIndexOf('}');

        if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
             throw new Error("AI response did not contain a valid JSON object.");
        }
        
        let jsonString = responseText.substring(firstBrace, lastBrace + 1);
        const result = JSON.parse(jsonString);
        
        const ideasArray = result.ideas || [];

        if (Array.isArray(ideasArray) && ideasArray.length > 0) {
            return ideasArray.filter(item =>
                typeof item === 'object' && item !== null &&
                'title' in item && 'description' in item && 'icon' in item
            ).slice(0, 3);
        }
        
        throw new Error("AI did not return valid tool ideas.");
    } catch (error) {
        console.error("AI API error in suggestToolIdeas:", error);
         if (error instanceof SyntaxError) {
             throw new Error(`Failed to parse AI response. Response snippet: ${responseText.substring(0, 150)}...`);
        }
        throw error;
    }
}

// --- UTILITY FUNCTION for HTML Generation ---
function hexToHsl(hex: string): { h: number, s: number, l: number } | null {
    if (!hex || typeof hex !== 'string') return null;
    let r = 0, g = 0, b = 0;
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if(result){
        r = parseInt(result[1], 16);
        g = parseInt(result[2], 16);
        b = parseInt(result[3], 16);
    } else {
        const shorthandResult = /^#?([a-f\d])([a-f\d])([a-f\d])$/i.exec(hex);
        if(shorthandResult){
            r = parseInt(shorthandResult[1] + shorthandResult[1], 16);
            g = parseInt(shorthandResult[2] + shorthandResult[2], 16);
            b = parseInt(shorthandResult[3] + shorthandResult[3], 16);
        } else {
            return null;
        }
    }
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

// --- Dynamic prompt for Quiz JSON Generation ---
const getQuizJsonPrompt = (postTitle: string, postContent: string, idea: ToolIdea, strategy: OptimizationStrategy, allPosts: WordPressPost[]): string => {
    const cleanContent = stripHtml(postContent).substring(0, 12000);
    const otherPosts = allPosts.map(p => ({ title: p.title.rendered, link: p.link })).slice(0, 50);

    let strategyInstructions = '';
    switch (strategy) {
        case 'fact_check':
            strategyInstructions = "USE TOOLS: You MUST use Google Search to verify every fact. If the blog post contains outdated data, use the search tool to find the 2024/2025 data and use that in the explanation, citing the source.";
            break;
        case 'geo':
            strategyInstructions = "USE TOOLS: You MUST use Google Maps to ensure any location-based questions are geographically accurate. The content implies local intent; ensure the quiz reflects the specific region mentioned.";
            break;
    }

    return `
    **Role:** AEO (Answer Engine Optimization) Specialist & Senior Data Analyst.
    **Goal:** Create a JSON quiz optimized for **Entity Salience** and **Semantic Search**.
    **Philosophy:** Search engines and AI agents prioritize content that clearly identifies and defines entities (People, Places, Organizations, Concepts). Your quiz must reinforce these entities to build Topical Authority.

    **Inputs:**
    *   Title: "${postTitle}"
    *   Concept: "${idea.title}"
    *   Content: "${cleanContent}"

    **Instructions:**
    1.  ${strategyInstructions}
    2.  **Entity Salience:** Identify the primary entities (people, places, concepts) in the text. Ensure these entities are explicitly named in the questions and explanations to boost Knowledge Graph confidence.
    3.  **Entity-Rich Explanations:** The 'explanation' field is critical for AEO. It must be 2-3 sentences long. It MUST explicitly name the key entities discussed to strengthen the semantic graph.
    4.  **Structure:** Generate 5 high-value questions. Avoid generic questions; test specific knowledge related to the entities in the text.
    5.  **Result Summaries:** Write encouraging summaries that include a call-to-action (e.g., "Share your score to challenge a friend").

    **Output JSON:**
    {
      "quizSchema": { "@context": "https://schema.org", "@type": "Quiz", ... },
      "faqSchema": { "@context": "https://schema.org", "@type": "FAQPage", ... },
      "content": {
        "questions": [{ "question": "...", "options": [{ "text": "...", "isCorrect": true }], "explanation": "..." }],
        "results": [{ "minScore": 0, "title": "...", "summary": "..." }]
      }
    }
    
    IMPORTANT: Return ONLY the JSON object. Do not wrap it in markdown code blocks like \`\`\`json.
    `;
};

// --- Function to call AI for JSON data ---
export async function generateQuizAndMetadata(state: AppState, postTitle: string, postContent: string, idea: ToolIdea, strategy: OptimizationStrategy, allPosts: WordPressPost[]): Promise<QuizGenerationResult> {
    const prompt = getQuizJsonPrompt(postTitle, postContent, idea, strategy, allPosts);
    let responseText = '';

    try {
        if (state.selectedProvider === AiProvider.Gemini && (strategy === 'fact_check' || strategy === 'geo')) {
            const ai = new GoogleGenAI({ apiKey: state.apiKeys.gemini });
            const request: GenerateContentParameters = {
                model: AI_PROVIDERS.gemini.defaultModel,
                contents: prompt,
                config: { },
            };
            
            if (strategy === 'fact_check') {
                request.config.tools = [{ googleSearch: {} }];
            } else if (strategy === 'geo') {
                request.config.tools = [{ googleMaps: {} }];
                try {
                    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
                    });
                    request.config.toolConfig = {
                        retrievalConfig: {
                            latLng: {
                                latitude: position.coords.latitude,
                                longitude: position.coords.longitude
                            }
                        }
                    }
                } catch (geoError) {
                    console.warn("Could not get geolocation for GEO strategy:", geoError);
                }
            }

            const generatePromise = ai.models.generateContent(request);
            // Increased to 90 seconds
            const timeoutPromise = new Promise<GenerateContentResponse>((_, reject) => 
                setTimeout(() => reject(new Error('Request timed out after 90 seconds.')), 90000)
            );
            const response = await Promise.race([generatePromise, timeoutPromise]);

            responseText = response.text || '';
            const groundingMetadata: GroundingMetadata | null = response.candidates?.[0]?.groundingMetadata ?? null;
            const parsedJson = JSON.parse(responseText.substring(responseText.indexOf('{'), responseText.lastIndexOf('}') + 1)) as QuizData;
            return { quizData: parsedJson, groundingMetadata };
        } else {
            responseText = await callGenericChatApi(state, prompt, true);
            const parsedJson = JSON.parse(responseText.substring(responseText.indexOf('{'), responseText.lastIndexOf('}') + 1)) as QuizData;
            return { quizData: parsedJson, groundingMetadata: null };
        }
    } catch (error) {
        console.error("AI API error in generateQuizAndMetadata:", error);
        if (error instanceof Error && error.message.includes('timed out')) {
            throw new Error(`Request to Gemini timed out. Please try again.`);
        }
        if (error instanceof SyntaxError) {
            throw new Error(`Failed to parse AI response as JSON. Response snippet: ${responseText.substring(0, 150)}...`);
        }
        throw error;
    }
}

// --- AEO-OPTIMIZED CONTENT UPDATE ---
const getContentUpdatePrompt = (postTitle: string, quizTitle: string): string => {
    return `
    **Role:** AEO (Answer Engine Optimization) Copywriter & Featured Snippet Specialist.
    **Goal:** Create a content block designed to capture "Position Zero" (Featured Snippets) in Google Search.
    
    **Task:**
    1.  **Introduction:** A brief, engaging hook (max 2 sentences) that invites the user to test their knowledge.
    2.  **Featured Snippet Candidate:** Create a semantic HTML block specifically designed to rank in Google's "Position Zero".
        -   Title: <h3>Key Takeaways</h3>
        -   Format: An unordered list (<ul>).
        -   Content: 3-4 concise, high-value facts derived from the content.
        -   **Optimization:** Bold (<strong>) the most important entity in each bullet point. This signals relevance to search algorithms.
    
    **Output JSON:**
    {
      "introduction": "HTML string (e.g. <p class='qf-intro'>...</p>)",
      "conclusion": "HTML string (e.g. <div class='qf-snippet-candidate'><h3>Key Takeaways</h3><ul><li>...</li></ul></div>)"
    }
    
    IMPORTANT: Return ONLY the JSON object. Do not wrap it in markdown code blocks like \`\`\`json.
    `;
};

export async function generateContentUpdate(state: AppState, postTitle: string, quizTitle: string): Promise<string> {
    const prompt = getContentUpdatePrompt(postTitle, quizTitle);
    let responseText = '';
    try {
        responseText = await callGenericChatApi(state, prompt, true);
        const firstBrace = responseText.indexOf('{');
        const lastBrace = responseText.lastIndexOf('}');
        if (firstBrace === -1 || lastBrace === -1) throw new Error("Invalid JSON response.");
        
        const jsonString = responseText.substring(firstBrace, lastBrace + 1);
        const parsed = JSON.parse(jsonString);

        // We format it as raw HTML for the user to copy.
        return `<!-- QUIZ INTRO (Insert Before Quiz) -->
${parsed.introduction}

<!-- FEATURED SNIPPET CANDIDATE (Insert After Quiz or at End of Post) -->
${parsed.conclusion}`;

    } catch (error) {
        console.error("Failed to generate content update:", error);
        throw error;
    }
}


// --- SOTA QUIZ GENERATOR ---
export function createQuizSnippet(quizResult: QuizGenerationResult, themeColor: string, theme: Theme): string {
    const { quizData, groundingMetadata } = quizResult;
    const { quizSchema, faqSchema, content } = quizData;
    const themeHsl = hexToHsl(themeColor) || { h: 221, s: 83, l: 53 }; // Default Blue
    const uniqueId = `qf-${Math.random().toString(36).substring(2, 9)}`;

    const escapeHtml = (unsafe: string) => unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    
    // --- SCHEMA.ORG INJECTION ---
    const schemaScripts = [
        `<script type="application/ld+json">${JSON.stringify(quizSchema, null, 2)}</script>`
    ];
    if (faqSchema) {
        schemaScripts.push(`<script type="application/ld+json">${JSON.stringify(faqSchema, null, 2)}</script>`);
    }

    let sourcesHtml = '';
    if (groundingMetadata && groundingMetadata.groundingChunks && groundingMetadata.groundingChunks.length > 0) {
        const validChunks = groundingMetadata.groundingChunks.filter(c => (c.web?.uri && c.web.title) || (c.maps?.uri && c.maps.title));
        if (validChunks.length > 0) {
            sourcesHtml = `
            <div class="qf-sources">
                <span class="qf-sources-label">Verified Sources:</span>
                <ul class="qf-sources-list">
                    ${validChunks.map(chunk => {
                        const source = chunk.web || chunk.maps;
                        return `<li><a href="${escapeHtml(source!.uri!)}" target="_blank" rel="nofollow noopener">${escapeHtml(source!.title!)}</a></li>`;
                    }).join('')}
                </ul>
            </div>`;
        }
    }

    // --- SOTA GLASSMORPHISM UI ---
    return `
${schemaScripts.join('\n')}
<div id="${uniqueId}" class="qf-root ${theme}" data-tool-id="%%TOOL_ID%%">
<style>
#${uniqueId} {
  --hue: ${themeHsl.h}; --sat: ${themeHsl.s}%; --light: ${themeHsl.l}%;
  --primary: hsl(var(--hue), var(--sat), var(--light));
  --surface-light: rgba(255, 255, 255, 0.6);
  --surface-dark: rgba(30, 41, 59, 0.6);
  --glass-border-light: rgba(255, 255, 255, 0.5);
  --glass-border-dark: rgba(255, 255, 255, 0.1);
  --text-light: #0f172a; --text-dark: #f8fafc;
  --success: #10b981; --error: #ef4444;
  --radius: 24px;
  --shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.1);
  font-family: system-ui, -apple-system, sans-serif;
  width: 100%; max-width: 720px; margin: 40px auto;
}
#${uniqueId} * { box-sizing: border-box; margin: 0; padding: 0; }

/* Glass Card */
#${uniqueId} .qf-card {
  background: var(--surface-light);
  backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border-light);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  color: var(--text-light);
  overflow: hidden; position: relative;
  transition: all 0.3s ease;
}
#${uniqueId}.dark .qf-card {
  background: var(--surface-dark);
  border-color: var(--glass-border-dark);
  color: var(--text-dark);
}

/* Header */
#${uniqueId} .qf-header {
  padding: 32px 40px; text-align: center;
  background: linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 100%);
  border-bottom: 1px solid rgba(0,0,0,0.05);
}
#${uniqueId}.dark .qf-header { border-bottom-color: rgba(255,255,255,0.05); }
#${uniqueId} .qf-title { 
  font-size: 1.75rem; font-weight: 800; margin-bottom: 12px; letter-spacing: -0.02em;
  background: linear-gradient(135deg, var(--primary), hsl(var(--hue), var(--sat), 40%));
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
}
#${uniqueId}.dark .qf-title {
  background: linear-gradient(135deg, hsl(var(--hue), var(--sat), 70%), white);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
}
#${uniqueId} .qf-desc { font-size: 1.05rem; opacity: 0.85; line-height: 1.6; }

/* Progress */
#${uniqueId} .qf-progress { height: 4px; background: rgba(0,0,0,0.05); width: 100%; }
#${uniqueId}.dark .qf-progress { background: rgba(255,255,255,0.1); }
#${uniqueId} .qf-bar { height: 100%; background: var(--primary); width: 0%; transition: width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1); box-shadow: 0 0 10px var(--primary); }

/* Body */
#${uniqueId} .qf-body { padding: 40px; }
#${uniqueId} .qf-question { font-size: 1.35rem; font-weight: 700; margin-bottom: 28px; line-height: 1.4; }

/* Options */
#${uniqueId} .qf-options { display: flex; flex-direction: column; gap: 14px; }
#${uniqueId} .qf-opt {
  position: relative;
  display: flex; align-items: center; padding: 18px 24px;
  border: 1px solid rgba(0,0,0,0.1); border-radius: 16px;
  background: rgba(255,255,255,0.5);
  cursor: pointer; transition: all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  font-weight: 600; font-size: 1rem; color: inherit; width: 100%; text-align: left;
}
#${uniqueId}.dark .qf-opt { border-color: rgba(255,255,255,0.15); background: rgba(255,255,255,0.03); }
#${uniqueId} .qf-opt:hover:not(:disabled) { 
  border-color: var(--primary); transform: translateY(-2px) scale(1.01); 
  box-shadow: 0 4px 12px rgba(0,0,0,0.05); background: rgba(255,255,255,0.8);
}
#${uniqueId}.dark .qf-opt:hover:not(:disabled) { background: rgba(255,255,255,0.08); }
#${uniqueId} .qf-opt:disabled { cursor: default; opacity: 0.6; transform: none !important; }

#${uniqueId} .qf-opt.correct { 
  border-color: var(--success); background: rgba(16, 185, 129, 0.15); color: #065f46;
}
#${uniqueId}.dark .qf-opt.correct { background: rgba(16, 185, 129, 0.2); color: #6ee7b7; }
#${uniqueId} .qf-opt.wrong { 
  border-color: var(--error); background: rgba(239, 68, 68, 0.15); color: #991b1b;
}
#${uniqueId}.dark .qf-opt.wrong { background: rgba(239, 68, 68, 0.2); color: #fca5a5; }

/* Explanation */
#${uniqueId} .qf-expl {
  margin-top: 28px; padding: 24px; border-radius: 16px;
  background: rgba(255,255,255,0.5); border: 1px solid var(--primary);
  animation: qf-fade-up 0.5s cubic-bezier(0.16, 1, 0.3, 1); display: none;
}
#${uniqueId}.dark .qf-expl { background: rgba(0,0,0,0.2); }
#${uniqueId} .qf-expl.visible { display: block; }
#${uniqueId} .qf-expl h4 { 
  font-size: 0.85rem; text-transform: uppercase; color: var(--primary); 
  margin-bottom: 8px; letter-spacing: 0.08em; font-weight: 800;
}
#${uniqueId} .qf-expl a { color: var(--primary); text-decoration: none; border-bottom: 1px solid; }

/* Buttons */
#${uniqueId} .qf-btn {
  background: var(--primary); color: white; border: none; padding: 16px 32px;
  font-size: 1rem; font-weight: 700; border-radius: 50px; cursor: pointer;
  transition: all 0.3s ease; margin: 8px; display: inline-flex; align-items: center; gap: 8px;
  box-shadow: 0 4px 14px rgba(0,0,0,0.2);
}
#${uniqueId} .qf-btn:hover { transform: translateY(-3px); box-shadow: 0 6px 20px rgba(0,0,0,0.25); filter: brightness(1.1); }
#${uniqueId} .qf-btn.outline { 
  background: transparent; border: 2px solid var(--glass-border-light); color: var(--text-light); box-shadow: none;
}
#${uniqueId}.dark .qf-btn.outline { border-color: var(--glass-border-dark); color: var(--text-dark); }
#${uniqueId} .qf-btn.outline:hover { border-color: var(--primary); color: var(--primary); background: rgba(0,0,0,0.05); }

/* Results */
#${uniqueId} .qf-results { text-align: center; padding: 60px 20px; display: none; }
#${uniqueId} .qf-score-circle {
  width: 140px; height: 140px; margin: 0 auto 32px;
  border-radius: 50%; display: flex; flex-direction: column; justify-content: center;
  background: conic-gradient(var(--primary) calc(var(--score) * 1%), transparent 0);
  position: relative;
}
#${uniqueId} .qf-score-circle::before {
  content: ""; position: absolute; inset: 10px; background: var(--surface-light); border-radius: 50%;
}
#${uniqueId}.dark .qf-score-circle::before { background: #1e293b; } /* Match dark card bg roughly */
#${uniqueId} .qf-score-inner { position: relative; z-index: 2; display: flex; flex-direction: column; align-items: center; }
#${uniqueId} .qf-score-val { font-size: 3rem; font-weight: 900; line-height: 1; }
#${uniqueId} .qf-score-label { font-size: 0.9rem; opacity: 0.7; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 4px; }

/* Verified Sources */
#${uniqueId} .qf-sources { 
  margin-top: 32px; font-size: 0.85rem; text-align: left; 
  border-top: 1px dashed rgba(0,0,0,0.1); padding-top: 16px; opacity: 0.8; 
}
#${uniqueId}.dark .qf-sources { border-top-color: rgba(255,255,255,0.1); }
#${uniqueId} .qf-sources-label { font-weight: 700; margin-right: 6px; color: var(--success); }
#${uniqueId} .qf-sources-list { display: inline; list-style: none; }
#${uniqueId} .qf-sources-list li { display: inline; }
#${uniqueId} .qf-sources-list li:not(:last-child):after { content: "/"; margin: 0 8px; opacity: 0.4; }
#${uniqueId} .qf-sources a { color: inherit; text-decoration: none; border-bottom: 1px solid var(--success); transition: color 0.2s; }
#${uniqueId} .qf-sources a:hover { color: var(--success); }

@keyframes qf-fade-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
@keyframes qf-shake { 
  0%, 100% { transform: translateX(0); } 
  20% { transform: translateX(-6px); } 
  40% { transform: translateX(6px); } 
  60% { transform: translateX(-3px); } 
  80% { transform: translateX(3px); } 
}
.qf-shake { animation: qf-shake 0.4s ease; }
</style>

<div class="qf-card">
    <div class="qf-progress"><div id="${uniqueId}-bar" class="qf-bar"></div></div>
    
    <!-- Intro View -->
    <div id="${uniqueId}-intro" class="qf-header">
        <h2 class="qf-title">${escapeHtml(quizSchema.name)}</h2>
        <p class="qf-desc">${escapeHtml(quizSchema.description)}</p>
        <div style="margin-top: 32px;">
            <button onclick="window.qf_${uniqueId}.start()" class="qf-btn">Start Challenge</button>
        </div>
    </div>

    <!-- Quiz View -->
    <div id="${uniqueId}-quiz" class="qf-body" style="display:none;">
        <div id="${uniqueId}-q-text" class="qf-question"></div>
        <div id="${uniqueId}-opts" class="qf-options"></div>
        <div id="${uniqueId}-expl" class="qf-expl"></div>
        <div style="margin-top: 32px; text-align: right;">
            <button id="${uniqueId}-next" onclick="window.qf_${uniqueId}.next()" class="qf-btn" style="display:none;">Next Question →</button>
        </div>
        ${sourcesHtml}
    </div>

    <!-- Results View -->
    <div id="${uniqueId}-res" class="qf-results">
        <div id="${uniqueId}-score-circle" class="qf-score-circle" style="--score: 0;">
            <div class="qf-score-inner">
                <span id="${uniqueId}-score" class="qf-score-val">0%</span>
                <span class="qf-score-label">Score</span>
            </div>
        </div>
        <h3 id="${uniqueId}-res-title" class="qf-title" style="font-size: 1.5rem;"></h3>
        <p id="${uniqueId}-res-desc" class="qf-desc" style="margin-bottom: 32px; max-width: 500px; margin-left: auto; margin-right: auto;"></p>
        
        <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 10px;">
            <button onclick="window.qf_${uniqueId}.share()" class="qf-btn">
                <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/></svg>
                Share Result
            </button>
            <button onclick="window.qf_${uniqueId}.restart()" class="qf-btn outline">Retake Quiz</button>
        </div>
    </div>
</div>

<script>
window.qf_${uniqueId} = (function() {
    const data = ${JSON.stringify(content)};
    const el = (id) => document.getElementById('${uniqueId}-' + id);
    let idx = 0, score = 0;

    // Professional Grade Confetti (Lightweight)
    const fireConfetti = () => {
        const colors = ['${themeColor}', '#10b981', '#f59e0b', '#3b82f6'];
        const particleCount = 100;
        for(let i=0; i<particleCount; i++) {
            const p = document.createElement('div');
            p.style.position = 'fixed';
            p.style.left = '50%'; p.style.top = '50%';
            p.style.width = (Math.random()*8+4)+'px'; p.style.height = (Math.random()*8+4)+'px';
            p.style.background = colors[Math.floor(Math.random()*colors.length)];
            p.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
            p.style.zIndex = '10000';
            p.style.pointerEvents = 'none';
            document.body.appendChild(p);
            
            const angle = Math.random() * Math.PI * 2;
            const vel = Math.random() * 15 + 5;
            let dx = Math.cos(angle) * vel;
            let dy = Math.sin(angle) * vel;
            let x = window.innerWidth/2, y = window.innerHeight/2;
            let grav = 0.5;
            let op = 1;

            const anim = requestAnimationFrame(function update() {
                x += dx; y += dy; dy += grav; op -= 0.015;
                p.style.transform = \`translate(\${x - window.innerWidth/2}px, \${y - window.innerHeight/2}px) rotate(\${x*2}deg)\`;
                p.style.opacity = op;
                if(op > 0) requestAnimationFrame(update);
                else p.remove();
            });
        }
    };

    return {
        start: () => {
            el('intro').style.display = 'none';
            el('quiz').style.display = 'block';
            idx = 0; score = 0;
            window.qf_${uniqueId}.render();
        },
        render: () => {
            const q = data.questions[idx];
            el('q-text').innerHTML = q.question;
            el('bar').style.width = ((idx) / data.questions.length * 100) + '%';
            el('expl').className = 'qf-expl';
            el('expl').innerHTML = '';
            el('next').style.display = 'none';
            
            let html = '';
            q.options.forEach((o, i) => {
                html += \`<button class="qf-opt" onclick="window.qf_${uniqueId}.check(\${i}, this)">\${o.text}</button>\`;
            });
            el('opts').innerHTML = html;
        },
        check: (optIdx, btn) => {
            const q = data.questions[idx];
            const isCorrect = q.options[optIdx].isCorrect;
            const btns = el('opts').children;
            
            for(let b of btns) b.disabled = true;

            if(isCorrect) {
                score++;
                btn.classList.add('correct');
            } else {
                btn.classList.add('wrong');
                btn.classList.add('qf-shake');
                for(let i=0; i<btns.length; i++) if(q.options[i].isCorrect) btns[i].classList.add('correct');
            }

            el('expl').innerHTML = '<h4>' + (isCorrect ? 'Correct!' : 'Explanation') + '</h4>' + q.explanation;
            el('expl').classList.add('visible');
            
            const nextBtn = el('next');
            if(idx < data.questions.length - 1) {
                nextBtn.innerText = 'Next Question →';
            } else {
                nextBtn.innerText = 'See Results';
            }
            nextBtn.style.display = 'inline-flex';
        },
        next: () => {
            idx++;
            if(idx < data.questions.length) window.qf_${uniqueId}.render();
            else window.qf_${uniqueId}.finish();
        },
        finish: () => {
            el('quiz').style.display = 'none';
            el('res').style.display = 'block';
            el('bar').style.width = '100%';
            
            const pct = Math.round(score / data.questions.length * 100);
            el('score').innerText = pct + '%';
            el('score-circle').style.setProperty('--score', pct);
            
            const r = data.results.slice().reverse().find(r => score >= r.minScore) || data.results[0];
            el('res-title').innerText = r.title;
            el('res-desc').innerText = r.summary;

            if(pct >= 80) fireConfetti();
            
            // Analytics
            const toolId = document.getElementById('${uniqueId}').dataset.toolId;
            if(toolId && toolId !== '%%TOOL_ID%%') {
                 fetch('/wp-json/quizforge/v1/submit', {
                    method: 'POST', headers: {'Content-Type':'application/json'},
                    body: JSON.stringify({ toolId: parseInt(toolId), resultTitle: r.title, score: score, totalQuestions: data.questions.length })
                 }).catch(e=>console.error(e));
            }
        },
        restart: () => {
            el('res').style.display = 'none';
            window.qf_${uniqueId}.start();
        },
        share: () => {
            const text = \`I scored \${el('score').innerText} on this quiz: \${document.title}!\`;
            if (navigator.share) {
                navigator.share({ title: document.title, text: text, url: window.location.href }).catch(console.error);
            } else {
                const url = \`https://twitter.com/intent/tweet?text=\${encodeURIComponent(text)}&url=\${encodeURIComponent(window.location.href)}\`;
                window.open(url, '_blank');
            }
        }
    };
})();
</script>
</div>
`;
}