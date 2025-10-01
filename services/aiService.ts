
import { GoogleGenAI, GenerateContentResponse, Type } from '@google/genai';
import { ApiKeys, AiProvider, WordPressPost, ToolIdea } from '../types';
import { AI_PROVIDERS } from '../constants';

// Helper to initialize the Gemini client with a user-provided API key.
const getGeminiClient = (apiKey: string): GoogleGenAI => {
    // FIX: Initialize GoogleGenAI with the provided API key from user input.
    // This aligns with the application's UI, which allows users to enter their own keys,
    // rather than relying on a pre-configured process.env.API_KEY.
    return new GoogleGenAI({ apiKey });
};

/**
 * Validates an API key by making a minimal, inexpensive call to the provider's API.
 */
export async function validateApiKey(provider: AiProvider, apiKey: string, model: string): Promise<boolean> {
    if (!apiKey) return false;

    try {
        if (provider === AiProvider.Gemini) {
            const ai = getGeminiClient(apiKey);
            // FIX: Use a supported model 'gemini-2.5-flash' for validation.
            await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: 'h', // A minimal prompt to validate the key cheaply.
                config: {
                    // FIX: Set maxOutputTokens and thinkingBudget to minimal values for a cheap validation call.
                    maxOutputTokens: 1,
                    thinkingConfig: { thinkingBudget: 0 }
                }
            });
            return true; // If it doesn't throw, the key is valid.
        }
        // For now, assume other providers' keys are valid if they exist.
        // A full implementation would add validation logic for OpenAI, Anthropic, etc.
        return true;
    } catch (error) {
        console.error(`API key validation failed for ${provider}:`, error);
        return false;
    }
}

/**
 * Analyzes a list of WordPress posts to generate "opportunity scores" indicating
 * their potential for adding an interactive tool.
 */
export async function getOpportunityScores(
    apiKey: string,
    provider: AiProvider,
    model: string,
    posts: WordPressPost[]
): Promise<Partial<WordPressPost>[]> {
     if (provider !== AiProvider.Gemini) {
        throw new Error('Opportunity scoring is only supported for Gemini at this time.');
    }
    const ai = getGeminiClient(apiKey);

    const postContext = posts.map(p => `- Post ID ${p.id}: "${p.title.rendered}"`).join('\n');

    const prompt = `
        You are an SEO and content marketing expert. Your task is to analyze a list of blog post titles and determine their potential for adding an interactive HTML tool (like a calculator, quiz, or checklist) to increase user engagement and SEO value.

        Analyze the following blog posts:
        ${postContext}

        For each post, provide an "opportunity score" from 0 to 100, where 100 is the highest potential. Also provide a brief, one-sentence rationale for your score. Focus on titles that suggest a problem can be solved, a calculation can be made, or a process can be simplified. For example, "How to Budget for a Vacation" has high potential for a budget calculator. "My Trip to Paris" has low potential.

        Return your response as a JSON array, with each object containing "id", "opportunityScore", and "opportunityRationale". The 'id' must be the integer post ID.

        Example response:
        [
            { "id": 101, "opportunityScore": 95, "opportunityRationale": "This post is perfect for a budget calculator tool." },
            { "id": 102, "opportunityScore": 20, "opportunityRationale": "A narrative post with low potential for an interactive tool." }
        ]
    `;

    // FIX: Use gemini-2.5-flash model as per guidelines.
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        id: { type: Type.INTEGER },
                        opportunityScore: { type: Type.INTEGER },
                        opportunityRationale: { type: Type.STRING },
                    },
                    required: ["id", "opportunityScore", "opportunityRationale"],
                }
            }
        }
    });

    return JSON.parse(response.text);
}


/**
 * Generates three interactive tool ideas for a given WordPress post.
 */
