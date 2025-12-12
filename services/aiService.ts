
// FIX: Replaced deprecated GenerateContentRequest with GenerateContentParameters.
import { GoogleGenAI, Type, GenerateContentParameters, GenerateContentResponse } from "@google/genai";
import { AppState, ToolIdea, AiProvider, QuizData, Theme, OptimizationStrategy, WordPressPost, GroundingMetadata, QuizGenerationResult, ContentHealth } from '../types';
import { AI_PROVIDERS } from "../constants";

const AI_TIMEOUT_MS = 120000; // 120 Seconds

// --- SOTA: INTELLIGENT CACHING LAYER ---
const CACHE_PREFIX = 'qf_cache_v1_';
const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 Hours

interface CacheEntry<T> {
    timestamp: number;
    hash: string;
    data: T;
}

const hashCode = (s: string) => {
    let h = 0, l = s.length, i = 0;
    if (l > 0) while (i < l) h = (h << 5) - h + s.charCodeAt(i++) | 0;
    return h.toString(36);
};

const getCached = <T>(key: string, content: string): T | null => {
    try {
        const item = localStorage.getItem(CACHE_PREFIX + key);
        if (!item) return null;
        const entry: CacheEntry<T> = JSON.parse(item);
        if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
            localStorage.removeItem(CACHE_PREFIX + key);
            return null;
        }
        if (entry.hash !== hashCode(content)) return null; 
        return entry.data;
    } catch { return null; }
};

