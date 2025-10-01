import React, { createContext, useReducer, useContext, useCallback, useMemo, useEffect } from 'react';
import { AppState, WordPressConfig, WordPressPost, ToolIdea, AiProvider, ApiKeys, ApiValidationStatuses, ApiValidationStatus, Theme, ApiValidationErrorMessages, Status, Placement, PostFilter } from '../types';
import { fetchPosts, updatePost, checkSetup, createCfTool, deleteCfTool } from '../services/wordpressService';
import { validateApiKey, suggestToolIdeas, generateHtmlSnippetStream } from '../services/aiService';
import { SHORTCODE_DETECTION_REGEX, SHORTCODE_REMOVAL_REGEX } from '../constants';

type Action =
  | { type: 'RESET' }
  | { type: 'START_LOADING'; payload?: 'posts' | 'delete' }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'SET_SETUP_REQUIRED'; payload: boolean }
  | { type: 'CONFIGURE_SUCCESS'; payload: { config: WordPressConfig; posts: WordPressPost[] } }
  | { type: 'START_DELETING_SNIPPET'; payload: number }
  | { type: 'DELETE_SNIPPET_COMPLETE'; payload: { posts: WordPressPost[] } }
  | { type: 'SET_POSTS'; payload: WordPressPost[] }
  | { type: 'SET_POST_SEARCH_QUERY', payload: string }
  | { type: 'SET_POST_FILTER', payload: PostFilter }
  | { type: 'SET_PROVIDER', payload: AiProvider }
  | { type: 'SET_API_KEY', payload: { provider: AiProvider, key: string } }
  | { type: 'SET_OPENROUTER_MODEL', payload: string }
  | { type: 'SET_VALIDATION_STATUS', payload: { provider: AiProvider, status: ApiValidationStatus } }
  | { type: 'SET_THEME'; payload: Theme }
  // Modal Actions
  | { type: 'OPEN_TOOL_MODAL', payload: WordPressPost }
  | { type: 'CLOSE_TOOL_MODAL' }
  | { type: 'SET_MODAL_STATUS', payload: { status: Status, error?: string | null } }
  | { type: 'GET_IDEAS_SUCCESS'; payload: ToolIdea[] }
  | { type: 'SELECT_IDEA'; payload: ToolIdea }
  | { type: 'SET_THEME_COLOR'; payload: string }
  | { type: 'GENERATE_SNIPPET_START' }
  | { type: 'GENERATE_SNIPPET_CHUNK'; payload: string }
  | { type: 'GENERATE_SNIPPET_COMPLETE' }
  | { type: 'INSERT_SNIPPET_SUCCESS' }
  | { type: 'INSERT_MANUAL_SUCCESS', payload: string }
  // Analytics Modal Actions
  | { type: 'OPEN_ANALYTICS_MODAL', payload: number }
  | { type: 'CLOSE_ANALYTICS_MODAL' };

const WP_CONFIG_KEY = 'wp_config';
const AI_CONFIG_KEY = 'ai_config';
const THEME_KEY = 'app_theme';

const initialApiKeys: ApiKeys = { gemini: '', openai: '', anthropic: '', openrouter: '' };
const initialValidationStatuses: ApiValidationStatuses = { gemini: 'idle', openai: 'idle', anthropic: 'idle', openrouter: 'idle' };
const initialApiValidationErrorMessages: ApiValidationErrorMessages = { gemini: null, openai: null, anthropic: null, openrouter: null };

