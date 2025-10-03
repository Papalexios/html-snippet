import { WordPressConfig, WordPressPost } from '../types';
import { SHORTCODE_DETECTION_REGEX } from '../constants';

const POSTS_PER_PAGE = 20;

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
            return false;
        }
        if (response.status === 401) {
            throw new Error('Authentication failed. Please check your username and Application Password.');
        }
        if (!response.ok) {
            throw new Error(`The WordPress API returned an unexpected status during setup check: ${response.status}`);
        }
        return true;
    } catch (error) {
        console.error("Setup check failed:", error);
        if (error instanceof TypeError) { 
            throw new Error('CONNECTION_FAILED: A network error occurred. This is most likely a CORS (Cross-Origin Resource Sharing) issue on your WordPress server. Other potential causes include an incorrect URL, a firewall blocking the request, or your site being offline.');
        }
        throw error;
    }
}


export async function fetchPosts(config: WordPressConfig, page: number = 1): Promise<{ posts: WordPressPost[], totalPages: number }> {
    const url = getApiUrl(config, `posts?_fields=id,title,content,link,_links&per_page=${POSTS_PER_PAGE}&page=${page}&status=publish&_embed=wp:featuredmedia`);
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

        const totalPages = parseInt(response.headers.get('X-WP-TotalPages') || '1', 10);
        const postsData: any[] = await response.json();
        
        const posts: WordPressPost[] = postsData.map(post => {
            const featuredMedia = post._embedded?.['wp:featuredmedia'];
            const featuredImageUrl = featuredMedia?.[0]?.source_url || null;

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

        return { posts, totalPages };
    } catch (error) {
        console.error('Fetch posts error:', error);
        if (error instanceof TypeError) {
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

        return {
            id: updatedPostData.id,
            title: updatedPostData.title,
            content: updatedPostData.content,
            link: updatedPostData.link,
            featuredImageUrl: null,
            hasOptimizerSnippet,
            toolId,
        };

    } catch (error) {
        console.error('Update post error:', error);
         if (error instanceof TypeError) {
            throw new Error('A network error occurred while updating the post. This could be a CORS issue.');
        }
        throw error;
    }
}


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
        status: 'publish',
      }),
    });

    if (!response.ok) {
      let errorMessage = `Failed to create tool post. Status: ${response.status}`;
      try { const errorData = await response.json(); errorMessage += ` - ${errorData.message || 'Unknown WordPress error.'}`; } catch (e) { /* ignore */ }
      throw new Error(errorMessage);
    }
    return await response.json();
  } catch (error) {
    console.error('Create cf_tool error:', error);
    if (error instanceof TypeError) { throw new Error('A network error occurred while creating the tool.'); }
    throw error;
  }
}

export async function deleteCfTool(config: WordPressConfig, toolId: number): Promise<void> {
  const url = getApiUrl(config, `cf_tool/${toolId}?force=true`);
  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: { 'Authorization': getAuthHeader(config) },
    });

    if (!response.ok && response.status !== 404) {
      let errorMessage = `Failed to delete tool post. Status: ${response.status}`;
      try { const errorData = await response.json(); errorMessage += ` - ${errorData.message || 'Unknown WordPress error.'}`; } catch (e) { /* ignore */ }
      throw new Error(errorMessage);
    }
  } catch (error) {
    console.error('Delete cf_tool error:', error);
    if (error instanceof TypeError) { throw new Error('A network error occurred while deleting the tool.'); }
    throw error;
  }
}

export async function fetchCfTool(config: WordPressConfig, toolId: number): Promise<{ id: number; title: { rendered: string }; content: { rendered: string } }> {
    const url = getApiUrl(config, `cf_tool/${toolId}?_fields=id,title,content`);
    try {
        const response = await fetch(url, { headers: { 'Authorization': getAuthHeader(config) } });
        if (!response.ok) { throw new Error(`Failed to fetch tool. Status: ${response.status}`); }
        return await response.json();
    } catch (error) {
        console.error('Fetch cf_tool error:', error);
        if (error instanceof TypeError) { throw new Error('A network error occurred while fetching the tool.'); }
        throw error;
    }
}

export async function updateCfTool(config: WordPressConfig, toolId: number, title: string, content: string): Promise<{ id: number }> {
    const url = getApiUrl(config, `cf_tool/${toolId}`);
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': getAuthHeader(config) },
            body: JSON.stringify({ title, content }),
        });
        if (!response.ok) { throw new Error(`Failed to update tool. Status: ${response.status}`); }
        return await response.json();
    } catch (error) {
        console.error('Update cf_tool error:', error);
        if (error instanceof TypeError) { throw new Error('A network error occurred while updating the tool.'); }
        throw error;
    }
}