export async function generateToolIdeas(
    apiKey: string,
    provider: AiProvider,
    model: string,
    post: WordPressPost
): Promise<ToolIdea[]> {
    if (provider !== AiProvider.Gemini) {
        throw new Error('Tool idea generation is only supported for Gemini at this time.');
    }
    const ai = getGeminiClient(apiKey);
    
    // Simple HTML stripper to clean and shorten content for the prompt.
    const cleanContent = post.content.rendered.replace(/<[^>]*>?/gm, '').substring(0, 4000);

    const prompt = `
        You are a creative expert in user engagement and SEO. Analyze the following blog post to suggest THREE unique and highly relevant interactive HTML tool ideas. These tools should help the reader, increase their time on the page, and be directly related to the post's content.

        Post Title: "${post.title.rendered}"
        Post Content (first 4000 chars): "${cleanContent}"

        For each idea, provide a short, catchy title, a one-sentence description of what it does, and a relevant icon name from this list: "calculator", "chart", "list".

        Return your response as a valid JSON array of objects. Each object should have "title", "description", and "icon" properties.

        Example Response:
        [
            {
                "title": "Investment Return Calculator",
                "description": "Calculates the potential return on investment based on user inputs.",
                "icon": "calculator"
            }
        ]
    `;
    
    // FIX: Use gemini-2.5-flash model as per guidelines.
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        description: { type: Type.STRING },
                        icon: { type: Type.STRING },
                    },
                    required: ["title", "description", "icon"],
                }
            }
        }
    });

    return JSON.parse(response.text);
}

/**
 * Generates a self-contained HTML/CSS/JS snippet for a tool idea, returning a stream of text chunks.
 */
export async function generateSnippet(
    apiKey: string,
    provider: AiProvider,
    model: string,
    post: WordPressPost,
    idea: ToolIdea
): Promise<AsyncGenerator<string, void, unknown>> {
    if (provider !== AiProvider.Gemini) {
        throw new Error('Snippet generation is only supported for Gemini at this time.');
    }
    const ai = getGeminiClient(apiKey);

    const cleanContent = post.content.rendered.replace(/<[^>]*>?/gm, '').substring(0, 4000);

    const prompt = `
        You are a world-class senior frontend engineer specializing in creating beautiful, responsive, and accessible HTML snippets. Your task is to generate a complete, self-contained HTML tool based on the provided blog post content and tool idea.

        **CRITICAL REQUIREMENTS:**
        1.  **Self-Contained:** The output MUST be a single block of HTML. All CSS must be inside a \`<style>\` tag and all JavaScript must be inside a \`<script>\` tag. Do not use external files.
        2.  **No Explanations:** Only output the raw HTML code. Do not include any markdown, backticks, or explanations like "Here is your code:". Your entire response must be parsable as HTML.
        3.  **Responsiveness:** The tool must be fully responsive and look great on both mobile and desktop screens. Use modern CSS like Flexbox or Grid.
        4.  **Accessibility:** Use semantic HTML and ensure the tool is accessible (e.g., proper labels, ARIA attributes if necessary).
        5.  **Styling:**
            *   Style the tool to look clean, modern, and professional.
            *   It must have a beautiful dark mode that respects the user's system preference. Use \`@media (prefers-color-scheme: dark) { ... }\`.
            *   Use CSS variables for theming. The primary accent color MUST be defined by a CSS variable named \`--accent-color\`. You MUST also define \`--accent-color-hover\` and \`--accent-color-focus-ring\`. The app will replace these. Use a default blue color (e.g., hsl(217, 91%, 60%)) for these variables.
            *   The base font should inherit from the parent page (\`font-family: inherit;\`).
        6.  **Functionality:** The JavaScript should be well-written, efficient, and handle user interactions, calculations, and DOM updates.

        **CONTEXT:**
        *   **Blog Post Title:** "${post.title.rendered}"
        *   **Blog Post Content Summary:** "${cleanContent}"
        *   **Tool to Build:**
            *   **Title:** "${idea.title}"
            *   **Description:** "${idea.description}"

        Now, generate the complete HTML code for this tool.
    `;

    // FIX: Use generateContentStream for streaming response as per function signature.
    const responseStream = await ai.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents: prompt
    });

    async function* streamGenerator(): AsyncGenerator<string, void, unknown> {
        for await (const chunk of responseStream) {
            yield chunk.text;
        }
    }

    return streamGenerator();
}
