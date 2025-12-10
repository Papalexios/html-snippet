import React, { createContext, useReducer, useContext, useCallback, useMemo, useEffect } from 'react';
import { AppState, WordPressConfig, WordPressPost, ToolIdea, AiProvider, Theme, Status, Placement, PostFilter, OptimizationStrategy, ApiKeys, ApiValidationStatuses } from '../types';
import { fetchPosts, updatePost, checkSetup, createCfTool, deleteCfTool } from '../services/wordpressService';
import { suggestToolIdeas, generateQuizAndMetadata, createQuizSnippet, generateContentUpdate, validateApiKey } from '../services/aiService';
import { SHORTCODE_REMOVAL_REGEX } from '../constants';

type Action =
  | { type: 'RESET' }
  | { type: 'START_LOADING'; payload?: 'posts' | 'delete' }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'SET_SETUP_REQUIRED'; payload: boolean }
  | { type: 'CONFIGURE_SUCCESS'; payload: { config: WordPressConfig; posts: WordPressPost[]; totalPages: number } }
  | { type: 'LOAD_MORE_START' }
  | { type: 'LOAD_MORE_SUCCESS'; payload: { posts: WordPressPost[], currentPage: number } }
  | { type: 'START_DELETING_SNIPPET'; payload: number }
  | { type: 'DELETE_SNIPPET_COMPLETE'; payload: { posts: WordPressPost[] } }
  | { type: 'SET_POSTS'; payload: WordPressPost[] }
  | { type: 'SET_POST_SEARCH_QUERY', payload: string }
  | { type: 'SET_POST_FILTER', payload: PostFilter }
  | { type: 'SET_THEME'; payload: Theme }
  // AI Provider Actions
  | { type: 'SET_PROVIDER', payload: AiProvider }
  | { type: 'SET_API_KEY', payload: { provider: AiProvider, key: string } }
  | { type: 'SET_OPENROUTER_MODEL', payload: string }
  | { type: 'VALIDATE_API_KEY_START', payload: AiProvider }
  | { type: 'VALIDATE_API_KEY_RESULT', payload: { provider: AiProvider, isValid: boolean } }
  // Modal Actions
  | { type: 'OPEN_TOOL_MODAL', payload: WordPressPost }
  | { type: 'CLOSE_TOOL_MODAL' }
  | { type: 'SET_MODAL_STATUS', payload: { status: Status, error?: string | null } }
  | { type: 'GET_IDEAS_SUCCESS'; payload: ToolIdea[] }
  | { type: 'SELECT_IDEA'; payload: ToolIdea }
  | { type: 'SET_THEME_COLOR'; payload: string }
  | { type: 'GENERATE_ENHANCED_QUIZ_START' }
  | { type: 'GENERATE_ENHANCED_QUIZ_SUCCESS'; payload: { quizHtml: string, contentUpdate: string } }
  | { type: 'INSERT_SNIPPET_SUCCESS' }
  | { type: 'INSERT_MANUAL_SUCCESS', payload: string }
  // Analytics Modal Actions
  | { type: 'OPEN_ANALYTICS_MODAL', payload: number }
  | { type: 'CLOSE_ANALYTICS_MODAL' };

const WP_CONFIG_KEY = 'wp_config';
const THEME_KEY = 'app_theme';
const AI_CONFIG_KEY = 'ai_config';


