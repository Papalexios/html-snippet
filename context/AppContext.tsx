import React, { createContext, useReducer, useContext, useCallback, useMemo, useEffect } from 'react';
import { AppState, Step, WordPressConfig, WordPressPost, ToolIdea, AiProvider, ApiKeys, ApiValidationStatuses, ApiValidationStatus, Theme } from '../types';
import { fetchPosts, updatePost, checkSetup, createCfTool, deleteCfTool } from '../services/wordpressService';
import { validateApiKey, suggestToolIdeas, insertShortcodeIntoContent, generateHtmlSnippetStream } from '../services/aiService';
import { SHORTCODE_DETECTION_REGEX, SHORTCODE_REMOVAL_REGEX } from '../constants';

type Action =
  | { type: 'RESET' }
  | { type: 'RESET_TO_ANALYZE' }
  | { type: 'START_LOADING'; payload?: 'ideas' | 'snippet' | 'insert' }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'SET_SETUP_REQUIRED'; payload: boolean }
  | { type: 'CONFIGURE_SUCCESS'; payload: { config: WordPressConfig; posts: WordPressPost[] } }
  | { type: 'SELECT_POST'; payload: WordPressPost }
  | { type: 'GET_IDEAS_SUCCESS'; payload: ToolIdea[] }
  | { type: 'SELECT_IDEA'; payload: ToolIdea }
  | { type: 'SET_THEME_COLOR'; payload: string }
  | { type: 'GENERATE_SNIPPET_START' }
  | { type: 'GENERATE_SNIPPET_CHUNK'; payload: string }
  | { type: 'GENERATE_SNIPPET_COMPLETE' }
  | { type: 'INSERT_SNIPPET_SUCCESS'; payload: { posts: WordPressPost[]; updatedPost: WordPressPost } }
  | { type: 'START_DELETING_SNIPPET'; payload: number }
  | { type: 'DELETE_SNIPPET_COMPLETE'; payload: { posts: WordPressPost[] } }
  | { type: 'SET_POST_SEARCH_QUERY', payload: string }
  | { type: 'SET_PROVIDER', payload: AiProvider }
  | { type: 'SET_API_KEY', payload: { provider: AiProvider, key: string } }
  | { type: 'SET_OPENROUTER_MODEL', payload: string }
  | { type: 'SET_VALIDATION_STATUS', payload: { provider: AiProvider, status: ApiValidationStatus } }
  | { type: 'SET_THEME'; payload: Theme };


const WP_CONFIG_KEY = 'wp_config';
const WP_POSTS_KEY = 'wp_posts';
const AI_CONFIG_KEY = 'ai_config';
const THEME_KEY = 'app_theme';

const initialApiKeys: ApiKeys = { gemini: '', openai: '', anthropic: '', openrouter: '' };
const initialValidationStatuses: ApiValidationStatuses = { gemini: 'idle', openai: 'idle', anthropic: 'idle', openrouter: 'idle' };

const getInitialTheme = (): Theme => {
    if (typeof window === 'undefined') return 'light';
    const storedTheme = localStorage.getItem(THEME_KEY) as Theme | null;
    if (storedTheme) return storedTheme;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};


const initialState: AppState = {
  currentStep: Step.Configure,
  status: 'idle',
  error: null,
  deletingPostId: null,
  theme: getInitialTheme(),
  // AI State
  apiKeys: initialApiKeys,
  apiValidationStatuses: initialValidationStatuses,
  selectedProvider: AiProvider.Gemini,
  openRouterModel: '',
  // WP State
  wpConfig: null,
  posts: [],
  filteredPosts: [],
  postSearchQuery: '',
  selectedPost: null,
  setupRequired: false,
  // Generation State
  toolIdeas: [],
  selectedIdea: null,
  generatedSnippet: '',
  themeColor: '#3b82f6',
};

