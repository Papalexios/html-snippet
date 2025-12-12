export type Status = 'idle' | 'loading' | 'error' | 'success';

export enum AiProvider {
  Gemini = 'gemini',
  OpenAI = 'openai',
  Anthropic = 'anthropic',
  OpenRouter = 'openrouter',
}

export type ApiValidationStatus = 'idle' | 'validating' | 'valid' | 'invalid';
export type ApiKeys = { [key in AiProvider]: string };
export type ApiValidationStatuses = { [key in AiProvider]: ApiValidationStatus };

export interface WordPressConfig {
  url: string;
  username: string;
  appPassword: string;
}

export interface WordPressPost {
  id: number;
  title: {
    rendered: string;
  };
  content: {
    rendered: string;
    raw?: string; // Raw content from DB, available in 'edit' context for robust shortcode detection
  };
  link: string;
  featuredImageUrl: string | null;
  hasOptimizerSnippet: boolean;
  toolId?: number; // The ID of the cf_tool custom post
}

export interface ToolIdea {
  title: string;
  description: string;
  icon: string; // e.g., "calculator", "chart", "list"
}

export type Theme = 'light' | 'dark';

export type FrameStatus = 'initializing' | 'ready' | 'failed';

export type Placement = 'ai' | 'end' | 'manual';

export type PostFilter = 'all' | 'with-quiz' | 'without-quiz';

export interface QuizAnalyticsData {
  completions: number;
  averageScore: number; // as a percentage
  resultCounts: Record<string, number>;
}

export interface QuizData {
  quizSchema: {
    '@context': string;
    '@type': 'Quiz';
    name: string;
    description: string;
    hasPart: {
        '@type': 'Question';
        name: string;
        acceptedAnswer: { '@type': 'Answer', 'text': string };
        suggestedAnswer: { '@type': 'Answer', 'text': string }[];
    }[];
  };
  faqSchema?: {
      '@context': 'https://schema.org';
      '@type': 'FAQPage';
      mainEntity: {
          '@type': 'Question';
          name: string;
          acceptedAnswer: { '@type': 'Answer', 'text': string };
      }[];
  };
  // SOTA: Advanced Schema Support
  howToSchema?: any; 
  itemListSchema?: any;
  content: {
    questions: {
      question: string;
      options: { text: string; isCorrect: boolean }[];
      explanation: string;
    }[];
    results: {
      minScore: number;
      title: string;
      summary: string;
    }[];
  };
}

// --- SOTA TYPES ---
export interface ContentHealth {
  score: number; // 0-100
  readability: string;
  seoGap: string;
  missingTopics: string[];
  internalLinkSuggestions: string[];
}

export type OptimizationStrategy = 'standard' | 'fact_check' | 'geo';

export interface GroundingChunk {
  // FIX: Made uri and title optional to match the @google/genai library type.
  web?: { uri?: string; title?: string; };
  maps?: { uri?: string; title?: string; };
}
export interface GroundingMetadata {
  // FIX: Made groundingChunks optional to align with the @google/genai library type.
  groundingChunks?: GroundingChunk[];
}
export interface QuizGenerationResult {
  quizData: QuizData;
  groundingMetadata?: GroundingMetadata | null;
}
// -----------------------------


export interface AppState {
  status: Status; // For general app status like fetching posts
  error: string | null;
  deletingPostId: number | null;
  theme: Theme;
  frameStatus: FrameStatus;
  
  // AI Provider State
  selectedProvider: AiProvider;
  apiKeys: ApiKeys;
  apiValidationStatuses: ApiValidationStatuses;
  openRouterModel: string;

  // WordPress State
  wpConfig: WordPressConfig | null;
  posts: WordPressPost[];
  filteredPosts: WordPressPost[];
  postSearchQuery: string;
  postFilter: PostFilter;
  setupRequired: boolean; // Flag to indicate if the PHP snippet setup is needed
  currentPage: number;
  totalPages: number;
  isLoadingMore: boolean;

  // Tool Generation Modal State
  isToolGenerationModalOpen: boolean;
  activePostForModal: WordPressPost | null; // The post being edited
  modalStatus: Status; // Status specific to the modal's async operations
  modalError: string | null;
  toolIdeas: ToolIdea[];
  contentHealth: ContentHealth | null; // New SOTA Field
  selectedIdea: ToolIdea | null;
  generatedQuizHtml: string;
  suggestedContentUpdate: string | null;
  themeColor: string;
  manualShortcode: string | null;

  // Analytics Modal State
  isAnalyticsModalOpen: boolean;
  activeToolIdForAnalytics: number | null;
}