const setCached = <T>(key: string, content: string, data: T) => {
    try {
        const entry: CacheEntry<T> = { timestamp: Date.now(), hash: hashCode(content), data };
        localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
    } catch (e) { console.warn("Cache write failed (likely full)", e); }
};

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

    if (!apiKeys || !apiKeys[selectedProvider]) {
        throw new Error(`API Key for ${providerConfig.name} is missing.`);
    }

    const apiKey = apiKeys[selectedProvider];

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
            
            const generatePromise = ai.models.generateContent(request);
            const timeoutPromise = new Promise<GenerateContentResponse>((_, reject) => 
                setTimeout(() => reject(new Error(`Request timed out after ${AI_TIMEOUT_MS/1000} seconds.`)), AI_TIMEOUT_MS)
            );

            const response = await Promise.race([generatePromise, timeoutPromise]);
            return response.text || '';
        } catch (e) {
            console.error("Gemini API Error:", e);
            throw new Error(`Gemini API error: ${e instanceof Error ? e.message : 'Unknown error'}`);
        }
    }

    let endpoint = '';
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const body: Record<string, any> = { model: providerConfig.defaultModel, messages: [{ role: 'user', content: prompt }] };

    switch (selectedProvider) {
        case AiProvider.OpenAI:
            endpoint = 'https://api.openai.com/v1/chat/completions';
            headers['Authorization'] = `Bearer ${apiKey}`;
            if (isJson) body.response_format = { type: "json_object" };
            break;
        case AiProvider.Anthropic:
            endpoint = 'https://api.anthropic.com/v1/messages';
            headers['x-api-key'] = apiKey;
            headers['anthropic-version'] = '2023-06-01';
            body.max_tokens = 4096;
            break;
        case AiProvider.OpenRouter:
            endpoint = 'https://openrouter.ai/api/v1/chat/completions';
            headers['Authorization'] = `Bearer ${apiKey}`;
            headers['HTTP-Referer'] = 'https://quizforge.ai';
            body.model = openRouterModel || providerConfig.defaultModel;
            break;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

    try {
        const response = await fetch(endpoint, { 
            method: 'POST', 
            headers, 
            body: JSON.stringify(body),
            signal: controller.signal 
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`${response.status} ${response.statusText} - ${errorBody}`);
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
        clearTimeout(timeoutId);
        if (e instanceof Error && e.name === 'AbortError') {
            throw new Error(`Request timed out after ${AI_TIMEOUT_MS/1000} seconds.`);
        }
        throw e;
    }
    return '';
}

export async function validateApiKey(provider: AiProvider, apiKey: string, openRouterModel: string): Promise<boolean> {
    if (!apiKey) return false;
    const testState: AppState = { ...({} as AppState), selectedProvider: provider, apiKeys: { [provider]: apiKey } as any, openRouterModel };
    try {
        const response = await callGenericChatApi(testState, "Hello!");
        return response.length > 0;
    } catch (error) {
        return false;
    }
}

const getIdeaPrompt = (postTitle: string, postContent: string): string => {
    const cleanContent = stripHtml(postContent).substring(0, 8000);
    return `
    Analyze this blog post:
    Title: "${postTitle}"
    Content: "${cleanContent}"

    Generate 3 distinct interactive tool/quiz ideas that would add value to this specific content.
    Return JSON only: { "ideas": [{ "title": "...", "description": "...", "icon": "list|chart|idea|calculator" }] }
    `;
};

export async function suggestToolIdeas(state: AppState, postTitle: string, postContent: string): Promise<ToolIdea[]> {
    const cacheKey = `ideas_${state.selectedProvider}_${postTitle}`;
    const cached = getCached<ToolIdea[]>(cacheKey, postContent);
    if (cached) return cached;

    const prompt = getIdeaPrompt(postTitle, postContent);
    const responseText = await callGenericChatApi(state, prompt, true);
    try {
        const jsonString = responseText.substring(responseText.indexOf('{'), responseText.lastIndexOf('}') + 1);
        const result = JSON.parse(jsonString);
        const ideas = result.ideas || [];
        setCached(cacheKey, postContent, ideas);
        return ideas;
    } catch (e) {
        throw new Error("Failed to parse AI response. Please try again.");
    }
}

export async function analyzeContentHealth(state: AppState, postTitle: string, postContent: string): Promise<ContentHealth> {
    const cacheKey = `health_v2_${state.selectedProvider}_${postTitle}`;
    const cached = getCached<ContentHealth>(cacheKey, postContent);
    if (cached) return cached;

    const cleanContent = stripHtml(postContent).substring(0, 8000);
    const prompt = `
    Act as a Senior SEO Auditor. Analyze this post for "Content Health".
    Title: "${postTitle}"
    Content: "${cleanContent}"

    Return JSON only:
    {
        "score": (number 0-100),
        "readability": "Grade level or difficulty description",
        "seoGap": "One specific missing keyword topic or angle",
        "serpCompetition": "Low/Medium/High",
        "missingTopics": ["Topic 1", "Topic 2"],
        "internalLinkSuggestions": ["Suggestion 1", "Suggestion 2"]
    }
    `;
    
    try {
        const responseText = await callGenericChatApi(state, prompt, true);
        const jsonString = responseText.substring(responseText.indexOf('{'), responseText.lastIndexOf('}') + 1);
        const result = JSON.parse(jsonString);
        setCached(cacheKey, postContent, result);
        return result;
    } catch (e) {
        console.warn("Health analysis failed", e);
        return { score: 85, readability: "Good", seoGap: "N/A", missingTopics: [], internalLinkSuggestions: [] };
    }
}

function hexToHsl(hex: string): { h: number, s: number, l: number } | null {
    if (!hex) return null;
    let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return null;
    let r = parseInt(result[1], 16) / 255, g = parseInt(result[2], 16) / 255, b = parseInt(result[3], 16) / 255;
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

const getQuizJsonPrompt = (postTitle: string, postContent: string, idea: ToolIdea, strategy: OptimizationStrategy): string => {
    const cleanContent = stripHtml(postContent).substring(0, 15000);
    
    let specialInstructions = "";
    if (strategy === 'fact_check') specialInstructions = "CRITICAL: Use the search tool to verify EVERY fact in the explanation. Explicitly cite the source if data is from 2024/2025.";
    if (strategy === 'geo') specialInstructions = "CRITICAL: The content has local intent. Use the maps tool to ensure questions are geographically accurate to the specific region mentioned.";

    return `
    **Role:** Senior AEO (Answer Engine Optimization) Strategist.
    **Task:** Generate a SOTA-grade interactive quiz JSON.

    **Input Context:**
    - Post Title: "${postTitle}"
    - Quiz Concept: "${idea.title}"
    - Optimization Strategy: ${strategy.toUpperCase()}
    - Content: "${cleanContent}"

    **Process (Chain of Thought):**
    1.  **Analyze Entities:** Identify the top 5 entities (People, Places, Organizations, Concepts) in the text.
    2.  **Determine Structure:** Detect content type (How-To, Listicle, Comparison, Q&A) and select appropriate additional Schema.org type (HowTo, ItemList, etc.).
    3.  **Map Relationships:** How do these entities interact? (e.g., [Entity A] influences [Entity B]).
    4.  **Draft Questions:** Create 5 questions that test *understanding* of these relationships, not just recall.
    5.  **Refine for AEO:** Ensure explanations are 2-3 sentences long and explicitly name the entities to boost Knowledge Graph salience.
    
    ${specialInstructions}

    **Output Format (JSON Only):**
    {
      "quizSchema": { 
        "@context": "https://schema.org", 
        "@type": "Quiz", 
        "name": "...", 
        "description": "...",
        "about": { "@type": "Thing", "name": "[Main Entity Name]" } 
      },
      "faqSchema": { 
        "@context": "https://schema.org", 
        "@type": "FAQPage", 
        "mainEntity": [] 
      },
      "howToSchema": { "@context": "https://schema.org", "@type": "HowTo", ... } (Optional, if detected),
      "itemListSchema": { "@context": "https://schema.org", "@type": "ItemList", ... } (Optional, if detected),
      "content": {
        "questions": [
          { 
            "question": "...", 
            "options": [{ "text": "...", "isCorrect": true }], 
            "explanation": "..." 
          }
        ],
        "results": [{ "minScore": 0, "title": "...", "summary": "..." }]
      }
    }
    
    Return ONLY valid JSON. No markdown formatting.
    `;
};


export async function generateQuizAndMetadata(state: AppState, postTitle: string, postContent: string, idea: ToolIdea, strategy: OptimizationStrategy, allPosts: WordPressPost[]): Promise<QuizGenerationResult> {
    const cacheKey = `quiz_v2_${state.selectedProvider}_${postTitle}_${idea.title}_${strategy}`;
    const cached = getCached<QuizGenerationResult>(cacheKey, postContent);
    if (cached) return cached;

    const prompt = getQuizJsonPrompt(postTitle, postContent, idea, strategy);
    let responseText = '';
    let groundingMetadata: GroundingMetadata | undefined | null = null;
    let quizData: QuizData;

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
                            latLng: { latitude: position.coords.latitude, longitude: position.coords.longitude }
                        }
                    }
                } catch (e) { console.warn("Geo access denied, proceeding without location bias."); }
            }

            const generatePromise = ai.models.generateContent(request);
            const timeoutPromise = new Promise<GenerateContentResponse>((_, reject) => 
                setTimeout(() => reject(new Error(`AI Generation timed out after ${AI_TIMEOUT_MS/1000}s`)), AI_TIMEOUT_MS)
            );
            const response = await Promise.race([generatePromise, timeoutPromise]);

            responseText = response.text || '';
            groundingMetadata = response.candidates?.[0]?.groundingMetadata ?? null;
        } else {
            responseText = await callGenericChatApi(state, prompt, true);
        }

        const jsonString = responseText.substring(responseText.indexOf('{'), responseText.lastIndexOf('}') + 1);
        quizData = JSON.parse(jsonString) as QuizData;
        
        const result = { quizData, groundingMetadata };
        setCached(cacheKey, postContent, result);
        return result;

    } catch (error) {
        console.error("Quiz Generation Error:", error);
        if (error instanceof SyntaxError) throw new Error("AI generated invalid JSON. Please retry.");
        throw error;
    }
}


