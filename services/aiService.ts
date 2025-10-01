import { GoogleGenAI, Type } from "@google/genai";
import { AppState, ToolIdea, AiProvider } from '../types';
import { AI_PROVIDERS } from "../constants";

// Helper to strip HTML tags for cleaner prompts
const stripHtml = (html: string): string => {
    if (typeof document !== 'undefined') {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        return doc.body.textContent || "";
    }
    return html.replace(/<[^>]*>/g, '');
};

// --- API VALIDATION ---
export async function validateApiKey(provider: AiProvider, apiKey: string, model?: string): Promise<boolean> {
  try {
    switch (provider) {
      case AiProvider.Gemini:
        // A cheap call to list models to verify the key
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        const geminiResponse = await fetch(geminiUrl);
        return geminiResponse.ok;
      
      case AiProvider.OpenAI:
        const openaiResponse = await fetch('https://api.openai.com/v1/models', {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        return openaiResponse.ok;

      case AiProvider.Anthropic:
         const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                model: "claude-3-haiku-20240307",
                max_tokens: 1,
                messages: [{ role: "user", content: "h" }] // minimal request
            })
        });
        // 401 is invalid auth, anything else might be a different issue but key is likely ok.
        return anthropicResponse.status !== 401;

      case AiProvider.OpenRouter:
         const openRouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: model || AI_PROVIDERS.openrouter.defaultModel,
                max_tokens: 1,
                messages: [{ role: "user", content: "h" }]
            })
        });
        return openRouterResponse.status !== 401;

      default:
        return false;
    }
  } catch (error) {
    console.error(`Validation error for ${provider}:`, error);
    return false;
  }
}


// --- IDEA GENERATION ---
const getIdeaPrompt = (postTitle: string, postContent: string): string => {
    const cleanContent = stripHtml(postContent).substring(0, 8000);
    return `
    **Persona:** You are an expert in digital marketing, user engagement, and cognitive psychology. Your specialty is converting passive blog readers into active, engaged participants by creating irresistible interactive content.

    **Analysis Task:** Deeply analyze the following blog post.
    *   **Title:** "${postTitle}"
    *   **Content Snippet:** "${cleanContent}"

    **Your Mission:**
    Based on the post's core message, target audience, and potential user goals, generate THREE distinct, highly valuable interactive quiz ideas. The goal is not just to test knowledge, but to provide tangible value to the user, making them feel smarter, more confident, or more clear about a decision. Each quiz should be a powerful tool for boosting on-page time and reinforcing the article's authority.

    **Creative Direction & Quiz Archetypes:**
    Generate a mix of the following archetypes, ensuring each is a perfect fit for the article's content:
    *   **The Knowledge Assessor:** A sophisticated quiz that goes beyond simple recall. It tests the user's deep understanding of the concepts discussed. Frame its title to be empowering, like "How Well Do You Really Understand [Topic]?" or "Are You a [Topic] Expert? Take the Challenge!". Icon: 'list'.
    *   **The Diagnostic Tool:** A consultative quiz that helps users identify their specific needs or determine which solution/product/strategy from the article is right for them. This is exceptionally powerful for affiliate or review content. Frame its title like "Find Your Perfect [Product/Strategy]" or "What's Your [Topic] Score? Get Your Personalized Recommendation". Icon: 'chart'.
    *   **The Archetype Identifier:** A fun, insightful quiz that categorizes the user into a specific persona or type related to the article's topic. This makes the results highly personal and shareable. Frame its title like "What's Your [Topic] Archetype?" or "Discover Your [Topic] Personality". Icon: 'idea'.

    **Output Specification (Strict):**
    For each of the three ideas:
    1.  **title:** A compelling, action-oriented title for the quiz.
    2.  **description:** A single, concise sentence explaining the tangible value or discovery the user will gain from the quiz. IMPORTANT: This must be a single line of text with no newline characters.
    3.  **icon:** Choose the most relevant icon name from this exact list: [list, chart, idea].

    **Your final response MUST be ONLY a valid JSON object in the format: { "ideas": [{ "title": "...", "description": "...", "icon": "..." }] }**
    Ensure the JSON is perfectly formed. Do not include any explanatory text, markdown, or commentary outside of the JSON structure.
    `;
};


