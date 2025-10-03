import React, { createContext, useContext, useReducer, useEffect, ReactNode, Dispatch } from 'react';
import { 
    AppState, AiProvider, WordPressConfig, WordPressPost, ToolIdea, 
    ApiKeys, ApiValidationStatuses, Status, ModalStatus, Theme 
} from '../types';
import * as wordpressService from '../services/wordpressService';
import * as aiService from '../services/aiService';
import { AI_PROVIDERS, SHORTCODE_REMOVAL_REGEX } from '../constants';

// --- ACTION TYPES ---
type Action =
  | { type: 'INITIALIZE_STATE'; payload: Partial<AppState> }
  | { type: 'SET_THEME'; payload: Theme }
  | { type: 'SET_PROVIDER'; payload: AiProvider }
  | { type: 'SET_API_KEY'; payload: { provider: AiProvider; key: string } }
  | { type: 'SET_OPENROUTER_MODEL'; payload: string }
  | { type: 'VALIDATE_API_KEY_START'; payload: AiProvider }
  | { type: 'VALIDATE_API_KEY_SUCCESS'; payload: AiProvider }
  | { type: 'VALIDATE_API_KEY_FAILURE'; payload: { provider: AiProvider } }
  | { type: 'CONNECT_START' }
  | { type: 'CONNECT_SUCCESS'; payload: { config: WordPressConfig; posts: WordPressPost[], totalPages: number } }
  | { type: 'CONNECT_FAILURE'; payload: string }
  | { type: 'SETUP_REQUIRED'; payload: WordPressConfig }
  | { type: 'RESET' }
  | { type: 'SET_POST_SEARCH_QUERY'; payload: string }
  | { type: 'SET_POST_SORT_ORDER'; payload: 'opportunity' | 'date' }
  | { type: 'DELETE_SNIPPET_START'; payload: number }
  | { type: 'DELETE_SNIPPET_SUCCESS'; payload: WordPressPost }
  | { type: 'DELETE_SNIPPET_FAILURE'; payload: { postId: number, error: string } }
  | { type: 'SCORE_POSTS_START' }
  | { type: 'SCORE_POSTS_SUCCESS'; payload: Partial<WordPressPost>[] }
  | { type: 'SCORE_POSTS_FAILURE'; payload: string }
  | { type: 'OPEN_MODAL'; payload: WordPressPost }
  | { type: 'CLOSE_MODAL' }
  | { type: 'GET_IDEAS_START' }
  | { type: 'GET_IDEAS_SUCCESS'; payload: ToolIdea[] }
  | { type: 'GET_IDEAS_FAILURE'; payload: string }
  | { type: 'SELECT_IDEA'; payload: ToolIdea }
  | { type: 'GENERATE_SNIPPET_START' }
  | { type: 'GENERATE_SNIPPET_STREAM'; payload: string }
  | { type: 'GENERATE_SNIPPET_END' }
  | { type: 'GENERATE_SNIPPET_FAILURE'; payload: string }
  | { type: 'INSERT_SNIPPET_START' }
  | { type: 'INSERT_SNIPPET_SUCCESS'; payload: WordPressPost }
  | { type: 'INSERT_SNIPPET_FAILURE'; payload: string }
  | { type: 'SET_THEME_COLOR'; payload: string }
  | { type: 'FETCH_MORE_POSTS_START' }
  | { type: 'FETCH_MORE_POSTS_SUCCESS'; payload: { posts: WordPressPost[]; page: number; totalPages: number } }
  | { type: 'FETCH_MORE_POSTS_FAILURE'; payload: string }
  | { type: 'REFRESH_TOOL_START'; payload: number }
  | { type: 'REFRESH_TOOL_SUCCESS'; payload: { postId: number; toolCreationDate: number } }
  | { type: 'REFRESH_TOOL_FAILURE'; payload: { postId: number; error: string } };

