import { WordPressConfig, WordPressPost, QuizAnalyticsData } from '../types';
import { SHORTCODE_DETECTION_REGEX } from '../constants';

// NEW: Centralized function for sanitizing the base WordPress URL.
function getSanitizedWpUrl(config: WordPressConfig): string {
    let url = config.url.trim();
    // Default to https if no protocol is specified. This is a common user error.
    if (!/^https?:\/\//i.test(url)) {
        url = `https://${url}`;
    }
    // Ensure a trailing slash for consistent path joining.
    return url.endsWith('/') ? url : `${url}/`;
}

// UPDATED: Uses the new sanitizer function.
function getApiUrl(config: WordPressConfig, endpoint: string): string {
    const baseUrl = getSanitizedWpUrl(config);
    return `${baseUrl}wp-json/wp/v2/${endpoint}`;
}

function getAuthHeader(config: WordPressConfig): string {
    return `Basic ${btoa(`${config.username}:${config.appPassword}`)}`;
}

// NEW: Centralized and more descriptive network error message.
const networkErrorMessage = 'CONNECTION_FAILED: A network error occurred. Please check: 1. Is the Site URL correct (including https://)? 2. Is your site blocking requests due to a CORS policy or a firewall? 3. Is your site currently online?';


// New function to check if the custom post type is registered
export async function checkSetup(config: WordPressConfig): Promise<boolean> {
    // UPDATED: Uses the new sanitizer function.
    const url = `${getSanitizedWpUrl(config)}wp-json/wp/v2/types/cf_tool`;
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': getAuthHeader(config),
            },
        });

        if (response.status === 404) {
            // This is the expected "not found" if the snippet isn't installed.
            return false;
        }
        if (response.status === 401) {
            throw new Error('Authentication failed. Please check your username and Application Password.');
        }
        if (!response.ok) {
            throw new Error(`The WordPress API returned an unexpected status during setup check: ${response.status}`);
        }
        // if response is ok, CPT exists.
        return true;
    } catch (error) {
        console.error("Setup check failed:", error);
        // UPDATED: Uses the new standard network error message.
        if (error instanceof TypeError) { // Most likely a CORS or network issue
            throw new Error(networkErrorMessage);
        }
        // rethrow other errors from response.ok checks etc.
        throw error;
    }
}


export async function fetchPosts(config: WordPressConfig): Promise<WordPressPost[]> {
    // Add `context=edit` to get the raw, unfiltered content field, which is more reliable for shortcode detection.
    // **FIX:** Changed per_page from 100 to 25 to prevent server timeouts (524 error).
    const url = getApiUrl(config, 'posts?context=edit&_fields=id,title,content,link,_links&per_page=25&status=publish&_embed=wp:featuredmedia');
    try {
        const response = await fetch(url, {
            headers: {
                'Authorization': getAuthHeader(config),
            },
        });

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Authentication failed. Please check your username and Application Password.');
            }
            if (response.status === 404) {
                 throw new Error(`Could not find the WordPress REST API endpoint. Ensure your URL is correct and the REST API is not disabled.`);
            }
            throw new Error(`Failed to fetch posts. Status: ${response.status}`);
        }

        const postsData: any[] = await response.json();
        
        const posts: WordPressPost[] = postsData.map(post => {
            const featuredMedia = post._embedded?.['wp:featuredmedia'];
            const featuredImageUrl = featuredMedia?.[0]?.source_url || null;

            // --- ENHANCED DETECTION LOGIC ---
            // Check both the rendered content and the raw content (if available) for the shortcode.
            // The raw content is more reliable as it's not affected by server-side rendering filters that might remove shortcodes.
            const contentToCheck = `${post.content.rendered} ${post.content.raw || ''}`;
            const match = contentToCheck.match(SHORTCODE_DETECTION_REGEX);
            const hasOptimizerSnippet = !!match;
            const toolId = match ? parseInt(match[1], 10) : undefined;

            return {
                id: post.id,
                title: post.title,
                content: post.content, // Pass the whole content object which now includes .raw
                link: post.link,
                featuredImageUrl: featuredImageUrl,
                hasOptimizerSnippet,
                toolId,
            };
        });

        return posts;
    } catch (error) {
        console.error('Fetch posts error:', error);
        // UPDATED: Uses the new standard network error message.
        if (error instanceof TypeError) {
            throw new Error(networkErrorMessage);
        }
        throw error;
    }
}