const getInitialTheme = (): Theme => {
    if (typeof window === 'undefined') return 'light';
    const storedTheme = localStorage.getItem(THEME_KEY) as Theme | null;
    if (storedTheme) return storedTheme;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const initialApiKeys: ApiKeys = { gemini: '', openai: '', anthropic: '', openrouter: '' };
const initialValidationStatuses: ApiValidationStatuses = { gemini: 'idle', openai: 'idle', anthropic: 'idle', openrouter: 'idle' };

const initialState: AppState = {
  status: 'idle',
  error: null,
  deletingPostId: null,
  theme: getInitialTheme(),
  frameStatus: 'initializing',
  // AI State
  selectedProvider: AiProvider.Gemini,
  apiKeys: initialApiKeys,
  apiValidationStatuses: initialValidationStatuses,
  openRouterModel: 'mistralai/mistral-7b-instruct',
  // WP State
  wpConfig: null,
  posts: [],
  filteredPosts: [],
  postSearchQuery: '',
  postFilter: 'all',
  setupRequired: false,
  currentPage: 1,
  totalPages: 1,
  isLoadingMore: false,
  // Tool Modal State
  isToolGenerationModalOpen: false,
  activePostForModal: null,
  modalStatus: 'idle',
  modalError: null,
  toolIdeas: [],
  selectedIdea: null,
  generatedQuizHtml: '',
  suggestedContentUpdate: null,
  themeColor: '#3b82f6',
  manualShortcode: null,
  // Analytics Modal State
  isAnalyticsModalOpen: false,
  activeToolIdForAnalytics: null,
};

const applyFilters = (posts: WordPressPost[], query: string, filter: PostFilter): WordPressPost[] => {
    const lowerCaseQuery = query.toLowerCase();
    return posts.filter(post => {
        const titleMatch = post.title.rendered.toLowerCase().includes(lowerCaseQuery);
        if (!titleMatch) return false;

        switch (filter) {
            case 'with-quiz':
                return post.hasOptimizerSnippet;
            case 'without-quiz':
                return !post.hasOptimizerSnippet;
            case 'all':
            default:
                return true;
        }
    });
};

const appReducer = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    case 'RESET':
      sessionStorage.removeItem(WP_CONFIG_KEY);
      return { ...initialState, theme: state.theme, apiKeys: state.apiKeys, selectedProvider: state.selectedProvider, openRouterModel: state.openRouterModel, apiValidationStatuses: state.apiValidationStatuses };
    case 'START_LOADING':
      return { ...state, status: 'loading', error: null, setupRequired: false };
    case 'SET_ERROR':
      return { ...state, status: 'error', error: action.payload, deletingPostId: null, isLoadingMore: false };
    case 'SET_SETUP_REQUIRED':
      return { ...state, status: 'error', setupRequired: action.payload };
    case 'CONFIGURE_SUCCESS':
      return {
        ...state,
        status: 'success',
        wpConfig: action.payload.config,
        posts: action.payload.posts,
        filteredPosts: action.payload.posts,
        postSearchQuery: '',
        postFilter: 'all',
        setupRequired: false,
        currentPage: 1,
        totalPages: action.payload.totalPages,
      };
    case 'LOAD_MORE_START':
        return { ...state, isLoadingMore: true };
    case 'LOAD_MORE_SUCCESS': {
        const newPosts = [...state.posts, ...action.payload.posts];
        return {
            ...state,
            isLoadingMore: false,
            posts: newPosts,
            filteredPosts: applyFilters(newPosts, state.postSearchQuery, state.postFilter),
            currentPage: action.payload.currentPage
        };
    }
    case 'SET_POSTS':
      return { ...state, posts: action.payload, filteredPosts: applyFilters(action.payload, state.postSearchQuery, state.postFilter) };
    case 'START_DELETING_SNIPPET':
        return { ...state, status: 'loading', deletingPostId: action.payload, error: null };
    case 'DELETE_SNIPPET_COMPLETE':
        return {
            ...state,
            status: 'idle',
            deletingPostId: null,
            posts: action.payload.posts,
            filteredPosts: applyFilters(action.payload.posts, state.postSearchQuery, state.postFilter),
        };
    case 'SET_POST_SEARCH_QUERY':
        return { ...state, postSearchQuery: action.payload, filteredPosts: applyFilters(state.posts, action.payload, state.postFilter) };
    case 'SET_POST_FILTER':
        return { ...state, postFilter: action.payload, filteredPosts: applyFilters(state.posts, state.postSearchQuery, action.payload) };
    case 'SET_THEME':
        return { ...state, theme: action.payload };
    // AI Provider Reducers
    case 'SET_PROVIDER':
        return { ...state, selectedProvider: action.payload };
    case 'SET_API_KEY':
        return { ...state, apiKeys: { ...state.apiKeys, [action.payload.provider]: action.payload.key }, apiValidationStatuses: {...state.apiValidationStatuses, [action.payload.provider]: 'idle'} };
    case 'SET_OPENROUTER_MODEL':
        return { ...state, openRouterModel: action.payload };
    case 'VALIDATE_API_KEY_START':
        return { ...state, apiValidationStatuses: { ...state.apiValidationStatuses, [action.payload]: 'validating' }};
    case 'VALIDATE_API_KEY_RESULT':
        return { ...state, apiValidationStatuses: { ...state.apiValidationStatuses, [action.payload.provider]: action.payload.isValid ? 'valid' : 'invalid' }};
    // Tool Modal Reducers
    case 'OPEN_TOOL_MODAL':
      return { ...state, isToolGenerationModalOpen: true, activePostForModal: action.payload };
    case 'CLOSE_TOOL_MODAL':
      return { ...state, isToolGenerationModalOpen: false, activePostForModal: null, toolIdeas: [], selectedIdea: null, generatedQuizHtml: '', modalStatus: 'idle', modalError: null, manualShortcode: null, suggestedContentUpdate: null };
    case 'SET_MODAL_STATUS':
      return { ...state, modalStatus: action.payload.status, modalError: action.payload.error || null };
    case 'GET_IDEAS_SUCCESS':
      return { ...state, modalStatus: 'idle', toolIdeas: action.payload };
    case 'SELECT_IDEA':
      return { ...state, selectedIdea: action.payload, generatedQuizHtml: '', suggestedContentUpdate: null }; // Reset generated content when idea changes
    case 'SET_THEME_COLOR':
      return { ...state, themeColor: action.payload };
    case 'GENERATE_ENHANCED_QUIZ_START':
      return { ...state, modalStatus: 'loading', generatedQuizHtml: '', suggestedContentUpdate: null, modalError: null };
    case 'GENERATE_ENHANCED_QUIZ_SUCCESS':
      return { ...state, modalStatus: 'idle', generatedQuizHtml: action.payload.quizHtml, suggestedContentUpdate: action.payload.contentUpdate };
    case 'INSERT_SNIPPET_SUCCESS':
        return { ...state, modalStatus: 'success' };
    case 'INSERT_MANUAL_SUCCESS':
        return { ...state, modalStatus: 'success', manualShortcode: action.payload };
    // Analytics Modal Reducers
    case 'OPEN_ANALYTICS_MODAL':
        return { ...state, isAnalyticsModalOpen: true, activeToolIdForAnalytics: action.payload };
    case 'CLOSE_ANALYTICS_MODAL':
        return { ...state, isAnalyticsModalOpen: false, activeToolIdForAnalytics: null };
    default:
      return state;
  }
};

