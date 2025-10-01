import { WordPressConfig, WordPressPost } from '../types';
import { SHORTCODE_DETECTION_REGEX } from '../constants';

function getApiUrl(config: WordPressConfig, endpoint: string): string {
    const url = config.url.endsWith('/') ? config.url : `${config.url}/`;
    return `${url}wp-json/wp/v2/${endpoint}`;
}

function getAuthHeader(config: WordPressConfig): string {
    return `Basic ${btoa(`${config.username}:${config.appPassword}`)}`;
}

// New function to check if the custom post type is registered
export async function checkSetup(config: WordPressConfig): Promise<boolean> {
    const url = `${config.url.endsWith('/') ? config.url : `${config.url}/`}wp-json/wp/v2/types/cf_tool`;
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
        if (error instanceof TypeError) { // Most likely a CORS or network issue
            // This is the key fix: Propagate a specific, helpful error for CORS issues during the first connection test.
            throw new Error('CONNECTION_FAILED: A network error occurred. This is most likely a CORS (Cross-Origin Resource Sharing) issue on your WordPress server. Other potential causes include an incorrect URL, a firewall blocking the request, or your site being offline.');
        }
        // rethrow other errors from response.ok checks etc.
        throw error;
    }
}


export async function fetchPosts(config: WordPressConfig): Promise<WordPressPost[]> {
    const url = getApiUrl(config, 'posts?_fields=id,title,content,link,_links&per_page=100&status=publish&_embed=wp:featuredmedia');
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

            // Use robust regex to find the shortcode and extract the tool ID
            const match = post.content.rendered.match(SHORTCODE_DETECTION_REGEX);
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

        return posts;
    } catch (error) {
        console.error('Fetch posts error:', error);
        if (error instanceof TypeError) { // Often indicates a CORS or network issue
            throw new Error('CONNECTION_FAILED: A network error occurred. This is most likely a CORS (Cross-Origin Resource Sharing) issue on your WordPress server. Other potential causes include an incorrect URL, a firewall blocking the request, or your site being offline.');
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
         if (error instanceof TypeError) {
            throw new Error('A network error occurred while updating the post. This could be a CORS issue.');
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
      let errorMessage = `Failed to create tool post. Status: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage += ` - ${errorData.message || 'Unknown WordPress error.'}`;
      } catch (e) {
        errorMessage += ` - Could not parse error response from server.`;
      }
      throw new Error(errorMessage);
    }
    return await response.json();
  } catch (error) {
    console.error('Create cf_tool error:', error);
    if (error instanceof TypeError) {
        throw new Error('A network error occurred while creating the tool. This could be a CORS issue or a problem connecting to your site.');
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
      let errorMessage = `Failed to delete tool post. Status: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage += ` - ${errorData.message || 'Unknown WordPress error.'}`;
      } catch (e) {
        errorMessage += ` - Could not parse error response from server.`;
      }
      throw new Error(errorMessage);
    }
    // No content on successful deletion
  } catch (error) {
    console.error('Delete cf_tool error:', error);
    if (error instanceof TypeError) {
        throw new Error('A network error occurred while deleting the tool. This could be a CORS issue or a problem connecting to your site.');
    }
    throw error;
  }
}