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
    **Persona:** You are a seasoned product manager and UX strategist specializing in digital content engagement. You have a reputation for transforming static articles into viral, interactive experiences.

    **Analysis Task:** Analyze the following blog post.
    *   **Title:** "${postTitle}"
    *   **Content:** "${cleanContent}"

    **Your Mission:**
    Suggest three distinct, **elite-level**, interactive HTML tool ideas that would be exceptionally valuable and engaging for this post's reader. The goal is to create a "wow" moment that makes the reader's life easier, offers a unique insight, or helps them apply the post's knowledge instantly.

    **Creative Direction:**
    *   **Think Beyond the Obvious:** Avoid simple calculators unless the post is purely about a specific formula. Propose more sophisticated tools like interactive checklists, data visualizers, ROI predictors, comparison sliders, personalized quizzes, or configuration wizards.
    *   **Deeply Contextual:** Each idea MUST be deeply tailored to the specific nuances of the post's content. A generic idea is a failed idea.
    *   **Action-Oriented:** The tool should empower the user to *do* something with the information, not just passively consume it.

    **Output Specification:**
    For each of the three ideas:
    1.  **title:** A short, compelling, action-oriented title.
    2.  **description:** A concise, single-sentence description of the tool's value proposition for the user. IMPORTANT: This must be a single line of text with no newline characters.
    3.  **icon:** Suggest a relevant icon name from this exact list: [calculator, chart, list, idea].

    **Your final response MUST be ONLY a valid JSON object in the format: { "ideas": [{ "title": "...", "description": "...", "icon": "..." }] }**
    Ensure the JSON is perfectly formed and contains no unescaped control characters. Do not include any explanatory text or markdown.
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
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: { ideas: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, description: { type: Type.STRING }, icon: { type: Type.STRING } } } } }
                    },
                },
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

        // Sanitize the string to remove control characters like newlines which can break JSON.parse.
        jsonString = jsonString.replace(/[\r\n\t]/g, ' ');

        const result = JSON.parse(jsonString);
        
        // Robustly find the array of ideas, regardless of the key name (e.g., "ideas", " ", "tools").
        const ideasArray = Object.values(result).find(value => Array.isArray(value)) as any[];

        if (ideasArray) {
            // Filter to ensure the items in the array match the ToolIdea structure.
            const validIdeas = ideasArray.filter(item =>
                typeof item === 'object' && item !== null &&
                'title' in item && 'description' in item && 'icon' in item
            );

            if (validIdeas.length > 0) {
                return validIdeas.slice(0, 3);
            }
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

// --- NEW UTILITY FUNCTION for HTML Generation ---
function hexToHsl(hex: string): { h: number, s: number, l: number } {
    let r = 0, g = 0, b = 0;
    if (hex.length === 4) {
        r = parseInt(hex[1] + hex[1], 16);
        g = parseInt(hex[2] + hex[2], 16);
        b = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length === 7) {
        r = parseInt(hex[1] + hex[2], 16);
        g = parseInt(hex[3] + hex[4], 16);
        b = parseInt(hex[5] + hex[6], 16);
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
    const cleanContent = stripHtml(postContent).substring(0, 4000);
    const themeHsl = hexToHsl(themeColor);
    const themeHslString = `${themeHsl.h} ${themeHsl.s}% ${themeHsl.l}%`;
    const themeHslHoverString = `${themeHsl.h} ${themeHsl.s}% ${Math.max(0, themeHsl.l - 8)}%`; // Darker for hover
    const uniqueId = `cforge-tool-${Date.now()}`;

    return `
    **Persona:** You are a lead frontend engineer at a company like Stripe or Vercel, known for creating interfaces that are the gold standard of the industry. Your work is defined by its precision, performance, and an obsessive focus on user experience. You will now create an interactive tool that reflects this elite standard.

    **Mission:** Generate a single, 100% self-contained, production-ready HTML snippet. This snippet will be injected directly onto a live webpage, so it must be completely isolated and well-behaved. The final output must be **ONLY the raw HTML code** and nothing else.

    **Tool Request:**
    *   **Blog Post Title:** "${postTitle}"
    *   **Tool Idea:** "${idea.title}"
    *   **Description:** "${idea.description}"
    *   **Content Context (for data and relevance):** "${cleanContent}"
    *   **Primary Accent Color (HSL):** ${themeHslString}

    **Design & UX Philosophy (Non-negotiable):**
    1.  **Understated Elegance:** The design must be modern, premium, and clean. Use a refined color palette based on Tailwind's \`slate\` colors for text and backgrounds. Create depth with subtle background gradients (e.g., \`bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900\`) and fine-keyed borders (\`border-slate-200 dark:border-slate-700\`). Use generous, consistent spacing.
    2.  **Delightful Micro-interactions:** The tool must feel responsive. Use smooth transitions (\`transition-all\`, \`duration-300\`) for ALL state changes. When results are calculated, animate them in with a subtle fade and scale effect. Buttons must have clear hover and active states.
    3.  **Perfect Dark Mode:** Every element MUST be perfectly styled for both light and dark themes using Tailwind's \`dark:\` variants.
    4.  **Bulletproof Responsiveness:** The layout must be flawless on all screen sizes, from a 320px mobile viewport to a 4K desktop.
    5.  **Exemplary Accessibility (WCAG AA):** Use semantic HTML (<label>, <input>, <button>). Use ARIA attributes where necessary (\`aria-live="polite"\` for dynamic result regions). Ensure all interactive elements have highly visible focus states.

    **Technical Mandates (Strictly Enforced):**

    1.  **RAW HTML ONLY:** Your response MUST start with \`<script src="https://cdn.tailwindcss.com"></script>\` and end with the final closing \`</script>\` tag of your logic. Do NOT include Markdown fences (\`\`\`html\`), \`<html>\`, \`<head>\`, or \`<body>\` tags.
    
    2.  **STRUCTURE & STYLING:**
        *   The snippet must start with the Tailwind CDN script: \`<script src="https://cdn.tailwindcss.com"></script>\`.
        *   The root element of your visible UI MUST have the ID \`${uniqueId}\`.
        *   Immediately after, include a single \`<style>\` block.
        *   Inside this \`<style>\` block, define CSS variables for theming on the root element's ID selector:
            \`#${uniqueId} {
                --accent-color: ${themeHslString};
                --accent-color-hover: ${themeHslHoverString};
                --accent-color-focus-ring: ${themeHsl.h} ${themeHsl.s}% ${themeHsl.l + 20}%;
             }\`
            Then, use these variables in your Tailwind classes for buttons and focus rings, e.g., \`bg-[hsl(var(--accent-color))] hover:bg-[hsl(var(--accent-color-hover))] focus:ring-[hsl(var(--accent-color-focus-ring))]\`.

    3.  **HTML:**
        *   Use semantic HTML. Use \`<label>\`s for all form inputs.

    4.  **JAVASCRIPT:**
        *   Place all logic in a single \`<script>\` tag at the very end of the snippet.
        *   Wrap your ENTIRE script logic in a DOMContentLoaded event listener to ensure the HTML is ready: \`document.addEventListener('DOMContentLoaded', function() { ... });\`
        *   Inside, get the root container: \`const toolContainer = document.getElementById('${uniqueId}'); if (!toolContainer) return;\`.
        *   All subsequent DOM queries MUST be scoped to that container. E.g., \`const button = toolContainer.querySelector('button');\`. This is CRITICAL for isolation.
        *   **NO INLINE EVENT HANDLERS** (e.g., no \`onclick="..."\`). Use \`addEventListener\` to wire up events.
        *   Structure your code with clear functions. For complex tools, use a simple state management pattern (e.g., a state object and a \`render()\` function).
        *   **Gracefully handle all edge cases.** Sanitize user inputs, prevent errors (like division by zero), and provide clear, helpful feedback for invalid actions without breaking the layout or using ugly \`alert()\` boxes.

    Now, based on these exacting standards, generate the complete, premium HTML snippet for the "${idea.title}" tool.
    `;
};


// --- "SURGICAL STRIKE" SHORTCODE INSERTION LOGIC ---

/**
 * Injects unique comment markers between top-level block elements in an HTML string.
 */
function addInsertionMarkers(html: string): string {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const body = doc.body;
    const children = Array.from(body.children);
    
    // Don't add a marker if the content is empty or just whitespace
    if (body.textContent?.trim() === '') {
        const marker = doc.createComment(` CFORGE_MARKER_1 `);
        body.appendChild(marker);
        return body.innerHTML;
    }

    const firstMarker = doc.createComment(` CFORGE_MARKER_1 `);
    body.insertBefore(firstMarker, body.firstChild);
    
    let counter = 2;
    children.forEach(child => {
        const marker = doc.createComment(` CFORGE_MARKER_${counter++} `);
        child.parentNode?.insertBefore(marker, child.nextSibling);
    });
    
    return body.innerHTML;
}


const getMarkerToReplacePrompt = (markedUpHtml: string, toolTitle: string, toolDescription: string): string => {
  return `
**Persona:** You are an elite web developer and UX expert with an unparalleled understanding of content flow and reader engagement. Your task is to find the best placement for an interactive tool within a blog post.

**Mission:**
I will provide you with the HTML of a blog post containing special insertion markers (e.g., \`<!-- CFORGE_MARKER_1 -->\`). I will also provide the title and description of the tool to be inserted.

1.  **Analyze the Context:** Read the blog post's HTML to understand its structure, topic, and flow.
2.  **Analyze the Tool:** The tool to be inserted is titled "${toolTitle}" and is described as: "${toolDescription}".
3.  **Identify the Optimal Location:** Determine the single best marker to replace with this tool. The ideal location is where the tool provides maximum value and feels most natural to the reader. Consider placing it after a relevant introduction or a section that sets up the problem the tool solves.
4.  **Return the Marker ID:** Your response MUST BE a valid JSON object containing only the ID of the chosen marker.

**Example Response:**
{
  "markerId": "CFORGE_MARKER_5"
}

**Critical Rules:**
*   Your output must be ONLY the JSON object. Do not include any explanations, introductory text, or markdown code fences.
*   The value of "markerId" MUST exactly match one of the markers in the provided HTML (e.g., "CFORGE_MARKER_1", "CFORGE_MARKER_2", etc.).

---
**Blog Post HTML with Insertion Markers:**
${markedUpHtml}
---

Now, provide the JSON object specifying the best marker to replace.
  `;
};

export async function insertShortcodeIntoContent(state: AppState, postContent: string, shortcode: string): Promise<string> {
    const markedUpHtml = addInsertionMarkers(postContent);
    
    // Truncate the HTML for the prompt to avoid token limits, while keeping the structure.
    const promptHtml = markedUpHtml.length > 12000 ? markedUpHtml.substring(0, 12000) + '...' : markedUpHtml;
    const prompt = getMarkerToReplacePrompt(promptHtml, state.selectedIdea!.title, state.selectedIdea!.description);

    let markerToReplace: string | null = null;
    let responseText: string = '';

    try {
        if (state.selectedProvider === AiProvider.Gemini) {
            const ai = new GoogleGenAI({ apiKey: state.apiKeys.gemini });
            const response = await ai.models.generateContent({
                model: AI_PROVIDERS.gemini.defaultModel,
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: { markerId: { type: Type.STRING, description: "The ID of the marker to replace, e.g., CFORGE_MARKER_5" } }
                    }
                }
            });
            responseText = response.text;
        } else {
            responseText = await callGenericChatApi(state, prompt, true, 256);
        }
        
        const firstBrace = responseText.indexOf('{');
        const lastBrace = responseText.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
            const jsonString = responseText.substring(firstBrace, lastBrace + 1);
            const result = JSON.parse(jsonString);
            if (result.markerId && typeof result.markerId === 'string' && result.markerId.startsWith('CFORGE_MARKER_')) {
                markerToReplace = result.markerId;
            }
        }
    } catch (error) {
        console.error("AI API error during marker selection:", error);
    }

    let newContent: string;
    if (markerToReplace) {
        const markerComment = `<!-- ${markerToReplace.trim()} -->`;
        if (markedUpHtml.includes(markerComment)) {
            newContent = markedUpHtml.replace(markerComment, `\n\n${shortcode}\n\n`);
        } else {
            console.warn(`AI selected marker "${markerToReplace}" but it was not found. Appending shortcode.`);
            newContent = postContent + `\n\n${shortcode}\n\n`;
        }
    } else {
        console.warn("AI failed to return a valid marker. Appending shortcode.");
        newContent = postContent + `\n\n${shortcode}\n\n`;
    }
    
    // Final cleanup: Remove all other markers from the final result.
    return newContent.replace(/<!--\s*CFORGE_MARKER_\d+\s*-->/g, '');
}

