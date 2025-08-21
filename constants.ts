import { Step, AiProvider } from './types';

export const STEP_DESCRIPTIONS: Record<Step, { title: string; description: string }> = {
  [Step.Configure]: {
    title: 'Configure Connection',
    description: 'Connect to your WordPress site.',
  },
  [Step.Analyze]: {
    title: 'Analyze & Select',
    description: 'Choose a post and an enhancement idea.',
  },
  [Step.Generate]: {
    title: 'Generate & Insert',
    description: 'Generate HTML and update your post.',
  },
};

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

/**
 * A global, case-insensitive regex to find and remove all instances of the shortcode.
 */
export const SHORTCODE_REMOVAL_REGEX = /\[\s*contentforge_tool\s+id\s*=\s*["']?\d+["']?\s*.*?\]/gi;