const appReducer = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    case 'RESET':
      sessionStorage.removeItem(WP_POSTS_KEY);
      sessionStorage.removeItem(WP_CONFIG_KEY);
      // Keep API keys and theme on reset
      return { ...initialState, apiKeys: state.apiKeys, apiValidationStatuses: state.apiValidationStatuses, selectedProvider: state.selectedProvider, openRouterModel: state.openRouterModel, theme: state.theme };
    case 'RESET_TO_ANALYZE':
      return {
        ...state,
        currentStep: Step.Analyze,
        status: 'idle',
        error: null,
        deletingPostId: null,
        selectedPost: null,
        toolIdeas: [],
        selectedIdea: null,
        generatedSnippet: '',
      };
    case 'START_LOADING':
      return { ...state, status: 'loading', error: null, setupRequired: false };
    case 'SET_ERROR':
      return { ...state, status: 'error', error: action.payload, deletingPostId: null };
    case 'SET_SETUP_REQUIRED':
      return { ...state, status: 'error', setupRequired: action.payload };
    case 'CONFIGURE_SUCCESS':
      return {
        ...state,
        status: 'idle',
        currentStep: Step.Analyze,
        wpConfig: action.payload.config,
        posts: action.payload.posts,
        filteredPosts: action.payload.posts,
        setupRequired: false,
      };
    case 'SELECT_POST':
      return { ...state, selectedPost: action.payload, toolIdeas: [], generatedSnippet: '' };
    case 'GET_IDEAS_SUCCESS':
      return { ...state, status: 'idle', toolIdeas: action.payload };
    case 'SELECT_IDEA':
      return { ...state, selectedIdea: action.payload, currentStep: Step.Generate };
    case 'SET_THEME_COLOR':
        return { ...state, themeColor: action.payload };
    case 'GENERATE_SNIPPET_START':
        return { ...state, status: 'loading', generatedSnippet: '', error: null };
    case 'GENERATE_SNIPPET_CHUNK':
        return { ...state, generatedSnippet: state.generatedSnippet + action.payload };
    case 'GENERATE_SNIPPET_COMPLETE':
        return { ...state, status: 'idle' };
    case 'INSERT_SNIPPET_SUCCESS':
        const filteredAfterInsert = action.payload.posts.filter(post => post.title.rendered.toLowerCase().includes(state.postSearchQuery.toLowerCase()));
        return { 
            ...state, 
            status: 'success',
            posts: action.payload.posts,
            filteredPosts: filteredAfterInsert,
            selectedPost: action.payload.updatedPost,
        };
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
            selectedPost: state.selectedPost?.id === state.deletingPostId ? null : state.selectedPost,
            toolIdeas: state.selectedPost?.id === state.deletingPostId ? [] : state.toolIdeas,
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
    default:
      return state;
  }
};

const AppContext = createContext<{
  state: AppState;
  connectToWordPress: (config: WordPressConfig) => Promise<void>;
  selectPost: (post: WordPressPost) => Promise<void>;
  selectIdea: (idea: ToolIdea) => void;
  setThemeColor: (color: string) => void;
  generateSnippet: () => Promise<void>;
  insertSnippet: () => Promise<void>;
  deleteSnippet: (postId: number, toolId?: number) => Promise<void>;
  setPostSearchQuery: (query: string) => void;
  reset: () => void;
  resetToAnalyze: () => void;
  setProvider: (provider: AiProvider) => void;
  setApiKey: (provider: AiProvider, key: string) => void;
  setOpenRouterModel: (model: string) => void;
  validateAndSaveApiKey: (provider: AiProvider) => Promise<void>;
  setTheme: (theme: Theme) => void;
} | null>(null);