// --- CONTEXT and PROVIDER ---
interface AppContextType {
  state: AppState;
  dispatch: Dispatch<Action>;
  setTheme: (theme: Theme) => void;
  setProvider: (provider: AiProvider) => void;
  setApiKey: (provider: AiProvider, key: string) => void;
  setOpenRouterModel: (model: string) => void;
  // FIX: Updated async function types to return Promise<void> instead of void.
  validateAndSaveApiKey: (provider: AiProvider) => Promise<void>;
  connectToWordPress: (config: WordPressConfig) => Promise<void>;
  retryConnection: () => void;
  reset: () => void;
  setPostSearchQuery: (query: string) => void;
  setPostSortOrder: (order: 'opportunity' | 'date') => void;
  deleteSnippet: (postId: number, toolId?: number) => Promise<void>;
  runOpportunityAnalysis: () => Promise<void>;
  beginToolCreation: (post: WordPressPost) => void;
  closeToolGenerationModal: () => void;
  generateIdeasForModal: () => Promise<void>;
  selectIdea: (idea: ToolIdea) => void;
  generateSnippetForModal: () => Promise<void>;
  insertSnippet: () => Promise<void>;
  setThemeColor: (color: string) => void;
  fetchMorePosts: () => Promise<void>;
  refreshTool: (postId: number, toolId: number) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const filterAndSortPosts = (posts: WordPressPost[], query: string, sort: 'opportunity' | 'date'): WordPressPost[] => {
    let filtered = posts;
    if (query) {
        filtered = posts.filter(p => p.title.rendered.toLowerCase().includes(query.toLowerCase()));
    }
    
    const sorted = [...filtered];

    if (sort === 'opportunity') {
        sorted.sort((a, b) => (b.opportunityScore ?? -1) - (a.opportunityScore ?? -1));
    } else {
        // Default WP API order is reverse chronological (newest first), so no sort needed for 'date'
    }
    return sorted;
};

// --- INITIAL STATE ---
const initialState: AppState = {
    status: 'idle',
    error: null,
    deletingPostId: null,
    refreshingPostId: null,
    theme: 'light',
    frameStatus: 'initializing',
    isScoring: false,
    isFetchingMorePosts: false,
    apiKeys: { [AiProvider.Gemini]: '', [AiProvider.OpenAI]: '', [AiProvider.Anthropic]: '', [AiProvider.OpenRouter]: '' },
    apiValidationStatuses: { [AiProvider.Gemini]: 'idle', [AiProvider.OpenAI]: 'idle', [AiProvider.Anthropic]: 'idle', [AiProvider.OpenRouter]: 'idle' },
    apiValidationErrorMessages: { [AiProvider.Gemini]: null, [AiProvider.OpenAI]: null, [AiProvider.Anthropic]: null, [AiProvider.OpenRouter]: null },
    selectedProvider: AiProvider.Gemini,
    openRouterModel: AI_PROVIDERS[AiProvider.OpenRouter].defaultModel,
    wpConfig: null,
    posts: [],
    filteredPosts: [],
    postsPage: 1,
    hasMorePosts: false,
    postSearchQuery: '',
    postSortOrder: 'date',
    setupRequired: false,
    isToolGenerationModalOpen: false,
    activePostForModal: null,
    modalStatus: 'idle',
    modalError: null,
    toolIdeas: [],
    selectedIdea: null,
    generatedSnippet: '',
    themeColor: '#3b82f6', // Default blue
};

// --- REDUCER ---
const appReducer = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    case 'INITIALIZE_STATE':
        return { ...state, ...action.payload };
    case 'SET_THEME':
        return { ...state, theme: action.payload };
    case 'SET_PROVIDER':
        return { ...state, selectedProvider: action.payload };
    case 'SET_API_KEY':
        const newKeys = { ...state.apiKeys, [action.payload.provider]: action.payload.key };
        const newStatuses = { ...state.apiValidationStatuses, [action.payload.provider]: 'idle' as const };
        return { ...state, apiKeys: newKeys, apiValidationStatuses: newStatuses };
    case 'SET_OPENROUTER_MODEL':
        return { ...state, openRouterModel: action.payload };
    case 'VALIDATE_API_KEY_START':
        return { ...state, apiValidationStatuses: { ...state.apiValidationStatuses, [action.payload]: 'validating' } };
    case 'VALIDATE_API_KEY_SUCCESS':
        return { ...state, apiValidationStatuses: { ...state.apiValidationStatuses, [action.payload]: 'valid' } };
    case 'VALIDATE_API_KEY_FAILURE':
        return { ...state, apiValidationStatuses: { ...state.apiValidationStatuses, [action.payload.provider]: 'invalid' } };
    case 'CONNECT_START':
        return { ...state, status: 'loading', error: null, setupRequired: false };
    case 'CONNECT_SUCCESS':
        const initialFilteredPosts = filterAndSortPosts(action.payload.posts, state.postSearchQuery, state.postSortOrder);
        return { ...state, status: 'success', wpConfig: action.payload.config, posts: action.payload.posts, filteredPosts: initialFilteredPosts, postsPage: 1, hasMorePosts: 1 < action.payload.totalPages };
    case 'CONNECT_FAILURE':
        return { ...state, status: 'error', error: action.payload };
    case 'SETUP_REQUIRED':
        return { ...state, status: 'idle', error: null, setupRequired: true, wpConfig: action.payload };
    case 'RESET':
        return { ...initialState, apiKeys: state.apiKeys, theme: state.theme }; // Keep theme and keys on reset
    case 'SET_POST_SEARCH_QUERY':
        const filteredByQuery = filterAndSortPosts(state.posts, action.payload, state.postSortOrder);
        return { ...state, postSearchQuery: action.payload, filteredPosts: filteredByQuery };
    case 'SET_POST_SORT_ORDER':
        const sorted = filterAndSortPosts(state.posts, state.postSearchQuery, action.payload);
        return { ...state, postSortOrder: action.payload, filteredPosts: sorted };
    case 'DELETE_SNIPPET_START':
        return { ...state, deletingPostId: action.payload };
    case 'DELETE_SNIPPET_SUCCESS':
        const postsAfterDelete = state.posts.map(p => p.id === action.payload.id ? action.payload : p);
        return { 
            ...state, 
            deletingPostId: null,
            posts: postsAfterDelete,
            filteredPosts: filterAndSortPosts(postsAfterDelete, state.postSearchQuery, state.postSortOrder)
        };
    case 'DELETE_SNIPPET_FAILURE':
        console.error(`Failed to delete snippet for post ${action.payload.postId}: ${action.payload.error}`);
        return { ...state, deletingPostId: null };
    case 'SCORE_POSTS_START':
        return { ...state, isScoring: true, error: null };
    case 'SCORE_POSTS_SUCCESS':
        const scoredPosts = state.posts.map(post => {
            const scoreData = action.payload.find(s => s.id === post.id);
            return scoreData ? { ...post, ...scoreData } : post;
        });
        return { 
            ...state, 
            isScoring: false,
            posts: scoredPosts,
            filteredPosts: filterAndSortPosts(scoredPosts, state.postSearchQuery, 'opportunity'),
            postSortOrder: 'opportunity' // Switch to opportunity sort after scoring
        };
    case 'SCORE_POSTS_FAILURE':
        return { ...state, isScoring: false, error: action.payload };
    case 'OPEN_MODAL':
        return { ...state, isToolGenerationModalOpen: true, activePostForModal: action.payload };
    case 'CLOSE_MODAL':
        return { 
            ...state, 
            isToolGenerationModalOpen: false, 
            activePostForModal: null,
            modalStatus: 'idle',
            modalError: null,
            toolIdeas: [],
            selectedIdea: null,
            generatedSnippet: ''
        };
    case 'GET_IDEAS_START':
        return { ...state, modalStatus: 'loading_ideas', modalError: null, toolIdeas: [] };
    case 'GET_IDEAS_SUCCESS':
        return { ...state, modalStatus: 'idle', toolIdeas: action.payload };
    case 'GET_IDEAS_FAILURE':
        return { ...state, modalStatus: 'error', modalError: action.payload };
    case 'SELECT_IDEA':
        return { ...state, selectedIdea: action.payload };
    case 'GENERATE_SNIPPET_START':
        return { ...state, modalStatus: 'generating_snippet', generatedSnippet: '', modalError: null };
    case 'GENERATE_SNIPPET_STREAM':
        return { ...state, generatedSnippet: state.generatedSnippet + action.payload };
    case 'GENERATE_SNIPPET_END':
        return { ...state, modalStatus: 'idle' };
    case 'GENERATE_SNIPPET_FAILURE':
        return { ...state, modalStatus: 'error', modalError: action.payload };
    case 'INSERT_SNIPPET_START':
        return { ...state, modalStatus: 'inserting_snippet' };
    case 'INSERT_SNIPPET_SUCCESS':
         const postsAfterInsert = state.posts.map(p => p.id === action.payload.id ? action.payload : p);
        return { 
            ...state, 
            modalStatus: 'success',
            posts: postsAfterInsert,
            filteredPosts: filterAndSortPosts(postsAfterInsert, state.postSearchQuery, state.postSortOrder)
        };
    case 'INSERT_SNIPPET_FAILURE':
        return { ...state, modalStatus: 'error', modalError: action.payload };
    case 'SET_THEME_COLOR':
        return { ...state, themeColor: action.payload };
    case 'FETCH_MORE_POSTS_START':
        return { ...state, isFetchingMorePosts: true };
    case 'FETCH_MORE_POSTS_SUCCESS':
        const newPosts = [...state.posts, ...action.payload.posts];
        return { ...state, isFetchingMorePosts: false, posts: newPosts, filteredPosts: filterAndSortPosts(newPosts, state.postSearchQuery, state.postSortOrder), postsPage: action.payload.page, hasMorePosts: action.payload.page < action.payload.totalPages };
    case 'FETCH_MORE_POSTS_FAILURE':
        return { ...state, isFetchingMorePosts: false, error: action.payload };
    case 'REFRESH_TOOL_START':
        return { ...state, refreshingPostId: action.payload };
    case 'REFRESH_TOOL_SUCCESS':
        const postsAfterRefresh = state.posts.map(p => p.id === action.payload.postId ? { ...p, toolCreationDate: action.payload.toolCreationDate } : p);
        return { 
            ...state, 
            refreshingPostId: null,
            posts: postsAfterRefresh,
            filteredPosts: filterAndSortPosts(postsAfterRefresh, state.postSearchQuery, state.postSortOrder)
        };
    case 'REFRESH_TOOL_FAILURE':
        console.error(`Failed to refresh snippet for post ${action.payload.postId}: ${action.payload.error}`);
        return { ...state, refreshingPostId: null, error: `Failed to refresh tool for post ${action.payload.postId}.` };
    default:
      return state;
  }
};

