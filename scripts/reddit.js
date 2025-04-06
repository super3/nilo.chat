// For Node.js versions < 18, use this import
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

/**
 * Fetches Reddit search results for a given keyword in posts from the last hour
 * and outputs them as JSON
 * @param {string} keyword - The keyword to search for (defaults to 'slack')
 */
async function fetchRedditPosts(keyword = 'slack') {
  try {
    // Reddit search URL for the keyword in posts from the last hour with JSON format
    const url = `https://www.reddit.com/search/.json?q=${encodeURIComponent(keyword)}&type=posts&t=hour`;
    
    // Reddit requires a User-Agent header to avoid 429 errors
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Node.js Reddit Scraper)'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    
    // Extract post data from Reddit's response
    const posts = data.data.children.map(post => {
      const postData = post.data;
      return {
        title: postData.title,
        author: postData.author,
        url: `https://www.reddit.com${postData.permalink}`,
        created_utc: postData.created_utc,
        score: postData.score,
        num_comments: postData.num_comments,
        subreddit: postData.subreddit_name_prefixed
      };
    });

    // Output posts as JSON
    console.log(JSON.stringify(posts, null, 2));
    
    return posts;
  } catch (error) {
    console.error('Error fetching Reddit posts:', error);
    return [];
  }
}

// Get keyword from command-line arguments, if provided
const keyword = process.argv[2] || 'slack';
console.log(`Searching Reddit for: "${keyword}" in the last hour...`);

// Execute the function with the keyword
fetchRedditPosts(keyword); 