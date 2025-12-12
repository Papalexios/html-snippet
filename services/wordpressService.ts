import { WordPressConfig, WordPressPost, QuizAnalyticsData } from '../types';
import { SHORTCODE_DETECTION_REGEX } from '../constants';

const WP_NETWORK_TIMEOUT_MS = 30000; // 30 seconds per request attempt

// Helper: Wait for a specified amount of time
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Centralized fetch with Timeout AND Retry logic (Exponential Backoff)
async function fetchWithRetry(url: string, options: RequestInit = {}, retries = 3, backoff = 1000): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), WP_NETWORK_TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
        });
        clearTimeout(timeoutId);

        // Optional: Retry on 5xx server errors if needed, but for now we focus on network/timeout
        // if (response.status >= 500) throw new Error(`Server Error ${response.status}`);

        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        
        const isAbort = error instanceof Error && error.name === 'AbortError';
        const isNetworkError = error instanceof TypeError; // fetch throws TypeError on network failure

        if ((isAbort || isNetworkError) && retries > 0) {
            console.warn(`Request failed. Retrying in ${backoff}ms... (${retries} attempts left)`);
            await wait(backoff);
            return fetchWithRetry(url, options, retries - 1, backoff * 2);
        }

        if (isAbort) {
            throw new Error(`CONNECTION_FAILED: Request timed out after multiple attempts. Your site may be slow or offline.`);
        }
        throw error;
    }
}

// Sanitizes the base WordPress URL.
function getSanitizedWpUrl(config: WordPressConfig): string {
    let url = config.url.trim();
    if (!/^https?:\/\//i.test(url)) {
        url = `https://${url}`;
    }
    return url.endsWith('/') ? url : `${url}/`;
}

function getApiUrl(config: WordPressConfig, endpoint: string): string {
    const baseUrl = getSanitizedWpUrl(config);
    return `${baseUrl}wp-json/wp/v2/${endpoint}`;
}

function getAuthHeader(config: WordPressConfig): string {
    return `Basic ${btoa(`${config.username}:${config.appPassword}`)}`;
}

const networkErrorMessage = 'CONNECTION_FAILED: A network error occurred. Please check your URL and internet connection.';


export async function checkSetup(config: WordPressConfig): Promise<boolean> {
    const url = `${getSanitizedWpUrl(config)}wp-json/wp/v2/types/cf_tool`;
    try {
        const response = await fetchWithRetry(url, {
            method: 'GET',
            headers: { 'Authorization': getAuthHeader(config) },
        });

        if (response.status === 404) return false;
        if (response.status === 401) throw new Error('Authentication failed. Please check your username and Application Password.');
        if (!response.ok) throw new Error(`Setup check failed: ${response.status}`);
        
        return true;
    } catch (error) {
        console.error("Setup check failed:", error);
        if (error instanceof Error && error.message.includes('CONNECTION_FAILED')) throw error;
        throw new Error(networkErrorMessage);
    }
}


export async function fetchPosts(config: WordPressConfig, page: number): Promise<{ posts: WordPressPost[], totalPages: number }> {
    const url = getApiUrl(config, `posts?context=edit&_fields=id,title,content,link,_links&per_page=24&page=${page}&status=publish&_embed=wp:featuredmedia`);
    try {
        const response = await fetchWithRetry(url, {
            headers: { 'Authorization': getAuthHeader(config) },
        });

        if (!response.ok) {
            if (response.status === 401) throw new Error('Authentication failed. Please check your username and Application Password.');
            if (response.status === 404) throw new Error(`API endpoint not found. Ensure your site URL is correct.`);
            throw new Error(`Failed to fetch posts. Status: ${response.status}`);
        }

        const totalPages = parseInt(response.headers.get('X-WP-TotalPages') || '1', 10);
        const postsData: any[] = await response.json();
        
        const posts: WordPressPost[] = postsData.map(post => {
            const featuredMedia = post._embedded?.['wp:featuredmedia'];
            const featuredImageUrl = featuredMedia?.[0]?.source_url || null;
            const contentToCheck = `${post.content.rendered} ${post.content.raw || ''}`;
            const match = contentToCheck.match(SHORTCODE_DETECTION_REGEX);
            const hasOptimizerSnippet = !!match;
            const toolId = match ? parseInt(match[1], 10) : undefined;

            return {
                id: post.id,
                title: post.title,
                content: post.content,
                link: post.link,
                featuredImageUrl: featuredImageUrl,
                hasOptimizerSnippet,
                toolId,
            };
        });

        return { posts, totalPages };
    } catch (error) {
        console.error('Fetch posts error:', error);
        if (error instanceof Error && error.message.includes('CONNECTION_FAILED')) throw error;
        throw new Error(networkErrorMessage);
    }
}