export async function updatePost(config: WordPressConfig, postId: number, content: string): Promise<WordPressPost> {
    const url = getApiUrl(config, `posts/${postId}`);
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': getAuthHeader(config),
            },
            body: JSON.stringify({
                content: content,
            }),
        });

        if (!response.ok) {
             if (response.status === 401 || response.status === 403) {
                throw new Error('Authentication failed. You may not have permission to edit this post.');
            }
            throw new Error(`Failed to update post. Status: ${response.status}`);
        }
        
        const updatedPostData: any = await response.json();
        
        const match = updatedPostData.content.rendered.match(SHORTCODE_DETECTION_REGEX);
        const hasOptimizerSnippet = !!match;
        const toolId = match ? parseInt(match[1], 10) : undefined;

        const updatedPost: WordPressPost = {
            id: updatedPostData.id,
            title: updatedPostData.title,
            content: updatedPostData.content,
            link: updatedPostData.link,
            featuredImageUrl: null, // This info is not in the update response
            hasOptimizerSnippet,
            toolId,
        };

        return updatedPost;

    } catch (error) {
        console.error('Update post error:', error);
        // UPDATED: Uses the new standard network error message.
        if (error instanceof TypeError) {
             throw new Error(networkErrorMessage);
        }
        throw error;
    }
}


// Create a tool in the 'cf_tool' custom post type
export async function createCfTool(config: WordPressConfig, title: string, content: string): Promise<{ id: number }> {
  const url = getApiUrl(config, 'cf_tool');
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': getAuthHeader(config),
      },
      body: JSON.stringify({
        title: title,
        content: content,
        status: 'publish', // Important to make it accessible
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to create tool post. Status: ${response.status} - ${errorData.message}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Create cf_tool error:', error);
    // UPDATED: Uses the new standard network error message.
    if (error instanceof TypeError) {
        throw new Error(networkErrorMessage);
    }
    throw error;
  }
}

// Delete a tool from the 'cf_tool' custom post type
export async function deleteCfTool(config: WordPressConfig, toolId: number): Promise<void> {
    // force=true bypasses the trash
  const url = getApiUrl(config, `cf_tool/${toolId}?force=true`);
  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': getAuthHeader(config),
      },
    });

    if (!response.ok) {
        // 404 is okay, maybe it was already deleted.
        if (response.status === 404) {
            console.warn(`Tool with ID ${toolId} not found for deletion. It might have been deleted manually.`);
            return;
        }
      const errorData = await response.json();
      throw new Error(`Failed to delete tool post. Status: ${response.status} - ${errorData.message}`);
    }
    // No content on successful deletion
  } catch (error) {
    console.error('Delete cf_tool error:', error);
    // UPDATED: Uses the new standard network error message.
    if (error instanceof TypeError) {
        throw new Error(networkErrorMessage);
    }
    throw error;
  }
}

export async function fetchQuizAnalytics(config: WordPressConfig, toolId: number): Promise<QuizAnalyticsData> {
    // UPDATED: Uses the new sanitizer function.
    const url = `${getSanitizedWpUrl(config)}wp-json/quizforge/v1/results/${toolId}`;
    try {
        const response = await fetch(url, {
            headers: { 'Authorization': getAuthHeader(config) },
        });
        if (!response.ok) {
            if (response.status === 404) {
                // It's not an error if there's no data yet, return empty state.
                return { completions: 0, averageScore: 0, resultCounts: {} };
            }
            throw new Error(`Failed to fetch analytics. Status: ${response.status}`);
        }
        const data = await response.json();
        // The PHP can return an empty object/array if no data, handle that.
        if (!data || Object.keys(data).length === 0) {
            return { completions: 0, averageScore: 0, resultCounts: {} };
        }
        return data;
    } catch (error) {
        console.error('Fetch quiz analytics error:', error);
        // UPDATED: Uses the new standard network error message.
         if (error instanceof TypeError) {
             throw new Error(networkErrorMessage);
        }
        throw error;
    }
}