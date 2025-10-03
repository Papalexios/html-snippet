import { AiProvider } from './types';

export const AI_PROVIDERS: Record<AiProvider, { name: string, defaultModel: string, requiresModelField?: boolean }> = {
  [AiProvider.Gemini]: {
    name: 'Google Gemini',
    defaultModel: 'gemini-2.5-flash',
  },
  [AiProvider.OpenAI]: {
    name: 'OpenAI',
    defaultModel: 'gpt-4o',
  },
  [AiProvider.Anthropic]: {
    name: 'Anthropic (Claude)',
    defaultModel: 'claude-3-haiku-20240307',
  },
  [AiProvider.OpenRouter]: {
    name: 'OpenRouter',
    defaultModel: 'mistralai/mistral-7b-instruct',
    requiresModelField: true,
  }
};

/**
 * A robust, case-insensitive regex to detect the shortcode and capture its ID.
 * Handles variations in whitespace and quote types (' " or none).
 * e.g., [contentforge_tool id="123"], [ contentforge_tool id='456' ], [contentforge_tool id=789]
 */
export const SHORTCODE_DETECTION_REGEX = /\[\s*contentforge_tool\s+id\s*=\s*["']?(\d+)["']?\s*.*?\]/i;

const SHORTCODE_BASE_REGEX_STRING = `\\[\\s*contentforge_tool\\s+id\\s*=\\s*["']?\\d+["']?\\s*.*?\\]`;

/**
 * A global, case-insensitive regex to find and remove all instances of the shortcode.
 * This version is more robust, as it also removes the surrounding <p> tag if the shortcode is the only thing inside it.
 * This prevents empty paragraphs from being left behind after deletion.
 */
export const SHORTCODE_REMOVAL_REGEX = new RegExp(
  `(?:<p[^>]*>\\s*${SHORTCODE_BASE_REGEX_STRING}\\s*<\\/p>)|(?:${SHORTCODE_BASE_REGEX_STRING})`,
  'gi'
);