export async function updatePost(config: WordPressConfig, postId: number, content: string): Promise<WordPressPost> {
    const url = getApiUrl(config, `posts/${postId}`);
    try {
        const response = await fetchWithRetry(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': getAuthHeader(config),
            },
            body: JSON.stringify({ content: content }),
        });

        if (!response.ok) {
             if (response.status === 401 || response.status === 403) throw new Error('Permission denied. Cannot edit this post.');
            throw new Error(`Failed to update post. Status: ${response.status}`);
        }
        
        const updatedPostData: any = await response.json();
        const match = updatedPostData.content.rendered.match(SHORTCODE_DETECTION_REGEX);
        
        return {
            id: updatedPostData.id,
            title: updatedPostData.title,
            content: updatedPostData.content,
            link: updatedPostData.link,
            featuredImageUrl: null,
            hasOptimizerSnippet: !!match,
            toolId: match ? parseInt(match[1], 10) : undefined,
        };
    } catch (error) {
        console.error('Update post error:', error);
        if (error instanceof Error && error.message.includes('CONNECTION_FAILED')) throw error;
        throw new Error(networkErrorMessage);
    }
}

export async function createCfTool(config: WordPressConfig, title: string, content: string): Promise<{ id: number }> {
  const url = getApiUrl(config, 'cf_tool');
  try {
    const response = await fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': getAuthHeader(config),
      },
      body: JSON.stringify({ title, content, status: 'publish' }),
    });

    if (!response.ok) throw new Error(`Failed to create tool. Status: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('Create cf_tool error:', error);
    if (error instanceof Error && error.message.includes('CONNECTION_FAILED')) throw error;
    throw new Error(networkErrorMessage);
  }
} 

export async function deleteCfTool(config: WordPressConfig, toolId: number): Promise<void> {
  const url = getApiUrl(config, `cf_tool/${toolId}?force=true`);
  try {
    const response = await fetchWithRetry(url, {
      method: 'DELETE',
      headers: { 'Authorization': getAuthHeader(config) },
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`Failed to delete tool. Status: ${response.status}`);
    }
  } catch (error) {
    console.error('Delete cf_tool error:', error);
    if (error instanceof Error && error.message.includes('CONNECTION_FAILED')) throw error;
    throw new Error(networkErrorMessage);
  }
}

export async function fetchQuizAnalytics(config: WordPressConfig, toolId: number): Promise<QuizAnalyticsData> {
    const url = `${getSanitizedWpUrl(config)}wp-json/quizforge/v1/results/${toolId}`;
    try {
        const response = await fetchWithRetry(url, {
            headers: { 'Authorization': getAuthHeader(config) },
        });
        if (!response.ok) {
            if (response.status === 404) return { completions: 0, averageScore: 0, resultCounts: {} };
            throw new Error(`Failed to fetch analytics. Status: ${response.status}`);
        }
        const data = await response.json();
        if (!data || Object.keys(data).length === 0) return { completions: 0, averageScore: 0, resultCounts: {} };
        return data;
    } catch (error) {
        console.error('Fetch quiz analytics error:', error);
        if (error instanceof Error && error.message.includes('CONNECTION_FAILED')) throw error;
        throw new Error(networkErrorMessage);
    }
}