export async function suggestToolIdeas(state: AppState, postTitle: string, postContent: string): Promise<ToolIdea[]> {
    const { selectedProvider, apiKeys } = state;
    const apiKey = apiKeys[selectedProvider];
    const prompt = getIdeaPrompt(postTitle, postContent);
    let responseText = ''; // Used for error reporting

    try {
        if (selectedProvider === AiProvider.Gemini) {
            const ai = new GoogleGenAI({ apiKey });
            const response = await ai.models.generateContent({
                model: AI_PROVIDERS.gemini.defaultModel,
                contents: prompt,
                config: { responseMimeType: "application/json" },
            });
            responseText = response.text;
        } else {
            responseText = await callGenericChatApi(state, prompt, true);
        }

        // Clean the response to ensure it's valid JSON, stripping markdown fences or other text.
        const firstBrace = responseText.indexOf('{');
        const lastBrace = responseText.lastIndexOf('}');

        if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
             throw new Error("AI response did not contain a valid JSON object.");
        }
        
        let jsonString = responseText.substring(firstBrace, lastBrace + 1);
        const result = JSON.parse(jsonString);
        
        const ideasArray = result.ideas || [];

        if (Array.isArray(ideasArray) && ideasArray.length > 0) {
            // Filter to ensure the items in the array match the ToolIdea structure.
            return ideasArray.filter(item =>
                typeof item === 'object' && item !== null &&
                'title' in item && 'description' in item && 'icon' in item
            ).slice(0, 3);
        }
        
        throw new Error("AI did not return valid tool ideas in the expected format.");
    } catch (error) {
        console.error("AI API error in suggestToolIdeas:", error);
         if (error instanceof SyntaxError) {
             throw new Error(`Failed to parse AI response as JSON. The model may have returned an invalid format. Response snippet: ${responseText.substring(0, 150)}...`);
        }
        throw new Error(`Failed to get suggestions from ${AI_PROVIDERS[selectedProvider].name}. Check the console for details.`);
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


// --- HTML GENERATION ---
const getHtmlGenerationPrompt = (postTitle: string, postContent: string, idea: ToolIdea, themeColor: string): string => {
    const cleanContent = stripHtml(postContent).substring(0, 12000); // Increased context length
    const themeHsl = hexToHsl(themeColor) || { h: 217, s: 91, l: 60 };
    const uniqueId = `qf-quiz-${Date.now()}`;

    // FIX: Escaped all backticks within the template literal to prevent parsing errors.
    return `
    **Persona:** You are a world-leading Instructional Designer, UX Architect, and Frontend Engineer. You specialize in creating "edutainment" modules for high-traffic content websites. Your work is factually unimpeachable, visually stunning, pedagogically sound, and technically flawless.

    **Mission:** Generate a single, 100% self-contained, production-ready HTML file for an interactive quiz. It must be a masterpiece of engagement, learning, and user delight. The final output must be **ONLY raw HTML code**.

    **Source Material (FOR REFERENCE ONLY):**
    *   **Blog Post Title:** "${postTitle}"
    *   **Selected Quiz Concept:** "${idea.title}"
    *   **Quiz's Core Value Proposition:** "${idea.description}"
    *   **Source Content:** "${cleanContent}"

    // =================================================================================
    // SECTION 0: THE ACCURACY & GROUNDING MANDATE (NON-NEGOTIABLE)
    // =================================================================================
    **Your primary directive is to act as a rigorous fact-checker.**
    1.  **EXCLUSIVE SOURCE:** ALL information used for questions, answers, and explanations MUST be directly derived from the provided "Source Content" above. **DO NOT use any external knowledge.**
    2.  **VERIFIABILITY:** Every correct answer and explanation must be directly verifiable from a statement or concept within the source text.
    3.  **NO HALLUCINATION:** If the source content is insufficient to create a high-quality quiz, you must state this and refuse to generate the quiz. Do not invent information.

    // =================================================================================
    // SECTION 1: QUIZ CONTENT & PEDAGOGY (The Brains of a Valuable Tool)
    // =================================================================================
    **1.1. High-Cognition Question Design:**
    *   Generate 5-7 multiple-choice questions.
    *   **PROHIBITED:** Simple, low-value recall questions (e.g., "What is X?").
    *   **MANDATORY:** Create questions that require higher-order thinking:
        *   **Scenario-Based:** "A user faces [scenario from article]. Based on the text, what is their best course of action?"
        *   **Comparative Analysis:** "According to the article, what is the key advantage of [Concept A] over [Concept B]?"
        *   **Cause & Effect:** "The article states [Cause]. What is the most likely outcome?"
    *   **Pedagogically Valuable Distractors:** Incorrect answers must be plausible and represent common, subtle misunderstandings of the source text.

    **1.2. The Socratic "Mini-Lesson" Feedback Loop (CRITICAL FOR VALUE):**
    *   For **EVERY** question, provide a detailed explanation that appears *after* the user answers.
    *   This explanation is the core learning component and MUST follow this 3-part structure:
        1.  **Direct Answer:** Start with "Correct!" or "Not quite." followed by a clear statement of the correct answer and *why* it is correct, quoting or paraphrasing the source text.
        2.  **Distractor Analysis:** Explain precisely why the chosen incorrect answer is wrong, correcting the specific misunderstanding.
        3.  **Deeper Insight:** End with a "Key Takeaway:" or "Pro Tip:" sentence that connects the concept to a broader principle from the article, solidifying the learning.

    // =================================================================================
    // SECTION 2: AESTHETICS & UX ("PREMIUM & MODERN" MANDATE)
    // =================================================================================
    **2.1. Overall Design Philosophy:**
    *   **Seamless Integration:** The design should feel native to a professional blog. Use a clean, full-width container with subtle borders and background colors. NO floating "glassmorphism" cards.
    *   **Superior Readability:** Employ a refined typographic scale. Use a larger font for questions and clear, legible fonts for options and explanations. Use generous whitespace.
    *   **Mobile-First & Flawless:** The layout MUST be perfect on mobile devices and scale beautifully to desktops. Use fluid typography (e.g., with clamp()).

    **2.2. The "Report Card" Results Screen:**
    *   **Animated Donut Chart:** A large, animated SVG donut chart is mandatory for celebrating the score.
    *   **Empowering Title:** Give the user a title based on score tiers (e.g., "Growth Mindset," "Seasoned Pro," "Topic Authority").
    *   **Actionable Summary:** Provide a tailored summary and a clear, valuable next step that encourages re-engagement with the site's content.
    *   **Clean "Review Answers" Accordion:** Use a styled \\\`<details>\\\` element for a clean, collapsible summary of questions and explanations.

    // =================================================================================
    // SECTION 3: TECHNICAL & IMPLEMENTATION MANDATES (The Flawless Code)
    // =================================================================================
    **3.1. RAW HTML ONLY:** Your response MUST start with \\\`<script src="https://cdn.tailwindcss.com"></script>\\\` and end with the final closing \\\`</script>\\\` tag. NO Markdown fences (\\\`\\\`\\\`html\\\`\\\`), \\\`<html>\\\`, \\\`<head>\\\`, or \\\`<body>\\\` tags.

    **3.2. STRUCTURE & STYLING (Follow this EXACTLY):**
        *   Start with the Tailwind CDN script.
        *   Root element: \\\`<div id="${uniqueId}" class="qf-quiz-container font-sans text-slate-800" data-tool-id="%%TOOL_ID%%">...\\\`. The \\\`%%TOOL_ID%%\\\` is a server-side placeholder.
        *   Include a single \\\`<style>\\\` block with this new, enhanced CSS for a more integrated and professional look.
            \\\`
            #${uniqueId} {
                --qf-accent-h: ${themeHsl.h}; --qf-accent-s: ${themeHsl.s}%; --qf-accent-l: ${themeHsl.l}%;
                --qf-accent-color: hsl(var(--qf-accent-h), var(--qf-accent-s), var(--qf-accent-l));
                --qf-accent-color-hover: hsl(var(--qf-accent-h), var(--qf-accent-s), calc(var(--qf-accent-l) - 8%));
                --qf-accent-text-light: hsl(var(--qf-accent-h), var(--qf-accent-s), 10%);
                --qf-accent-text-dark: hsl(var(--qf-accent-h), var(--qf-accent-s), 95%);
                --qf-bg-light: 248 250 252; --qf-bg-dark: 30 41 59;
                --qf-border-light: 226 232 240; --qf-border-dark: 51 65 85;
                --qf-correct-color: 22 163 74; --qf-incorrect-color: 220 38 38;
                font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji';
            }
            #${uniqueId}.dark { color: #cbd5e1; }
            #${uniqueId} .qf-outer-container { background-color: rgb(var(--qf-bg-light)); border: 1px solid rgb(var(--qf-border-light)); transition: background-color 0.3s, border-color 0.3s; }
            #${uniqueId}.dark .qf-outer-container { background-color: rgb(var(--qf-bg-dark)); border-color: rgb(var(--qf-border-dark)); }
            #${uniqueId} .qf-progress-bar-inner { transition: width 0.4s ease-out; background-color: var(--qf-accent-color); }
            #${uniqueId} .qf-option-label { transition: transform 0.2s, box-shadow 0.2s, background-color 0.2s; }
            #${uniqueId} .qf-option-label:hover { transform: translateY(-2px); box-shadow: 0 4px 10px -2px rgba(0,0,0,0.06); }
            #${uniqueId}.dark .qf-option-label:hover { box-shadow: 0 4px 15px -3px rgba(0,0,0,0.2); }
            #${uniqueId} .qf-explanation { max-height: 0; opacity: 0; transform: translateY(-10px); transition: max-height 0.5s ease-out, opacity 0.5s ease-out, transform 0.5s ease-out; overflow: hidden; }
            #${uniqueId} .qf-explanation.qf-visible { max-height: 500px; opacity: 1; transform: translateY(0); }
            #${uniqueId} .qf-feedback-icon { transform: scale(0.5); opacity: 0; transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1.2); } /* Added bounce effect */
            #${uniqueId} .qf-option-label.qf-selected .qf-radio-dot { transform: scale(1); opacity: 1; background-color: var(--qf-accent-color); }
            #${uniqueId} .qf-option-label.qf-correct .qf-radio-outer { border-color: rgb(var(--qf-correct-color)); }
            #${uniqueId} .qf-option-label.qf-correct .qf-radio-dot { background-color: rgb(var(--qf-correct-color)); transform: scale(1); opacity: 1; }
            #${uniqueId} .qf-option-label.qf-incorrect .qf-radio-outer { border-color: rgb(var(--qf-incorrect-color)); }
            #${uniqueId} .qf-option-label.qf-incorrect .qf-radio-dot { background-color: rgb(var(--qf-incorrect-color)); transform: scale(1); opacity: 1; }
            #${uniqueId} .qf-view { transition: opacity 0.3s ease-in-out; }
            #${uniqueId} .qf-view.qf-hidden { display: none; }
            #${uniqueId} .qf-donut-chart-track { stroke: rgb(var(--qf-border-light)); }
            #${uniqueId}.dark .qf-donut-chart-track { stroke: rgb(var(--qf-border-dark)); }
            #${uniqueId} .qf-donut-chart-progress { stroke: var(--qf-accent-color); transition: stroke-dashoffset 1s cubic-bezier(0.5, 0, 0.25, 1); }
            #${uniqueId} details summary { list-style: none; } /* Hide the default marker */
            #${uniqueId} details summary::-webkit-details-marker { display: none; }
            #${uniqueId} .qf-summary-icon { transition: transform 0.2s; }
            #${uniqueId} details[open] .qf-summary-icon { transform: rotate(90deg); }
            \\\`

    **3.3. BUG-FREE, ISOLATED VANILLA JAVASCRIPT (CRITICAL):**
        *   All JS must be in a single \\\`<script>\\\` tag at the end, wrapped in an IIFE: \\\`(function() { ... })();\\\`
        *   Initialize on \\\`DOMContentLoaded\\\`. All DOM selections MUST be scoped to the main quiz container ID (\\\`${uniqueId}\\\`).
        *   **JS String Safety (ABSOLUTELY CRITICAL):** All text content for the \\\`quizData\\\` object (questions, options, explanations, titles, summaries) MUST use JavaScript template literals (\\\`\\\`) to prevent syntax errors from quotes or newlines. E.g., \\\`question: \\\`This is a question about "so-and-so".\\\`\\\`. This is a non-negotiable requirement.
        *   **Data Structure:**
            \\\`
            const quizData = {
                questions: [ { question: \\\`...\\\`, options: [{ text: \\\`...\\\`, isCorrect: true }, ...], explanation: \\\`...\\\` } ],
                results: [
                    { minScore: 0, title: \\\`Growth Mindset\\\`, summary: \\\`You're building a great foundation!\\\`, feedback: \\\`To deepen your understanding, try reviewing the section on X in the article.\\\` },
                    { minScore: 3, title: \\\`Seasoned Pro\\\`, summary: \\\`You have a strong grasp of the material!\\\`, feedback: \\\`To challenge yourself further, apply these concepts to our advanced guide on Y.\\\` },
                    { minScore: 5, title: \\\`Topic Authority\\\`, summary: \\\`Excellent! You're an expert on this topic.\\\`, feedback: \\\`You have a deep understanding. Share your high score and insights!\\\` }
                ]
            };
            \\\`
        *   **BUG FIX - START QUIZ LOGIC (NON-NEGOTIABLE):** The 'Start Quiz' button (e.g., with id \\\`qf-start-button\\\`) MUST have a click listener. When clicked, it MUST: 1. Add the \\\`qf-hidden\\\` class to the intro view container. 2. Remove the \\\`qf-hidden\\\` class from the main question view container. 3. Call the \\\`renderQuestion()\\\` function to display the first question. This logic must be flawless.
        *   **BUG FIX - ROBUST BUTTON LOGIC:** Implement a state variable \\\`let isAnswerChecked = false;\\\`. The main action button must have a SINGLE event listener. This listener's callback will use an if/else check on \\\`isAnswerChecked\\\` to determine whether to call \\\`checkAnswer()\\\` or \\\`showNextQuestion()\\\`. This prevents the "unresponsive button" bug. The \\\`checkAnswer\\\` function will set \\\`isAnswerChecked = true\\\`, and \\\`renderQuestion\\\` will set it back to \\\`false\\\`.
        *   **Analytics Submission:** The \\\`renderResults\\\` function must call a \\\`submitResults\\\` function that sends a POST request to \\\`/wp-json/quizforge/v1/submit\\\`.
        *   **SVG Icons:** Embed required SVG icons directly in the HTML where needed.

    Synthesize these instructions to generate the complete, self-contained, high-quality HTML quiz. The final product must be flawless, valuable, and beautiful.
    `;
};


async function* callGenericChatApiStream(state: AppState, prompt: string): AsyncGenerator<string> {
     const { selectedProvider, apiKeys, openRouterModel } = state;
     const apiKey = apiKeys[selectedProvider];
     let url = '';
     let headers: Record<string, string> = { 'Content-Type': 'application/json' };
     let body: any = {};

     switch(selectedProvider) {
        case AiProvider.OpenAI:
            url = 'https://api.openai.com/v1/chat/completions';
            headers['Authorization'] = `Bearer ${apiKey}`;
            body = { model: AI_PROVIDERS.openai.defaultModel, messages: [{ role: 'user', content: prompt }], stream: true };
            break;
        case AiProvider.Anthropic:
            url = 'https://api.anthropic.com/v1/messages';
            headers['x-api-key'] = apiKey;
            headers['anthropic-version'] = '2023-06-01';
            body = { model: AI_PROVIDERS.anthropic.defaultModel, messages: [{ role: 'user', content: prompt }], max_tokens: 4096, stream: true };
            break;
        case AiProvider.OpenRouter:
             url = 'https://openrouter.ai/api/v1/chat/completions';
             headers['Authorization'] = `Bearer ${apiKey}`;
             body = { model: openRouterModel || AI_PROVIDERS.openrouter.defaultModel, messages: [{ role: 'user', content: prompt }], stream: true };
             break;
        default:
            throw new Error('Unsupported provider for streaming');
     }

     const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });

     if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error from ${AI_PROVIDERS[selectedProvider].name}: ${response.status} ${errorText}`);
     }

     const reader = response.body?.getReader();
     if (!reader) throw new Error("Failed to get response reader");
     const decoder = new TextDecoder();

     try {
        while(true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n').filter(line => line.trim());

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const jsonData = line.substring(6);
                    if (jsonData === '[DONE]') break;
                    try {
                        const parsed = JSON.parse(jsonData);
                        let text = '';
                        if (selectedProvider === AiProvider.Anthropic) {
                            if (parsed.type === 'content_block_delta') {
                                text = parsed.delta?.text || '';
                            }
                        } else { // OpenAI & OpenRouter
                            text = parsed.choices?.[0]?.delta?.content || '';
                        }
                         if (text) yield text;
                    } catch (e) {
                        // Ignore parsing errors for incomplete JSON chunks
                    }
                }
            }
        }
     } finally {
        reader.releaseLock();
     }
}

async function callGenericChatApi(state: AppState, prompt: string, forceJson: boolean = false): Promise<string> {
    const { selectedProvider, apiKeys, openRouterModel } = state;
    const apiKey = apiKeys[selectedProvider];
    let url = '';
    let headers: Record<string, string> = { 'Content-Type': 'application/json' };
    let body: any = {};

    switch(selectedProvider) {
        case AiProvider.OpenAI:
            url = 'https://api.openai.com/v1/chat/completions';
            headers['Authorization'] = `Bearer ${apiKey}`;
            body = { model: AI_PROVIDERS.openai.defaultModel, messages: [{ role: 'user', content: prompt }] };
            if (forceJson) body.response_format = { type: "json_object" };
            break;
        case AiProvider.Anthropic:
            url = 'https://api.anthropic.com/v1/messages';
            headers['x-api-key'] = apiKey;
            headers['anthropic-version'] = '2023-06-01';
            body = { model: AI_PROVIDERS.anthropic.defaultModel, messages: [{ role: 'user', content: prompt }], max_tokens: 4096 };
            break;
        case AiProvider.OpenRouter:
            url = 'https://openrouter.ai/api/v1/chat/completions';
            headers['Authorization'] = `Bearer ${apiKey}`;
            body = { model: openRouterModel || AI_PROVIDERS.openrouter.defaultModel, messages: [{ role: 'user', content: prompt }] };
            if (forceJson) body.response_format = { type: "json_object" };
            break;
        default:
            throw new Error('Unsupported provider');
    }

    const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error from ${AI_PROVIDERS[selectedProvider].name}: ${response.status} ${errorText}`);
    }

    const responseData = await response.json();
    
    if (selectedProvider === AiProvider.Anthropic) {
        return responseData.content?.[0]?.text || '';
    }
    // OpenAI & OpenRouter
    return responseData.choices?.[0]?.message?.content || '';
}


export async function* generateHtmlSnippetStream(state: AppState, postTitle: string, postContent: string, idea: ToolIdea, themeColor: string): AsyncGenerator<string> {
    const { selectedProvider, apiKeys } = state;
    const apiKey = apiKeys[selectedProvider];
    const prompt = getHtmlGenerationPrompt(postTitle, postContent, idea, themeColor);

    if (selectedProvider === AiProvider.Gemini) {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContentStream({
            model: AI_PROVIDERS.gemini.defaultModel,
            contents: prompt,
        });
        for await (const chunk of response) {
            yield chunk.text;
        }
    } else {
        // Fallback to streaming for other providers
        yield* callGenericChatApiStream(state, prompt);
    }
}