export const AppContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState, (init) => {
    try {
      // Load AI config from localStorage (persistent)
      const cachedAiConfig = localStorage.getItem(AI_CONFIG_KEY);
      const aiConfig = cachedAiConfig ? JSON.parse(cachedAiConfig) : {};

      // Load WP config from sessionStorage (session-only)
      const cachedWpConfig = sessionStorage.getItem(WP_CONFIG_KEY);
      const cachedPosts = sessionStorage.getItem(WP_POSTS_KEY);
      
      let wpState = {};
      if (cachedWpConfig && cachedPosts) {
        const config = JSON.parse(cachedWpConfig);
        const posts = JSON.parse(cachedPosts);
        wpState = {
          currentStep: Step.Analyze,
          wpConfig: config,
          posts: posts,
          filteredPosts: posts,
        };
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
    }
    return { ...init, theme: getInitialTheme() };
  });
  
  // Effect to apply theme class to the root element
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(state.theme);
    localStorage.setItem(THEME_KEY, state.theme);
  }, [state.theme]);

  const reset = useCallback(() => dispatch({ type: 'RESET' }), []);
  const resetToAnalyze = useCallback(() => dispatch({ type: 'RESET_TO_ANALYZE' }), []);

  const connectToWordPress = useCallback(async (config: WordPressConfig) => {
    dispatch({ type: 'START_LOADING' });
    try {
      // First, check for setup readiness.
      const isSetup = await checkSetup(config);
      if (!isSetup) {
        dispatch({ type: 'SET_SETUP_REQUIRED', payload: true });
        dispatch({ type: 'SET_ERROR', payload: 'A one-time setup is required.' });
        // Store config so retry can use it
        sessionStorage.setItem(WP_CONFIG_KEY, JSON.stringify(config)); 
        return;
      }

      const posts = await fetchPosts(config);
      if (posts.length === 0) {
        dispatch({ type: 'SET_ERROR', payload: 'Connected successfully, but no posts were found.' });
      } else {
        sessionStorage.setItem(WP_CONFIG_KEY, JSON.stringify(config));
        sessionStorage.setItem(WP_POSTS_KEY, JSON.stringify(posts));
        dispatch({ type: 'CONFIGURE_SUCCESS', payload: { config, posts } });
      }
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err instanceof Error ? err.message : 'An unknown error occurred' });
    }
  }, []);

  const selectPost = useCallback(async (post: WordPressPost) => {
    dispatch({ type: 'SELECT_POST', payload: post });
    dispatch({ type: 'START_LOADING' });
    try {
      const ideas = await suggestToolIdeas(state, post.title.rendered, post.content.rendered);
      dispatch({ type: 'GET_IDEAS_SUCCESS', payload: ideas });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err instanceof Error ? err.message : 'Failed to generate ideas' });
    }
  }, [state]);
  
  const selectIdea = useCallback((idea: ToolIdea) => dispatch({ type: 'SELECT_IDEA', payload: idea }), []);

  const setThemeColor = useCallback((color: string) => dispatch({ type: 'SET_THEME_COLOR', payload: color }), []);
  
  const generateSnippet = useCallback(async () => {
    if (!state.selectedPost || !state.selectedIdea) return;
    dispatch({ type: 'GENERATE_SNIPPET_START' });
    try {
      const stream = generateHtmlSnippetStream(state, state.selectedPost.title.rendered, state.selectedPost.content.rendered, state.selectedIdea, state.themeColor);
      for await (const chunk of stream) {
        dispatch({ type: 'GENERATE_SNIPPET_CHUNK', payload: chunk });
      }
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err instanceof Error ? err.message : 'Failed to generate snippet' });
    } finally {
      dispatch({ type: 'GENERATE_SNIPPET_COMPLETE' });
    }
  }, [state]);

  const insertSnippet = useCallback(async () => {
    if (!state.wpConfig || !state.selectedPost || !state.generatedSnippet || !state.selectedIdea) return;
    dispatch({ type: 'START_LOADING' });
    try {
      // 1. Create the tool as a custom post, which returns the new tool's ID.
      const { id: newToolId } = await createCfTool(state.wpConfig, state.selectedIdea.title, state.generatedSnippet);
      
      // 2. Create the shortcode string.
      const shortcode = `[contentforge_tool id="${newToolId}"]`;

      // 3. Intelligently insert the shortcode into the main post's content.
      const newContent = await insertShortcodeIntoContent(state, state.selectedPost.content.rendered, shortcode);
      
      // 4. Update the main post.
      await updatePost(state.wpConfig, state.selectedPost.id, newContent);
      
      // 5. Fetch all posts again to refresh the entire UI state.
      const newPosts = await fetchPosts(state.wpConfig);
      const updatedPost = newPosts.find(p => p.id === state.selectedPost!.id)!;

      dispatch({ type: 'INSERT_SNIPPET_SUCCESS', payload: { posts: newPosts, updatedPost } });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err instanceof Error ? err.message : 'Failed to insert snippet' });
    }
  }, [state]);

  const deleteSnippet = useCallback(async (postId: number, toolId?: number) => {
    if (!state.wpConfig) return;
    
    const postToDeleteFrom = state.posts.find(p => p.id === postId);
    if (!postToDeleteFrom) return;

    dispatch({ type: 'START_DELETING_SNIPPET', payload: postId });

    try {
        let contentHasShortcode = SHORTCODE_DETECTION_REGEX.test(postToDeleteFrom.content.rendered);
        
        if (!contentHasShortcode) {
             throw new Error("Tool shortcode not found in post content. Deletion failed.");
        }
        
        // Remove all instances of the shortcode from the content using the robust regex.
        const newContent = postToDeleteFrom.content.rendered.replace(SHORTCODE_REMOVAL_REGEX, '');
        
        // Update the main blog post with the shortcode removed.
        await updatePost(state.wpConfig, postId, newContent);

        // If we have a toolId, delete the underlying cf_tool post.
        if (toolId) {
            await deleteCfTool(state.wpConfig, toolId);
        } else {
            console.warn(`Could not find a toolId for post ${postId}. The shortcode was removed, but the underlying tool post may still exist.`);
        }

        // Refresh the posts list.
        const newPosts = await fetchPosts(state.wpConfig);
        dispatch({ type: 'DELETE_SNIPPET_COMPLETE', payload: { posts: newPosts } });

    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err instanceof Error ? err.message : 'Failed to delete snippet' });
    }
  }, [state.wpConfig, state.posts]);

  const setPostSearchQuery = useCallback((query: string) => dispatch({ type: 'SET_POST_SEARCH_QUERY', payload: query }), []);
  
  const setProvider = useCallback((provider: AiProvider) => {
      dispatch({type: 'SET_PROVIDER', payload: provider});
  }, []);

  const setApiKey = useCallback((provider: AiProvider, key: string) => {
      dispatch({type: 'SET_API_KEY', payload: { provider, key }});
      if (state.apiValidationStatuses[provider] === 'valid') {
          dispatch({type: 'SET_VALIDATION_STATUS', payload: { provider, status: 'idle' }});
      }
  }, [state.apiValidationStatuses]);

  const setOpenRouterModel = useCallback((model: string) => {
      dispatch({type: 'SET_OPENROUTER_MODEL', payload: model});
  }, []);

  const saveAiConfigToLocalStorage = useCallback(() => {
    const configToSave = {
        apiKeys: state.apiKeys,
        selectedProvider: state.selectedProvider,
        openRouterModel: state.openRouterModel,
    };
    localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(configToSave));
  }, [state.apiKeys, state.selectedProvider, state.openRouterModel]);

  const validateAndSaveApiKey = useCallback(async (provider: AiProvider) => {
    dispatch({ type: 'SET_VALIDATION_STATUS', payload: { provider, status: 'validating' } });
    const apiKey = state.apiKeys[provider];
    const model = state.openRouterModel;

    const isValid = await validateApiKey(provider, apiKey, model);

    if (isValid) {
      dispatch({ type: 'SET_VALIDATION_STATUS', payload: { provider, status: 'valid' } });
      saveAiConfigToLocalStorage();
    } else {
      dispatch({ type: 'SET_VALIDATION_STATUS', payload: { provider, status: 'invalid' } });
    }
  }, [state.apiKeys, state.openRouterModel, saveAiConfigToLocalStorage]);
  
  const setTheme = useCallback((theme: Theme) => {
    dispatch({ type: 'SET_THEME', payload: theme });
  }, []);
  
  // Effect to save AI configuration to localStorage whenever it changes
  useEffect(() => {
    saveAiConfigToLocalStorage();
  }, [state.apiKeys, state.selectedProvider, state.openRouterModel, saveAiConfigToLocalStorage]);


  const value = useMemo(() => ({
    state,
    connectToWordPress,
    selectPost,
    selectIdea,
    setThemeColor,
    generateSnippet,
    insertSnippet,
    deleteSnippet,
    setPostSearchQuery,
    reset,
    resetToAnalyze,
    setProvider,
    setApiKey,
    setOpenRouterModel,
    validateAndSaveApiKey,
    setTheme,
  }), [
    state, 
    connectToWordPress, 
    selectPost, 
    selectIdea, 
    setThemeColor, 
    generateSnippet, 
    insertSnippet, 
    deleteSnippet, 
    setPostSearchQuery, 
    reset,
    resetToAnalyze,
    setProvider,
    setApiKey,
    setOpenRouterModel,
    validateAndSaveApiKey,
    setTheme
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