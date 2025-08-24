import React, { createContext, useReducer, useContext, useCallback, useMemo, useEffect } from 'react';
import { AppState, WordPressConfig, WordPressPost, ToolIdea, AiProvider, ApiKeys, ApiValidationStatuses, ApiValidationStatus, Theme, ApiValidationErrorMessages, Status } from '../types';
import { fetchPosts, updatePost, checkSetup, createCfTool, deleteCfTool } from '../services/wordpressService';
import { validateApiKey, suggestToolIdeas, insertShortcodeIntoContent, generateHtmlSnippetStream } from '../services/aiService';
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
  | { type: 'INSERT_SNIPPET_SUCCESS' };

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
  setupRequired: false,
  // Modal State
  isToolGenerationModalOpen: false,
  activePostForModal: null,
  modalStatus: 'idle',
  modalError: null,
  toolIdeas: [],
  selectedIdea: null,
  generatedSnippet: '',
  themeColor: '#3b82f6',
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
        setupRequired: false,
      };
    case 'SET_POSTS':
      const filtered = action.payload.filter(post => post.title.rendered.toLowerCase().includes(state.postSearchQuery.toLowerCase()));
      return { ...state, posts: action.payload, filteredPosts: filtered };
    case 'START_DELETING_SNIPPET':
        return { ...state, status: 'loading', deletingPostId: action.payload, error: null };
    case 'DELETE_SNIPPET_COMPLETE':
        const filteredAfterDelete = action.payload.posts.filter(post => post.title.rendered.toLowerCase().includes(state.postSearchQuery.toLowerCase()));
        return {
            ...state,
            status: 'idle',
            deletingPostId: null,
            posts: action.payload.posts,
            filteredPosts: filteredAfterDelete,
        };
    case 'SET_POST_SEARCH_QUERY': {
        const query = action.payload.toLowerCase();
        const filteredPosts = state.posts.filter(post => post.title.rendered.toLowerCase().includes(query));
        return { ...state, postSearchQuery: action.payload, filteredPosts };
    }
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
    // Modal Reducers
    case 'OPEN_TOOL_MODAL':
      return { ...state, isToolGenerationModalOpen: true, activePostForModal: action.payload };
    case 'CLOSE_TOOL_MODAL':
      return { ...state, isToolGenerationModalOpen: false, activePostForModal: null, toolIdeas: [], selectedIdea: null, generatedSnippet: '', modalStatus: 'idle', modalError: null };
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
  deleteSnippet: (postId: number, toolId?: number) => Promise<void>;
  // Tool Generation Modal Actions
  beginToolCreation: (post: WordPressPost) => void;
  closeToolGenerationModal: () => void;
  generateIdeasForModal: () => Promise<void>;
  selectIdea: (idea: ToolIdea) => void;
  generateSnippetForModal: () => Promise<void>;
  insertSnippet: () => Promise<void>;
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
          dispatch({ type: 'SET_POSTS', payload: posts });
          dispatch({ type: 'SET_MODAL_STATUS', payload: { status: 'idle' } });
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
    if (!postToDeleteFrom) return;
    dispatch({ type: 'START_DELETING_SNIPPET', payload: postId });
    try {
        if (!SHORTCODE_DETECTION_REGEX.test(postToDeleteFrom.content.rendered)) {
             throw new Error("Tool shortcode not found in post content.");
        }
        const newContent = postToDeleteFrom.content.rendered.replace(SHORTCODE_REMOVAL_REGEX, '');
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

  // --- MODAL ACTIONS ---
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
      const ideas = await suggestToolIdeas(state, title.rendered, content.rendered);
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
      const stream = generateHtmlSnippetStream(state, title.rendered, content.rendered, state.selectedIdea, state.themeColor);
      for await (const chunk of stream) {
        dispatch({ type: 'GENERATE_SNIPPET_CHUNK', payload: chunk });
      }
    } catch (err) {
      dispatch({ type: 'SET_MODAL_STATUS', payload: { status: 'error', error: err instanceof Error ? err.message : 'Failed to generate snippet' } });
    } finally {
      dispatch({ type: 'GENERATE_SNIPPET_COMPLETE' });
    }
  }, [state]);

  const insertSnippet = useCallback(async () => {
    if (!state.wpConfig || !state.activePostForModal || !state.generatedSnippet || !state.selectedIdea) return;
    dispatch({ type: 'SET_MODAL_STATUS', payload: { status: 'loading' } });
    try {
      const { id: newToolId } = await createCfTool(state.wpConfig, state.selectedIdea.title, state.generatedSnippet);
      const shortcode = `[contentforge_tool id="${newToolId}"]`;
      const newContent = await insertShortcodeIntoContent(state, state.activePostForModal.content.rendered, shortcode);
      await updatePost(state.wpConfig, state.activePostForModal.id, newContent);
      
      const newPosts = await fetchPosts(state.wpConfig);
      dispatch({ type: 'SET_POSTS', payload: newPosts });
      dispatch({ type: 'INSERT_SNIPPET_SUCCESS' });
    } catch (err) {
      dispatch({ type: 'SET_MODAL_STATUS', payload: { status: 'error', error: err instanceof Error ? err.message : 'Failed to insert snippet' } });
    }
  }, [state]);

  const setThemeColor = useCallback((color: string) => dispatch({ type: 'SET_THEME_COLOR', payload: color }), []);
  const setPostSearchQuery = useCallback((query: string) => dispatch({ type: 'SET_POST_SEARCH_QUERY', payload: query }), []);
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
    deleteSnippet,
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
    deleteSnippet,
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