const getInitialTheme = (): Theme => {
    if (typeof window === 'undefined') return 'light';
    const storedTheme = localStorage.getItem(THEME_KEY) as Theme | null;
    if (storedTheme) return storedTheme;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const initialState: AppState = {
  status: 'idle',
  error: null,
  deletingPostId: null,
  theme: getInitialTheme(),
  frameStatus: 'initializing',
  // AI State
  apiKeys: initialApiKeys,
  apiValidationStatuses: initialValidationStatuses,
  apiValidationErrorMessages: initialApiValidationErrorMessages,
  selectedProvider: AiProvider.Gemini,
  openRouterModel: '',
  // WP State
  wpConfig: null,
  posts: [],
  filteredPosts: [],
  postSearchQuery: '',
  postFilter: 'all',
  setupRequired: false,
  // Tool Modal State
  isToolGenerationModalOpen: false,
  activePostForModal: null,
  modalStatus: 'idle',
  modalError: null,
  toolIdeas: [],
  selectedIdea: null,
  generatedSnippet: '',
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
      return { ...initialState, apiKeys: state.apiKeys, apiValidationStatuses: state.apiValidationStatuses, selectedProvider: state.selectedProvider, openRouterModel: state.openRouterModel, theme: state.theme };
    case 'START_LOADING':
      return { ...state, status: 'loading', error: null, setupRequired: false };
    case 'SET_ERROR':
      return { ...state, status: 'error', error: action.payload, deletingPostId: null };
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
      };
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
    case 'SET_PROVIDER':
        return { ...state, selectedProvider: action.payload };
    case 'SET_API_KEY':
        return { ...state, apiKeys: { ...state.apiKeys, [action.payload.provider]: action.payload.key } };
    case 'SET_OPENROUTER_MODEL':
        return { ...state, openRouterModel: action.payload };
    case 'SET_VALIDATION_STATUS':
        return { ...state, apiValidationStatuses: { ...state.apiValidationStatuses, [action.payload.provider]: action.payload.status }};
    case 'SET_THEME':
        return { ...state, theme: action.payload };
    // Tool Modal Reducers
    case 'OPEN_TOOL_MODAL':
      return { ...state, isToolGenerationModalOpen: true, activePostForModal: action.payload };
    case 'CLOSE_TOOL_MODAL':
      return { ...state, isToolGenerationModalOpen: false, activePostForModal: null, toolIdeas: [], selectedIdea: null, generatedSnippet: '', modalStatus: 'idle', modalError: null, manualShortcode: null };
    case 'SET_MODAL_STATUS':
      return { ...state, modalStatus: action.payload.status, modalError: action.payload.error || null };
    case 'GET_IDEAS_SUCCESS':
      return { ...state, modalStatus: 'idle', toolIdeas: action.payload };
    case 'SELECT_IDEA':
      return { ...state, selectedIdea: action.payload };
    case 'SET_THEME_COLOR':
      return { ...state, themeColor: action.payload };
    case 'GENERATE_SNIPPET_START':
      return { ...state, modalStatus: 'loading', generatedSnippet: '', modalError: null };
    case 'GENERATE_SNIPPET_CHUNK':
      return { ...state, generatedSnippet: state.generatedSnippet + action.payload };
    case 'GENERATE_SNIPPET_COMPLETE':
      return { ...state, modalStatus: 'idle' };
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
  // Provider/API Key Management
  setProvider: (provider: AiProvider) => void;
  setApiKey: (provider: AiProvider, key: string) => void;
  setOpenRouterModel: (model: string) => void;
  validateAndSaveApiKey: (provider: AiProvider) => Promise<void>;
  // Post Dashboard Actions
  setPostSearchQuery: (query: string) => void;
  setPostFilter: (filter: PostFilter) => void;
  deleteSnippet: (postId: number, toolId?: number) => Promise<void>;
  openAnalyticsModal: (toolId: number) => void;
  closeAnalyticsModal: () => void;
  // Tool Generation Modal Actions
  beginToolCreation: (post: WordPressPost) => void;
  closeToolGenerationModal: () => void;
  generateIdeasForModal: () => Promise<void>;
  selectIdea: (idea: ToolIdea) => void;
  generateSnippetForModal: () => Promise<void>;
  insertSnippet: (placement: Placement) => Promise<void>;
  setThemeColor: (color: string) => void;

} | null>(null);