const AppContext = createContext<{
  state: AppState;
  connectToWordPress: (config: WordPressConfig) => Promise<void>;
  retryConnection: () => Promise<void>;
  reset: () => void;
  setTheme: (theme: Theme) => void;
  // AI Provider Actions
  setProvider: (provider: AiProvider) => void;
  setApiKey: (provider: AiProvider, key: string) => void;
  setOpenRouterModel: (model: string) => void;
  validateAndSaveApiKey: (provider: AiProvider) => Promise<void>;
  // Post Dashboard Actions
  setPostSearchQuery: (query: string) => void;
  setPostFilter: (filter: PostFilter) => void;
  deleteSnippet: (postId: number, toolId?: number) => Promise<void>;
  loadMorePosts: () => Promise<void>;
  openAnalyticsModal: (toolId: number) => void;
  closeAnalyticsModal: () => void;
  // Tool Generation Modal Actions
  beginToolCreation: (post: WordPressPost) => void;
  closeToolGenerationModal: () => void;
  generateIdeasForModal: () => Promise<void>;
  selectIdea: (idea: ToolIdea) => void;
  generateEnhancedQuizForModal: (strategy: OptimizationStrategy) => Promise<void>;
  insertSnippet: (placement: Placement) => Promise<void>;
  setThemeColor: (color: string) => void;

} | null>(null);