// --- PROVIDER COMPONENT ---
export const AppContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [state, dispatch] = useReducer(appReducer, initialState);

    useEffect(() => {
        // Load persisted state from localStorage
        const persistedState: Partial<AppState> = {};
        const storedKeys = localStorage.getItem('apiKeys');
        const storedConfig = localStorage.getItem('wpConfig');
        const storedTheme = localStorage.getItem('theme') as Theme;

        if (storedKeys) persistedState.apiKeys = JSON.parse(storedKeys);
        if (storedConfig) persistedState.wpConfig = JSON.parse(storedConfig);
        if (storedTheme) persistedState.theme = storedTheme;
        else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            persistedState.theme = 'dark';
        }
        dispatch({ type: 'INITIALIZE_STATE', payload: persistedState });
    }, []);

    useEffect(() => {
        // Persist theme
        if (state.theme === 'dark') {
            document.documentElement.classList.add('dark');
            document.documentElement.classList.remove('light');
        } else {
            document.documentElement.classList.remove('dark');
            document.documentElement.classList.add('light');
        }
        localStorage.setItem('theme', state.theme);
    }, [state.theme]);
    
    const setTheme = (theme: Theme) => dispatch({ type: 'SET_THEME', payload: theme });
    const setProvider = (provider: AiProvider) => dispatch({ type: 'SET_PROVIDER', payload: provider });
    const setApiKey = (provider: AiProvider, key: string) => dispatch({ type: 'SET_API_KEY', payload: { provider, key } });
    const setOpenRouterModel = (model: string) => dispatch({ type: 'SET_OPENROUTER_MODEL', payload: model });
    const setPostSearchQuery = (query: string) => dispatch({ type: 'SET_POST_SEARCH_QUERY', payload: query });
    const setPostSortOrder = (order: 'opportunity' | 'date') => dispatch({ type: 'SET_POST_SORT_ORDER', payload: order });
    const beginToolCreation = (post: WordPressPost) => dispatch({ type: 'OPEN_MODAL', payload: post });
    const closeToolGenerationModal = () => dispatch({ type: 'CLOSE_MODAL' });
    const selectIdea = (idea: ToolIdea) => dispatch({ type: 'SELECT_IDEA', payload: idea });
    const setThemeColor = (color: string) => dispatch({ type: 'SET_THEME_COLOR', payload: color });

    const validateAndSaveApiKey = async (provider: AiProvider) => {
        dispatch({ type: 'VALIDATE_API_KEY_START', payload: provider });
        const key = state.apiKeys[provider];
        const model = provider === AiProvider.OpenRouter ? state.openRouterModel : AI_PROVIDERS[provider].defaultModel;

        const isValid = await aiService.validateApiKey(provider, key, model);

        if (isValid) {
            localStorage.setItem('apiKeys', JSON.stringify(state.apiKeys));
            dispatch({ type: 'VALIDATE_API_KEY_SUCCESS', payload: provider });
        } else {
            dispatch({ type: 'VALIDATE_API_KEY_FAILURE', payload: { provider } });
        }
    };
    
    const connectToWordPress = async (config: WordPressConfig) => {
        dispatch({ type: 'CONNECT_START' });
        try {
            const isSetup = await wordpressService.checkSetup(config);
            if (!isSetup) {
                dispatch({ type: 'SETUP_REQUIRED', payload: config });
                return;
            }
            const { posts, totalPages } = await wordpressService.fetchPosts(config, 1);
            localStorage.setItem('wpConfig', JSON.stringify(config));
            dispatch({ type: 'CONNECT_SUCCESS', payload: { config, posts, totalPages } });
        } catch (error: any) {
            dispatch({ type: 'CONNECT_FAILURE', payload: error.message || 'An unknown error occurred.' });
        }
    };

    const fetchMorePosts = async () => {
        if (!state.wpConfig || state.isFetchingMorePosts || !state.hasMorePosts) return;
        dispatch({ type: 'FETCH_MORE_POSTS_START' });
        try {
            const nextPage = state.postsPage + 1;
            const { posts, totalPages } = await wordpressService.fetchPosts(state.wpConfig, nextPage);
            dispatch({ type: 'FETCH_MORE_POSTS_SUCCESS', payload: { posts, page: nextPage, totalPages } });
        } catch (error: any) {
            dispatch({ type: 'FETCH_MORE_POSTS_FAILURE', payload: error.message || 'Failed to fetch more posts.' });
        }
    };

    const retryConnection = () => {
        if (state.wpConfig) {
            connectToWordPress(state.wpConfig);
        }
    };

    const reset = () => {
        localStorage.removeItem('wpConfig');
        dispatch({ type: 'RESET' });
    };

    const deleteSnippet = async (postId: number, toolId?: number) => {
        if (!state.wpConfig) return;
        dispatch({ type: 'DELETE_SNIPPET_START', payload: postId });
        try {
            if (toolId) {
                await wordpressService.deleteCfTool(state.wpConfig, toolId);
            }
            const post = state.posts.find(p => p.id === postId);
            if (!post) throw new Error("Post not found");
            const newContent = post.content.rendered.replace(SHORTCODE_REMOVAL_REGEX, '');
            const updatedPost = await wordpressService.updatePost(state.wpConfig, postId, newContent);
            const freshPostDetails: WordPressPost = { ...post, ...updatedPost, hasOptimizerSnippet: false, toolId: undefined, opportunityScore: undefined, toolCreationDate: undefined, opportunityRationale: undefined };
            dispatch({ type: 'DELETE_SNIPPET_SUCCESS', payload: freshPostDetails });
        } catch (error: any) {
            dispatch({ type: 'DELETE_SNIPPET_FAILURE', payload: { postId, error: error.message } });
        }
    };
    
    const runOpportunityAnalysis = async () => {
        const { selectedProvider, apiKeys, openRouterModel, posts } = state;
        const apiKey = apiKeys[selectedProvider];
        if (!apiKey || posts.length === 0) return;
        dispatch({ type: 'SCORE_POSTS_START' });
        try {
            const model = selectedProvider === AiProvider.OpenRouter ? openRouterModel : AI_PROVIDERS[selectedProvider].defaultModel;
            const scores = await aiService.getOpportunityScores(apiKey, selectedProvider, model, posts);
            dispatch({ type: 'SCORE_POSTS_SUCCESS', payload: scores });
        } catch (error: any) {
            dispatch({ type: 'SCORE_POSTS_FAILURE', payload: error.message || 'Failed to score posts.' });
        }
    };

    const generateIdeasForModal = async () => {
        const { selectedProvider, apiKeys, openRouterModel, activePostForModal } = state;
        if (!activePostForModal) return;
        const apiKey = apiKeys[selectedProvider];
        dispatch({ type: 'GET_IDEAS_START' });
        try {
             const model = selectedProvider === AiProvider.OpenRouter ? openRouterModel : AI_PROVIDERS[selectedProvider].defaultModel;
             const ideas = await aiService.generateToolIdeas(apiKey, selectedProvider, model, activePostForModal);
             dispatch({ type: 'GET_IDEAS_SUCCESS', payload: ideas });
        } catch (error: any) {
             dispatch({ type: 'GET_IDEAS_FAILURE', payload: error.message || 'Failed to generate ideas.' });
        }
    };

    const generateSnippetForModal = async () => {
        const { selectedProvider, apiKeys, openRouterModel, activePostForModal, selectedIdea } = state;
        if (!activePostForModal || !selectedIdea) return;
        const apiKey = apiKeys[selectedProvider];
        dispatch({ type: 'GENERATE_SNIPPET_START' });
        try {
            const model = selectedProvider === AiProvider.OpenRouter ? openRouterModel : AI_PROVIDERS[selectedProvider].defaultModel;
            const stream = await aiService.generateSnippet(apiKey, selectedProvider, model, activePostForModal, selectedIdea);
            for await (const chunk of stream) {
                dispatch({ type: 'GENERATE_SNIPPET_STREAM', payload: chunk });
            }
            dispatch({ type: 'GENERATE_SNIPPET_END' });
        } catch (error: any) {
            dispatch({ type: 'GENERATE_SNIPPET_FAILURE', payload: error.message || 'Failed to generate snippet.' });
        }
    };

    const insertSnippet = async () => {
        const { wpConfig, activePostForModal, generatedSnippet, selectedIdea } = state;
        if (!wpConfig || !activePostForModal || !generatedSnippet || !selectedIdea) return;
        dispatch({ type: 'INSERT_SNIPPET_START' });
        try {
            const tool = await wordpressService.createCfTool(wpConfig, selectedIdea.title, generatedSnippet);
            const shortcode = `[contentforge_tool id="${tool.id}"]`;
            const content = activePostForModal.content.rendered;
            const h2Match = /<\/h2>/i.exec(content);
            let newContent = '';
            if (h2Match) {
                const insertIndex = h2Match.index + 5;
                newContent = content.slice(0, insertIndex) + `<p>${shortcode}</p>` + content.slice(insertIndex);
            } else {
                newContent = `<p>${shortcode}</p>` + content;
            }
            const updatedPost = await wordpressService.updatePost(wpConfig, activePostForModal.id, newContent);
            
            const finalPost: WordPressPost = {
                ...activePostForModal,
                ...updatedPost,
                hasOptimizerSnippet: true,
                toolId: tool.id,
                toolCreationDate: Date.now()
            };

            dispatch({ type: 'INSERT_SNIPPET_SUCCESS', payload: finalPost });
        } catch (error: any) {
            dispatch({ type: 'INSERT_SNIPPET_FAILURE', payload: error.message || 'Failed to insert snippet.' });
        }
    };

    const refreshTool = async (postId: number, toolId: number) => {
        const { wpConfig, selectedProvider, apiKeys, openRouterModel, posts } = state;
        const post = posts.find(p => p.id === postId);
        if (!wpConfig || !post) return;
        
        dispatch({ type: 'REFRESH_TOOL_START', payload: postId });
        try {
            const oldTool = await wordpressService.fetchCfTool(wpConfig, toolId);
            const apiKey = apiKeys[selectedProvider];
            const model = selectedProvider === AiProvider.OpenRouter ? openRouterModel : AI_PROVIDERS[selectedProvider].defaultModel;

            const stream = await aiService.refreshSnippet(apiKey, selectedProvider, model, post, oldTool.content.rendered);
            
            let newSnippet = '';
            for await (const chunk of stream) {
                newSnippet += chunk;
            }

            if (newSnippet) {
                await wordpressService.updateCfTool(wpConfig, toolId, oldTool.title.rendered, newSnippet);
                dispatch({ type: 'REFRESH_TOOL_SUCCESS', payload: { postId, toolCreationDate: Date.now() } });
            } else {
                throw new Error("AI failed to generate a refreshed snippet.");
            }

        } catch (error: any) {
            dispatch({ type: 'REFRESH_TOOL_FAILURE', payload: { postId, error: error.message } });
        }
    };

    const value = {
        state,
        dispatch,
        setTheme,
        setProvider,
        setApiKey,
        setOpenRouterModel,
        validateAndSaveApiKey,
        connectToWordPress,
        retryConnection,
        reset,
        setPostSearchQuery,
        setPostSortOrder,
        deleteSnippet,
        runOpportunityAnalysis,
        beginToolCreation,
        closeToolGenerationModal,
        generateIdeasForModal,
        selectIdea,
        generateSnippetForModal,
        insertSnippet,
        setThemeColor,
        fetchMorePosts,
        refreshTool,
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

// --- HOOK ---
export const useAppContext = (): AppContextType => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppContextProvider');
  }
  return context;
};