// --- GENERIC API HANDLER for OpenAI, Anthropic, OpenRouter ---
async function callGenericChatApi(state: AppState, prompt: string, isJsonMode: boolean, maxTokens: number = 4000): Promise<string> {
    const { selectedProvider, apiKeys, openRouterModel } = state;
    const apiKey = apiKeys[selectedProvider];
    
    let url: string;
    let headers: Record<string, string>;
    let body: Record<string, any>;

    const model = selectedProvider === AiProvider.OpenRouter ? openRouterModel : AI_PROVIDERS[selectedProvider].defaultModel;

    switch(selectedProvider) {
        case AiProvider.OpenAI:
            url = 'https://api.openai.com/v1/chat/completions';
            headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };
            body = { model, messages: [{ role: 'user', content: prompt }], temperature: 0.5, max_tokens: maxTokens };
            if (isJsonMode) body.response_format = { type: 'json_object' };
            break;
        case AiProvider.Anthropic:
            url = 'https://api.anthropic.com/v1/messages';
            headers = { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' };
            body = { model, messages: [{ role: 'user', content: prompt }], temperature: 0.5, max_tokens: maxTokens };
            break;
        case AiProvider.OpenRouter:
             url = 'https://openrouter.ai/api/v1/chat/completions';
             headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };
             body = { model, messages: [{ role: 'user', content: prompt }], temperature: 0.5, max_tokens: maxTokens };
             if (isJsonMode) body.response_format = { type: 'json_object' };
             break;
        default:
            throw new Error('Unsupported provider for generic API call');
    }

    const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorData?.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    
    if (selectedProvider === AiProvider.Anthropic) {
        return data.content[0].text;
    } else {
        return data.choices[0].message.content;
    }
}

