export type Status = 'idle' | 'loading' | 'error' | 'success';
export type ModalStatus = 'idle' | 'loading_ideas' | 'generating_snippet' | 'inserting_snippet' | 'error' | 'success';

export enum AiProvider {
  Gemini = 'gemini',
  OpenAI = 'openai',
  Anthropic = 'anthropic',
  OpenRouter = 'openrouter',
}

export type ApiValidationStatus = 'idle' | 'validating' | 'valid' | 'invalid';

export interface ApiKeys {
  [AiProvider.Gemini]: string;
  [AiProvider.OpenAI]: string;
  [AiProvider.Anthropic]: string;
  [AiProvider.OpenRouter]: string;
}

export interface ApiValidationStatuses {
  [AiProvider.Gemini]: ApiValidationStatus;
  [AiProvider.OpenAI]: ApiValidationStatus;
  [AiProvider.Anthropic]: ApiValidationStatus;
  [AiProvider.OpenRouter]: ApiValidationStatus;
}

export interface ApiValidationErrorMessages {
  [AiProvider.Gemini]: string | null;
  [AiProvider.OpenAI]: string | null;
  [AiProvider.Anthropic]: string | null;
  [AiProvider.OpenRouter]: string | null;
}


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
  };
  link: string;
  featuredImageUrl: string | null;
  hasOptimizerSnippet: boolean;
  toolId?: number; // The ID of the cf_tool custom post
  opportunityScore?: number;
  opportunityRationale?: string;
  toolCreationDate?: number; // Stored as a Unix timestamp
}

export interface ToolIdea {
  title: string;
  description: string;
  icon: string; // e.g., "calculator", "chart", "list"
}

export type Theme = 'light' | 'dark';

export type FrameStatus = 'initializing' | 'ready' | 'failed';

export interface AppState {
  status: Status; // For general app status like fetching posts
  error: string | null;
  deletingPostId: number | null;
  refreshingPostId: number | null; // For tool refresh
  theme: Theme;
  frameStatus: FrameStatus;
  isScoring: boolean;
  isFetchingMorePosts: boolean; // For pagination
  
  // AI Provider State
  apiKeys: ApiKeys;
  apiValidationStatuses: ApiValidationStatuses;
  apiValidationErrorMessages: ApiValidationErrorMessages;
  selectedProvider: AiProvider;
  openRouterModel: string;

  // WordPress State
  wpConfig: WordPressConfig | null;
  posts: WordPressPost[];
  filteredPosts: WordPressPost[];
  postsPage: number; // For pagination
  hasMorePosts: boolean; // For pagination
  postSearchQuery: string;
  postSortOrder: 'opportunity' | 'date';
  setupRequired: boolean; // Flag to indicate if the PHP snippet setup is needed

  // Tool Generation Modal State
  isToolGenerationModalOpen: boolean;
  activePostForModal: WordPressPost | null; // The post being edited
  modalStatus: ModalStatus; // Status specific to the modal's async operations
  modalError: string | null;
  toolIdeas: ToolIdea[];
  selectedIdea: ToolIdea | null;
  generatedSnippet: string;
  themeColor: string;
}