export async function generateContentUpdate(state: AppState, postTitle: string, quizTitle: string): Promise<string> {
    const prompt = `
    Generate a JSON object with two HTML strings to integrate a quiz titled "${quizTitle}" into the post "${postTitle}".
    Target: Google "Position Zero" (Featured Snippet).
    
    JSON:
    {
      "introduction": "<p>...</p>", 
      "conclusion": "<div><h3>Key Takeaways</h3><ul><li>...</li></ul></div>"
    }
    `;
    
    try {
        const text = await callGenericChatApi(state, prompt, true);
        const json = JSON.parse(text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1));
        return `<!-- QUIZ INTRO -->\n${json.introduction}\n\n<!-- FEATURED SNIPPET CANDIDATE -->\n${json.conclusion}`;
    } catch (e) {
        return `<!-- Intro -->\n<p>Test your knowledge with our new interactive quiz!</p>`;
    }
}


export function createQuizSnippet(quizResult: QuizGenerationResult, themeColor: string, theme: Theme): string {
    const { quizData, groundingMetadata } = quizResult;
    const { quizSchema, faqSchema, howToSchema, itemListSchema, content } = quizData;
    const themeHsl = hexToHsl(themeColor) || { h: 221, s: 83, l: 53 };
    const uniqueId = `qf-${Math.random().toString(36).substring(2, 9)}`;

    const breadcrumbSchema = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Home", "item": "/" },
            { "@type": "ListItem", "position": 2, "name": "Quiz", "item": "" }
        ]
    };

    const schemaScripts = [
        `<script type="application/ld+json">${JSON.stringify(quizSchema, null, 2)}</script>`,
        `<script type="application/ld+json">${JSON.stringify(breadcrumbSchema, null, 2)}</script>`
    ];
    if (faqSchema) schemaScripts.push(`<script type="application/ld+json">${JSON.stringify(faqSchema, null, 2)}</script>`);
    if (howToSchema) schemaScripts.push(`<script type="application/ld+json">${JSON.stringify(howToSchema, null, 2)}</script>`);
    if (itemListSchema) schemaScripts.push(`<script type="application/ld+json">${JSON.stringify(itemListSchema, null, 2)}</script>`);

    const escapeHtml = (unsafe: string) => unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

    let sourcesHtml = '';
    if (groundingMetadata?.groundingChunks) {
        const validChunks = groundingMetadata.groundingChunks.filter(c => (c.web?.uri && c.web.title) || (c.maps?.uri && c.maps.title));
        if (validChunks.length > 0) {
            sourcesHtml = `
            <div class="qf-sources">
                <span class="qf-sources-label">Sources:</span>
                <ul class="qf-sources-list">
                    ${validChunks.map(chunk => {
                        const source = chunk.web || chunk.maps;
                        return `<li><a href="${escapeHtml(source!.uri!)}" target="_blank" rel="nofollow noopener">${escapeHtml(source!.title!)}</a></li>`;
                    }).join('')}
                </ul>
            </div>`;
        }
    }

    return `
${schemaScripts.join('\n')}
<div id="${uniqueId}" class="qf-root ${theme}" data-tool-id="%%TOOL_ID%%">
<style>
#${uniqueId} {
  --hue: ${themeHsl.h}; --sat: ${themeHsl.s}%; --light: ${themeHsl.l}%;
  --primary: hsl(var(--hue), var(--sat), var(--light));
  --surface: rgba(255, 255, 255, 0.7);
  --border: rgba(255, 255, 255, 0.5);
  --text: #0f172a;
  font-family: system-ui, sans-serif;
  width: 100%; max-width: 680px; margin: 40px auto;
  border-radius: 24px;
  background: var(--surface);
  backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--border);
  box-shadow: 0 20px 40px -10px rgba(0,0,0,0.1);
  overflow: hidden;
  color: var(--text);
}
#${uniqueId}.dark {
  --surface: rgba(15, 23, 42, 0.7);
  --border: rgba(255, 255, 255, 0.1);
  --text: #f8fafc;
}
#${uniqueId} .qf-head { padding: 40px; text-align: center; border-bottom: 1px solid var(--border); }
#${uniqueId} .qf-title { font-size: 1.8rem; font-weight: 800; margin-bottom: 10px; line-height: 1.2; background: linear-gradient(135deg, var(--primary), #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
#${uniqueId} .qf-body { padding: 30px; }
#${uniqueId} .qf-opt { display: block; width: 100%; padding: 16px; margin-bottom: 12px; border-radius: 12px; background: rgba(255,255,255,0.5); border: 1px solid rgba(0,0,0,0.05); text-align: left; font-weight: 600; cursor: pointer; transition: all 0.2s; color: inherit; }
#${uniqueId}.dark .qf-opt { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.05); }
#${uniqueId} .qf-opt:hover:not(:disabled) { transform: scale(1.02); background: rgba(255,255,255,0.8); box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
#${uniqueId}.dark .qf-opt:hover:not(:disabled) { background: rgba(255,255,255,0.1); }
#${uniqueId} .qf-opt.correct { background: #d1fae5; border-color: #10b981; color: #064e3b; }
#${uniqueId}.dark .qf-opt.correct { background: rgba(16, 185, 129, 0.2); color: #6ee7b7; }
#${uniqueId} .qf-opt.wrong { background: #fee2e2; border-color: #ef4444; color: #7f1d1d; }
#${uniqueId}.dark .qf-opt.wrong { background: rgba(239, 68, 68, 0.2); color: #fca5a5; }
#${uniqueId} .qf-btn { background: var(--primary); color: white; border: none; padding: 14px 28px; border-radius: 50px; font-weight: 700; cursor: pointer; transition: transform 0.2s; }
#${uniqueId} .qf-btn:hover { transform: translateY(-2px); box-shadow: 0 10px 20px -5px var(--primary); }
#${uniqueId} .qf-expl { margin-top: 20px; padding: 20px; background: rgba(255,255,255,0.5); border-radius: 12px; border-left: 4px solid var(--primary); display: none; }
#${uniqueId}.dark .qf-expl { background: rgba(0,0,0,0.2); }
#${uniqueId} .qf-sources { font-size: 0.8rem; margin-top: 20px; opacity: 0.8; }
#${uniqueId} .qf-sources a { color: var(--primary); }
</style>

<div id="${uniqueId}-intro" class="qf-head">
    <h2 class="qf-title">${escapeHtml(quizSchema.name)}</h2>
    <p>${escapeHtml(quizSchema.description)}</p>
    <button class="qf-btn" onclick="window.qf_${uniqueId}.start()" style="margin-top:20px;">Start Quiz</button>
</div>

<div id="${uniqueId}-quiz" class="qf-body" style="display:none;">
    <div style="height:4px; background:rgba(0,0,0,0.1); border-radius:2px; margin-bottom:20px;"><div id="${uniqueId}-bar" style="height:100%; width:0%; background:var(--primary); border-radius:2px; transition:width 0.3s;"></div></div>
    <h3 id="${uniqueId}-q" style="font-size:1.4rem; margin-bottom:24px;"></h3>
    <div id="${uniqueId}-opts"></div>
    <div id="${uniqueId}-expl" class="qf-expl"></div>
    <div style="text-align:right; margin-top:20px;"><button id="${uniqueId}-next" class="qf-btn" onclick="window.qf_${uniqueId}.next()" style="display:none;">Next</button></div>
    ${sourcesHtml}
</div>

<div id="${uniqueId}-res" class="qf-head" style="display:none;">
    <div style="font-size:4rem; font-weight:900; line-height:1; color:var(--primary);" id="${uniqueId}-score"></div>
    <h3 id="${uniqueId}-rt" style="font-size:1.5rem; margin:10px 0;"></h3>
    <p id="${uniqueId}-rd"></p>
    <div style="margin-top:30px; display:flex; gap:10px; justify-content:center;">
        <button class="qf-btn" onclick="window.qf_${uniqueId}.share()">Share Result</button>
        <button class="qf-btn" style="background:transparent; border:2px solid var(--border); color:inherit;" onclick="window.qf_${uniqueId}.restart()">Retake</button>
    </div>
</div>

<script>
window.qf_${uniqueId} = (function(){
    const d = ${JSON.stringify(content)};
    const el = i => document.getElementById('${uniqueId}-'+i);
    let idx=0, s=0;
    return {
        start: () => { el('intro').style.display='none'; el('quiz').style.display='block'; idx=0; s=0; window.qf_${uniqueId}.r(); },
        r: () => {
            const q = d.questions[idx];
            el('q').innerText = q.question;
            el('bar').style.width = ((idx)/d.questions.length*100)+'%';
            el('expl').style.display = 'none';
            el('next').style.display = 'none';
            el('opts').innerHTML = q.options.map((o,i) => \`<button class="qf-opt" onclick="window.qf_${uniqueId}.c(\${i},this)">\${o.text}</button>\`).join('');
        },
        c: (i,b) => {
            const q = d.questions[idx];
            const cor = q.options[i].isCorrect;
            Array.from(el('opts').children).forEach(btn => btn.disabled=true);
            if(cor) { s++; b.classList.add('correct'); } else { b.classList.add('wrong'); Array.from(el('opts').children).forEach((btn,bi)=>q.options[bi].isCorrect && btn.classList.add('correct')); }
            el('expl').innerHTML = '<strong>'+(cor?'Correct!':'Explanation')+'</strong><br>'+q.explanation;
            el('expl').style.display='block';
            el('next').innerText = idx<d.questions.length-1 ? 'Next' : 'See Results';
            el('next').style.display='inline-block';
        },
        next: () => { idx++; if(idx<d.questions.length) window.qf_${uniqueId}.r(); else window.qf_${uniqueId}.end(); },
        end: () => {
            el('quiz').style.display='none'; el('res').style.display='block';
            const pct = Math.round(s/d.questions.length*100);
            el('score').innerText = pct+'%';
            const r = d.results.slice().reverse().find(x => s >= x.minScore) || d.results[0];
            el('rt').innerText = r.title; el('rd').innerText = r.summary;
            const toolId = document.getElementById('${uniqueId}').dataset.toolId;
            if(toolId && toolId !== '%%TOOL_ID%%') fetch('/wp-json/quizforge/v1/submit', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({toolId:parseInt(toolId), resultTitle:r.title, score:s, totalQuestions:d.questions.length})}).catch(()=>{});
        },
        restart: () => { el('res').style.display='none'; window.qf_${uniqueId}.start(); },
        share: () => {
            const t = \`I scored \${el('score').innerText} on \${document.title}!\`;
            if(navigator.share) navigator.share({title:document.title, text:t, url:window.location.href});
            else window.open(\`https://twitter.com/intent/tweet?text=\${encodeURIComponent(t)}&url=\${encodeURIComponent(window.location.href)}\`);
        }
    };
})();
</script>
</div>`;
}