// --- STREAMING IMPLEMENTATIONS ---

async function* streamSse(stream: ReadableStream<Uint8Array>, provider: 'openai' | 'anthropic' | 'openrouter'): AsyncGenerator<string> {
    const reader = stream.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = '';

    while (true) {
        const { value, done } = await reader.read();
        if (done) {
            break;
        }

        buffer += value;
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep the last, possibly incomplete line

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const data = line.substring(6);
                if (data.trim() === '[DONE]') {
                    return;
                }
                try {
                    const parsed = JSON.parse(data);
                    let chunk = '';
                    if (provider === 'anthropic') {
                        if (parsed.type === 'content_block_delta') {
                            chunk = parsed.delta.text;
                        }
                    } else { // OpenAI and OpenRouter
                        chunk = parsed.choices[0]?.delta?.content || '';
                    }
                    if (chunk) {
                        yield chunk;
                    }
                } catch (e) {
                    // Ignore parsing errors for non-json lines
                }
            }
        }
    }
}


export async function* generateHtmlSnippetStream(state: AppState, postTitle: string, postContent: string, idea: ToolIdea, themeColor: string): AsyncGenerator<string> {
    const { selectedProvider, apiKeys, openRouterModel } = state;
    const apiKey = apiKeys[selectedProvider];
    const prompt = getHtmlGenerationPrompt(postTitle, postContent, idea, themeColor);

    try {
        if (selectedProvider === AiProvider.Gemini) {
            const ai = new GoogleGenAI({ apiKey });
            const stream = await ai.models.generateContentStream({
                model: AI_PROVIDERS.gemini.defaultModel,
                contents: prompt,
            });
            for await (const chunk of stream) {
                yield chunk.text;
            }
        } else {
            let url: string;
            let headers: Record<string, string>;
            let body: Record<string, any>;

            const model = selectedProvider === AiProvider.OpenRouter ? openRouterModel : AI_PROVIDERS[selectedProvider].defaultModel;

            switch (selectedProvider) {
                case AiProvider.OpenAI:
                    url = 'https://api.openai.com/v1/chat/completions';
                    headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };
                    body = { model, messages: [{ role: 'user', content: prompt }], temperature: 0.5, max_tokens: 4000, stream: true };
                    break;
                case AiProvider.Anthropic:
                    url = 'https://api.anthropic.com/v1/messages';
                    headers = { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' };
                    body = { model, messages: [{ role: 'user', content: prompt }], temperature: 0.5, max_tokens: 4000, stream: true };
                    break;
                case AiProvider.OpenRouter:
                    url = 'https://openrouter.ai/api/v1/chat/completions';
                    headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };
                    body = { model, messages: [{ role: 'user', content: prompt }], temperature: 0.5, stream: true };
                    break;
                default:
                    throw new Error('Unsupported provider for streaming');
            }

            const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
            if (!response.ok || !response.body) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorData?.error?.message || 'Unknown error'}`);
            }
            
            yield* streamSse(response.body, selectedProvider);
        }
    } catch (error) {
        console.error("AI API error in generateHtmlSnippetStream:", error);
        throw new Error(`Failed to generate HTML from ${AI_PROVIDERS[selectedProvider].name}.`);
    }
}