export const AppContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState, (init) => {
    try {
      const cachedAiConfig = localStorage.getItem(AI_CONFIG_KEY);
      const aiConfig = cachedAiConfig ? JSON.parse(cachedAiConfig) : {};
      const cachedWpConfig = sessionStorage.getItem(WP_CONFIG_KEY);
      
      let wpState = {};
      if (cachedWpConfig) {
        wpState = { wpConfig: JSON.parse(cachedWpConfig) };
      }
       return {
          ...init,
          ...wpState,
          apiKeys: { ...initialApiKeys, ...aiConfig.apiKeys },
          selectedProvider: aiConfig.selectedProvider || AiProvider.Gemini,
          openRouterModel: aiConfig.openRouterModel || '',
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
      if (state.wpConfig) {
        dispatch({ type: 'START_LOADING' });
        try {
          const posts = await fetchPosts(state.wpConfig);
          dispatch({ type: 'CONFIGURE_SUCCESS', payload: { config: state.wpConfig, posts } });
        } catch(err) {
          dispatch({ type: 'SET_ERROR', payload: err instanceof Error ? err.message : 'Failed to fetch posts' });
        }
      }
    };
    fetchInitialPosts();
  }, [state.wpConfig?.url]); // refetch if url changes

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

      const posts = await fetchPosts(config);
      sessionStorage.setItem(WP_CONFIG_KEY, JSON.stringify(config));
      dispatch({ type: 'CONFIGURE_SUCCESS', payload: { config, posts } });
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
  
  const deleteSnippet = useCallback(async (postId: number, toolId?: number) => {
    if (!state.wpConfig) return;
    const postToDeleteFrom = state.posts.find(p => p.id === postId);

    // --- ROBUSTNESS CHECK ---
    // Ensure we have a post and its raw content to modify.
    if (!postToDeleteFrom || typeof postToDeleteFrom.content.raw !== 'string') {
        const errorMsg = "Could not delete quiz: Raw post content is not available. Please try reloading the dashboard.";
        dispatch({ type: 'SET_ERROR', payload: errorMsg });
        console.error(errorMsg, { post: postToDeleteFrom });
        return;
    }

    dispatch({ type: 'START_DELETING_SNIPPET', payload: postId });
    try {
        // --- FLAWLESS DELETION OVERHAUL ---
        // Exclusively operate on the raw post content for maximum reliability.
        let newContent = postToDeleteFrom.content.raw;
        
        // Pass 1: Surgically remove all instances of the shortcode.
        newContent = newContent.replace(SHORTCODE_REMOVAL_REGEX, '');

        // Pass 2: Clean up leftover empty lines. This prevents empty blocks from appearing
        // in the WordPress editor after the shortcode is removed. This regex handles
        // different newline characters and multiple blank lines, collapsing them.
        newContent = newContent.replace(/(\r\n|\n|\r){2,}/g, '\n').trim();

        await updatePost(state.wpConfig, postId, newContent);
        if (toolId) {
            await deleteCfTool(state.wpConfig, toolId);
        }
        const newPosts = await fetchPosts(state.wpConfig);
        dispatch({ type: 'DELETE_SNIPPET_COMPLETE', payload: { posts: newPosts } });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err instanceof Error ? err.message : 'Failed to delete snippet' });
    }
  }, [state.wpConfig, state.posts]);

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
      // Use raw content for better AI analysis if available, otherwise fall back to rendered.
      const contentForAnalysis = content.raw || content.rendered;
      const ideas = await suggestToolIdeas(state, title.rendered, contentForAnalysis);
      dispatch({ type: 'GET_IDEAS_SUCCESS', payload: ideas });
    } catch (err) {
      dispatch({ type: 'SET_MODAL_STATUS', payload: { status: 'error', error: err instanceof Error ? err.message : 'Failed to generate ideas' } });
    }
  }, [state]);
  
  const selectIdea = useCallback((idea: ToolIdea) => dispatch({ type: 'SELECT_IDEA', payload: idea }), []);

  const generateSnippetForModal = useCallback(async () => {
    if (!state.activePostForModal || !state.selectedIdea) return;
    dispatch({ type: 'GENERATE_SNIPPET_START' });
    try {
      const { title, content } = state.activePostForModal;
      // Use raw content for better AI analysis if available, otherwise fall back to rendered.
      const contentForAnalysis = content.raw || content.rendered;
      const stream = generateHtmlSnippetStream(state, title.rendered, contentForAnalysis, state.selectedIdea, state.themeColor);
      for await (const chunk of stream) {
        dispatch({ type: 'GENERATE_SNIPPET_CHUNK', payload: chunk });
      }
    } catch (err) {
      dispatch({ type: 'SET_MODAL_STATUS', payload: { status: 'error', error: err instanceof Error ? err.message : 'Failed to generate snippet' } });
    } finally {
      dispatch({ type: 'GENERATE_SNIPPET_COMPLETE' });
    }
  }, [state]);

  const insertSnippet = useCallback(async (placement: Placement) => {
    if (!state.wpConfig || !state.activePostForModal || !state.generatedSnippet || !state.selectedIdea) return;

    // --- ROBUSTNESS CHECK ---
    // Ensure we have raw content to modify.
    if (typeof state.activePostForModal.content.raw !== 'string') {
        const errorMsg = "Could not insert quiz: Raw post content is not available for editing.";
        dispatch({ type: 'SET_MODAL_STATUS', payload: { status: 'error', error: errorMsg } });
        console.error(errorMsg, { post: state.activePostForModal });
        return;
    }

    dispatch({ type: 'SET_MODAL_STATUS', payload: { status: 'loading' } });
    try {
        // Step 1: Create the cf_tool post to get an ID.
        const { id: newToolId } = await createCfTool(state.wpConfig, state.selectedIdea.title, state.generatedSnippet);
        const shortcode = `[contentforge_tool id="${newToolId}"]`;

        if (placement === 'manual') {
            dispatch({ type: 'INSERT_MANUAL_SUCCESS', payload: shortcode });
            const newPosts = await fetchPosts(state.wpConfig);
            dispatch({ type: 'SET_POSTS', payload: newPosts });
            return;
        }

        // Step 2: Prepare the RAW post content with surgical precision.
        const originalContent = state.activePostForModal.content.raw;
        
        // Clean any pre-existing shortcodes to prevent duplicates.
        let cleanedContent = originalContent.replace(SHORTCODE_REMOVAL_REGEX, '').trim();

        let finalContent;
        // Wrap shortcode in newlines to ensure it's treated as a distinct block by WordPress.
        const shortcodeBlock = `\n\n${shortcode}\n\n`;

        if (placement === 'ai') {
            // AI-Suggested Placement: Insert before the last H2 or H3 heading in the RAW content.
            // This regex robustly finds either a Gutenberg block OR a raw HTML heading tag.
            const lastHeadingRegex = /(<!--\s*wp:heading(?:.|\n)*?<!--\s*\/wp:heading\s*-->|<\s*h[23][^>]*>(?:.|\n)*?<\/\s*h[23]\s*>)/gi;
            
            let lastMatch: RegExpExecArray | null = null;
            let currentMatch: RegExpExecArray | null;

            // Loop through all matches to find the very last one.
            while ((currentMatch = lastHeadingRegex.exec(cleanedContent)) !== null) {
                lastMatch = currentMatch;
            }
            
            if (lastMatch && typeof lastMatch.index === 'number') {
                const insertionPoint = lastMatch.index;
                const contentBefore = cleanedContent.substring(0, insertionPoint);
                const contentAfter = cleanedContent.substring(insertionPoint);
                finalContent = `${contentBefore.trim()}${shortcodeBlock}${contentAfter.trim()}`;
            } else {
                // Fallback to end of post if no suitable heading is found.
                finalContent = cleanedContent + shortcodeBlock;
            }
        } else { // 'end' placement
            finalContent = cleanedContent + shortcodeBlock;
        }
        
        await updatePost(state.wpConfig, state.activePostForModal.id, finalContent.trim());
        
        const newPosts = await fetchPosts(state.wpConfig);
        dispatch({ type: 'SET_POSTS', payload: newPosts });
        dispatch({ type: 'INSERT_SNIPPET_SUCCESS' });

    } catch (err) {
        dispatch({ type: 'SET_MODAL_STATUS', payload: { status: 'error', error: err instanceof Error ? err.message : 'Failed to insert snippet' } });
    }
  }, [state]);

  const setThemeColor = useCallback((color: string) => dispatch({ type: 'SET_THEME_COLOR', payload: color }), []);
  const setPostSearchQuery = useCallback((query: string) => dispatch({ type: 'SET_POST_SEARCH_QUERY', payload: query }), []);
  const setPostFilter = useCallback((filter: PostFilter) => dispatch({ type: 'SET_POST_FILTER', payload: filter }), []);
  const setProvider = useCallback((provider: AiProvider) => dispatch({type: 'SET_PROVIDER', payload: provider}), []);
  const setApiKey = useCallback((provider: AiProvider, key: string) => {
      dispatch({type: 'SET_API_KEY', payload: { provider, key }});
      if (state.apiValidationStatuses[provider] === 'valid') {
          dispatch({type: 'SET_VALIDATION_STATUS', payload: { provider, status: 'idle' }});
      }
  }, [state.apiValidationStatuses]);
  const setOpenRouterModel = useCallback((model: string) => dispatch({type: 'SET_OPENROUTER_MODEL', payload: model}), []);
  const saveAiConfigToLocalStorage = useCallback(() => {
    localStorage.setItem(AI_CONFIG_KEY, JSON.stringify({
        apiKeys: state.apiKeys,
        selectedProvider: state.selectedProvider,
        openRouterModel: state.openRouterModel,
    }));
  }, [state.apiKeys, state.selectedProvider, state.openRouterModel]);
  const validateAndSaveApiKey = useCallback(async (provider: AiProvider) => {
    dispatch({ type: 'SET_VALIDATION_STATUS', payload: { provider, status: 'validating' } });
    const isValid = await validateApiKey(provider, state.apiKeys[provider], state.openRouterModel);
    dispatch({ type: 'SET_VALIDATION_STATUS', payload: { provider, status: isValid ? 'valid' : 'invalid' } });
    if (isValid) saveAiConfigToLocalStorage();
  }, [state.apiKeys, state.openRouterModel, saveAiConfigToLocalStorage]);
  const setTheme = useCallback((theme: Theme) => dispatch({ type: 'SET_THEME', payload: theme }), []);
  
  useEffect(() => {
    saveAiConfigToLocalStorage();
  }, [state.apiKeys, state.selectedProvider, state.openRouterModel, saveAiConfigToLocalStorage]);

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
    openAnalyticsModal,
    closeAnalyticsModal,
    beginToolCreation,
    closeToolGenerationModal,
    generateIdeasForModal,
    selectIdea,
    generateSnippetForModal,
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
    openAnalyticsModal,
    closeAnalyticsModal,
    beginToolCreation,
    closeToolGenerationModal,
    generateIdeasForModal,
    selectIdea,
    generateSnippetForModal,
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