export const AppContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState, (init) => {
    try {
      const cachedWpConfig = sessionStorage.getItem(WP_CONFIG_KEY);
      const cachedAiConfig = localStorage.getItem(AI_CONFIG_KEY);
      
      let wpState = {};
      let aiState = {};

      if (cachedWpConfig) {
        wpState = { wpConfig: JSON.parse(cachedWpConfig) };
      }
      if (cachedAiConfig) {
        const parsed = JSON.parse(cachedAiConfig);
        
        // --- CORRUPTION-PROOF LOADING ---
        // Rigorously check if the stored apiKeys is a valid, non-null object.
        const validApiKeys = (parsed.apiKeys && typeof parsed.apiKeys === 'object' && !Array.isArray(parsed.apiKeys))
            ? parsed.apiKeys
            : initialApiKeys; // If not, discard and use the default empty keys.

        aiState = {
            selectedProvider: parsed.selectedProvider || AiProvider.Gemini,
            apiKeys: { ...initialApiKeys, ...validApiKeys },
            openRouterModel: parsed.openRouterModel || init.openRouterModel,
        }
      }

       return {
          ...init,
          ...wpState,
          ...aiState,
          theme: getInitialTheme(),
        };
    } catch (e) {
      console.error("Failed to load state from storage", e);
      return { ...init, theme: getInitialTheme() };
    }
  });
  
  // Effect to apply theme class to the root element
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(state.theme);
    localStorage.setItem(THEME_KEY, state.theme);
  }, [state.theme]);
  
  // Effect to fetch posts if config exists on load
  useEffect(() => {
    const fetchInitialPosts = async () => {
      if (state.wpConfig && state.posts.length === 0) {
        dispatch({ type: 'START_LOADING' });
        try {
          const { posts, totalPages } = await fetchPosts(state.wpConfig, 1);
          dispatch({ type: 'CONFIGURE_SUCCESS', payload: { config: state.wpConfig, posts, totalPages } });
        } catch(err) {
          dispatch({ type: 'SET_ERROR', payload: err instanceof Error ? err.message : 'Failed to fetch posts' });
        }
      }
    };
    fetchInitialPosts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.wpConfig]);

  const reset = useCallback(() => dispatch({ type: 'RESET' }), []);
  
  const connectToWordPress = useCallback(async (config: WordPressConfig) => {
    dispatch({ type: 'START_LOADING' });
    try {
      const isSetup = await checkSetup(config);
      if (!isSetup) {
        dispatch({ type: 'SET_SETUP_REQUIRED', payload: true });
        dispatch({ type: 'SET_ERROR', payload: 'A one-time setup is required.' });
        sessionStorage.setItem(WP_CONFIG_KEY, JSON.stringify(config)); 
        return;
      }

      const { posts, totalPages } = await fetchPosts(config, 1);
      sessionStorage.setItem(WP_CONFIG_KEY, JSON.stringify(config));
      dispatch({ type: 'CONFIGURE_SUCCESS', payload: { config, posts, totalPages } });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err instanceof Error ? err.message : 'An unknown error occurred' });
    }
  }, []);

  const retryConnection = useCallback(async () => {
    const cachedConfig = sessionStorage.getItem(WP_CONFIG_KEY);
    if (cachedConfig) {
      const config = JSON.parse(cachedConfig);
      if (config.url && config.username && config.appPassword) {
        await connectToWordPress(config);
      } else {
        dispatch({ type: 'SET_ERROR', payload: 'Cached credentials incomplete. Please re-enter.' });
        dispatch({ type: 'SET_SETUP_REQUIRED', payload: false });
      }
    } else {
      dispatch({ type: 'SET_ERROR', payload: 'No connection details to retry. Please start over.' });
      dispatch({ type: 'RESET' });
    }
  }, [connectToWordPress]);

  const loadMorePosts = useCallback(async () => {
    if (!state.wpConfig || state.isLoadingMore || state.currentPage >= state.totalPages) return;
    dispatch({ type: 'LOAD_MORE_START' });
    try {
        const nextPage = state.currentPage + 1;
        const { posts } = await fetchPosts(state.wpConfig, nextPage);
        dispatch({ type: 'LOAD_MORE_SUCCESS', payload: { posts, currentPage: nextPage } });
    } catch (err) {
        dispatch({ type: 'SET_ERROR', payload: err instanceof Error ? err.message : 'Failed to load more posts' });
    }
  }, [state.wpConfig, state.isLoadingMore, state.currentPage, state.totalPages]);
  
  const deleteSnippet = useCallback(async (postId: number, toolId?: number) => {
    if (!state.wpConfig) return;
    const postToDeleteFrom = state.posts.find(p => p.id === postId);

    if (!postToDeleteFrom || typeof postToDeleteFrom.content.raw !== 'string') {
        const errorMsg = "Could not delete quiz: Raw post content is not available. Please try reloading the dashboard.";
        dispatch({ type: 'SET_ERROR', payload: errorMsg });
        console.error(errorMsg, { post: postToDeleteFrom });
        return;
    }

    dispatch({ type: 'START_DELETING_SNIPPET', payload: postId });
    try {
        let newContent = postToDeleteFrom.content.raw;
        newContent = newContent.replace(SHORTCODE_REMOVAL_REGEX, '');
        newContent = newContent.replace(/(\r\n|\n|\r){2,}/g, '\n').trim();

        await updatePost(state.wpConfig, postId, newContent);
        if (toolId) {
            await deleteCfTool(state.wpConfig, toolId);
        }
        const { posts } = await fetchPosts(state.wpConfig, 1);
        dispatch({ type: 'DELETE_SNIPPET_COMPLETE', payload: { posts } });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err instanceof Error ? err.message : 'Failed to delete snippet' });
    }
  }, [state.wpConfig, state.posts]);

  // --- AI PROVIDER ACTIONS ---
  const setProvider = useCallback((provider: AiProvider) => {
    dispatch({ type: 'SET_PROVIDER', payload: provider });
  }, []);

  const setApiKey = useCallback((provider: AiProvider, key: string) => {
    dispatch({ type: 'SET_API_KEY', payload: { provider, key } });
  }, []);

  const setOpenRouterModel = useCallback((model: string) => {
    dispatch({ type: 'SET_OPENROUTER_MODEL', payload: model });
  }, []);

  const validateAndSaveApiKey = useCallback(async (provider: AiProvider) => {
    dispatch({ type: 'VALIDATE_API_KEY_START', payload: provider });
    const key = state.apiKeys[provider];
    const model = state.openRouterModel;
    const isValid = await validateApiKey(provider, key, model);
    dispatch({ type: 'VALIDATE_API_KEY_RESULT', payload: { provider, isValid } });

    if (isValid) {
      const newConfig = {
        selectedProvider: provider,
        apiKeys: { ...state.apiKeys, [provider]: key },
        openRouterModel: state.openRouterModel,
      };
      localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(newConfig));
    }
  }, [state.apiKeys, state.openRouterModel]);
  
  // Effect to save AI config changes to local storage
  useEffect(() => {
    const aiConfig = {
      selectedProvider: state.selectedProvider,
      apiKeys: state.apiKeys,
      openRouterModel: state.openRouterModel,
    };
    localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(aiConfig));
  }, [state.selectedProvider, state.apiKeys, state.openRouterModel]);

  // --- ANALYTICS MODAL ACTIONS ---
  const openAnalyticsModal = useCallback((toolId: number) => {
    dispatch({ type: 'OPEN_ANALYTICS_MODAL', payload: toolId });
  }, []);

  const closeAnalyticsModal = useCallback(() => {
    dispatch({ type: 'CLOSE_ANALYTICS_MODAL' });
  }, []);

  // --- TOOL MODAL ACTIONS ---
  const beginToolCreation = useCallback((post: WordPressPost) => {
    dispatch({ type: 'OPEN_TOOL_MODAL', payload: post });
  }, []);
  
  const closeToolGenerationModal = useCallback(() => {
    dispatch({ type: 'CLOSE_TOOL_MODAL' });
  }, []);

  const generateIdeasForModal = useCallback(async () => {
    if (!state.activePostForModal) return;
    dispatch({ type: 'SET_MODAL_STATUS', payload: { status: 'loading' } });
    try {
      const { title, content } = state.activePostForModal;
      const contentForAnalysis = content.raw || content.rendered;
      const ideas = await suggestToolIdeas(state, title.rendered, contentForAnalysis);
      dispatch({ type: 'GET_IDEAS_SUCCESS', payload: ideas });
    } catch (err) {
      dispatch({ type: 'SET_MODAL_STATUS', payload: { status: 'error', error: err instanceof Error ? err.message : 'Failed to generate ideas' } });
    }
  }, [state]);
  
  const selectIdea = useCallback((idea: ToolIdea) => dispatch({ type: 'SELECT_IDEA', payload: idea }), []);

  const generateEnhancedQuizForModal = useCallback(async (strategy: OptimizationStrategy) => {
    if (!state.activePostForModal || !state.selectedIdea) return;
    dispatch({ type: 'GENERATE_ENHANCED_QUIZ_START' });
    try {
      const { title, content } = state.activePostForModal;
      const contentForAnalysis = content.raw || content.rendered;
      
      // Step 1: Generate quiz data and get grounding metadata
      const quizResult = await generateQuizAndMetadata(state, title.rendered, contentForAnalysis, state.selectedIdea, strategy, state.posts);
      
      // Step 2: Create the HTML snippet from the quiz data and metadata
      const finalHtml = createQuizSnippet(quizResult, state.themeColor, state.theme);
      
      // Step 3: Generate the suggested content update
      const contentUpdate = await generateContentUpdate(state, title.rendered, state.selectedIdea.title);

      dispatch({ type: 'GENERATE_ENHANCED_QUIZ_SUCCESS', payload: { quizHtml: finalHtml, contentUpdate } });
    } catch (err) {
      dispatch({ type: 'SET_MODAL_STATUS', payload: { status: 'error', error: err instanceof Error ? err.message : 'Failed to generate snippet' } });
    }
  }, [state]);

  const insertSnippet = useCallback(async (placement: Placement) => {
    if (!state.wpConfig || !state.activePostForModal || !state.generatedQuizHtml || !state.selectedIdea) return;

    if (typeof state.activePostForModal.content.raw !== 'string') {
        const errorMsg = "Could not insert quiz: Raw post content is not available for editing.";
        dispatch({ type: 'SET_MODAL_STATUS', payload: { status: 'error', error: errorMsg } });
        console.error(errorMsg, { post: state.activePostForModal });
        return;
    }

    dispatch({ type: 'SET_MODAL_STATUS', payload: { status: 'loading' } });
    try {
        const { id: newToolId } = await createCfTool(state.wpConfig, state.selectedIdea.title, state.generatedQuizHtml);
        const shortcode = `[contentforge_tool id="${newToolId}"]`;

        if (placement === 'manual') {
            dispatch({ type: 'INSERT_MANUAL_SUCCESS', payload: shortcode });
            const { posts } = await fetchPosts(state.wpConfig, 1);
            dispatch({ type: 'SET_POSTS', payload: posts });
            return;
        }

        const originalContent = state.activePostForModal.content.raw;
        let cleanedContent = originalContent.replace(SHORTCODE_REMOVAL_REGEX, '').trim();
        let finalContent;
        const shortcodeBlock = `\n\n${shortcode}\n\n`;

        if (placement === 'ai') {
            const lastHeadingRegex = /(<!--\s*wp:heading(?:.|\n)*?<!--\s*\/wp:heading\s*-->|<\s*h[23][^>]*>(?:.|\n)*?<\/\s*h[23]\s*>)/gi;
            let lastMatch: RegExpExecArray | null = null;
            let currentMatch: RegExpExecArray | null;
            while ((currentMatch = lastHeadingRegex.exec(cleanedContent)) !== null) {
                lastMatch = currentMatch;
            }
            if (lastMatch && typeof lastMatch.index === 'number') {
                const insertionPoint = lastMatch.index;
                const contentBefore = cleanedContent.substring(0, insertionPoint);
                const contentAfter = cleanedContent.substring(insertionPoint);
                finalContent = `${contentBefore.trim()}${shortcodeBlock}${contentAfter.trim()}`;
            } else {
                finalContent = cleanedContent + shortcodeBlock;
            }
        } else { // 'end' placement
            finalContent = cleanedContent + shortcodeBlock;
        }
        
        await updatePost(state.wpConfig, state.activePostForModal.id, finalContent.trim());
        const { posts, totalPages } = await fetchPosts(state.wpConfig, 1);
        dispatch({ type: 'CONFIGURE_SUCCESS', payload: { config: state.wpConfig, posts, totalPages } });
        dispatch({ type: 'INSERT_SNIPPET_SUCCESS' });

    } catch (err) {
        dispatch({ type: 'SET_MODAL_STATUS', payload: { status: 'error', error: err instanceof Error ? err.message : 'Failed to insert snippet' } });
    }
  }, [state]);

  const setThemeColor = useCallback((color: string) => dispatch({ type: 'SET_THEME_COLOR', payload: color }), []);
  const setPostSearchQuery = useCallback((query: string) => dispatch({ type: 'SET_POST_SEARCH_QUERY', payload: query }), []);
  const setPostFilter = useCallback((filter: PostFilter) => dispatch({ type: 'SET_POST_FILTER', payload: filter }), []);
  const setTheme = useCallback((theme: Theme) => dispatch({ type: 'SET_THEME', payload: theme }), []);

  const value = useMemo(() => ({
    state,
    connectToWordPress,
    retryConnection,
    reset,
    setTheme,
    setProvider,
    setApiKey,
    setOpenRouterModel,
    validateAndSaveApiKey,
    setPostSearchQuery,
    setPostFilter,
    deleteSnippet,
    loadMorePosts,
    openAnalyticsModal,
    closeAnalyticsModal,
    beginToolCreation,
    closeToolGenerationModal,
    generateIdeasForModal,
    selectIdea,
    generateEnhancedQuizForModal,
    insertSnippet,
    setThemeColor,
  }), [
    state, 
    connectToWordPress, 
    retryConnection,
    reset,
    setTheme,
    setProvider,
    setApiKey,
    setOpenRouterModel,
    validateAndSaveApiKey,
    setPostSearchQuery,
    setPostFilter,
    deleteSnippet,
    loadMorePosts,
    openAnalyticsModal,
    closeAnalyticsModal,
    beginToolCreation,
    closeToolGenerationModal,
    generateIdeasForModal,
    selectIdea,
    generateEnhancedQuizForModal,
    insertSnippet,
    setThemeColor
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppContextProvider');
  }
  return context;
};
