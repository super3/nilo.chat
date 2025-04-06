// For Node.js versions < 18, use this import
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const fs = require('fs');
const path = require('path');
const socketIo = require('socket.io-client');

// Prefix for the special message that stores posted IDs
const POSTED_IDS_PREFIX = '!POSTED_IDS:';

/**
 * Extracts the posted IDs from message history
 * @param {Array} messages - Array of message strings from history
 * @returns {Set} A set of Reddit post IDs that have already been posted
 */
function extractPostedIds(messages) {
  try {
    for (const msg of messages) {
      const parts = msg.split('|');
      if (parts.length >= 3 && parts[1] === 'RedditBot' && parts[2].startsWith(POSTED_IDS_PREFIX)) {
        const idsJson = parts[2].substring(POSTED_IDS_PREFIX.length).trim();
        return new Set(JSON.parse(idsJson));
      }
    }
    return new Set();
  } catch (error) {
    console.error('Error extracting posted IDs:', error);
    return new Set();
  }
}

/**
 * Sends the updated set of posted Reddit IDs to the channel
 * @param {Set} postedIds - The set of Reddit post IDs to save
 * @param {Object} socket - The socket.io connection
 * @returns {Promise} A promise that resolves when the message is sent
 */
function updatePostedIds(postedIds, socket) {
  return new Promise((resolve) => {
    const message = `${POSTED_IDS_PREFIX} ${JSON.stringify([...postedIds])}`;
    
    socket.emit('chat_message', {
      username: 'RedditBot',
      message: message,
      channel: 'slack-feed'
    });
    
    console.log(`Updated posted IDs in slack-feed (total: ${postedIds.size})`);
    
    // Wait a moment before resolving to avoid flooding the server
    setTimeout(resolve, 500);
  });
}

/**
 * Sends a message to the slack-feed channel
 * @param {Object} post - The Reddit post to send
 * @param {Object} socket - The socket.io connection
 * @returns {Promise} A promise that resolves when the message is sent
 */
function sendToSlackFeed(post, socket) {
  return new Promise((resolve) => {
    const timestamp = new Date().toISOString();
    // Format as a single line with spaces instead of newlines
    const formattedMessage = `🔴 Reddit: ${post.title} | 📊 r/${post.subreddit.substring(2)} | ⬆️ ${post.score} | 💬 ${post.num_comments} | 🔗 ${post.url}`;
    
    socket.emit('chat_message', {
      username: 'RedditBot',
      message: formattedMessage,
      channel: 'slack-feed'
    });
    
    console.log(`Posted to slack-feed: ${post.title}`);
    
    // Wait a moment before resolving to avoid flooding the server
    setTimeout(resolve, 500);
  });
}

/**
 * Fetches Reddit search results for a given keyword in posts from the last hour
 * and outputs them as JSON
 * @param {string} keyword - The keyword to search for (defaults to 'slack')
 */
async function fetchRedditPosts(keyword = 'slack') {
  try {
    // Setup socket.io connection
    const socket = socketIo(process.env.NODE_ENV === 'production' ? 'https://api.nilo.chat' : 'http://localhost:3000');
    
    let connected = false;
    let messageHistory = [];

    // Connect to the server and join the slack-feed channel
    await new Promise((resolve) => {
      socket.on('connect', () => {
        console.log('Connected to chat server');
        connected = true;
        
        socket.emit('user_connected', {
          username: 'RedditBot',
          channel: 'slack-feed',
          isReturningUser: true
        });
        
        socket.emit('join_channel', {
          channel: 'slack-feed'
        });
        
        resolve();
      });
      
      socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        resolve();
      });
      
      // Timeout after 5 seconds
      setTimeout(() => {
        if (!connected) {
          console.error('Timed out connecting to server');
          resolve();
        }
      }, 5000);
    });
    
    // If connection failed, exit
    if (!connected) {
      console.error('Failed to connect to chat server');
      return [];
    }
    
    // Wait for message history to load
    await new Promise((resolve) => {
      socket.on('message_history', (history) => {
        console.log(`Received message history (${history.length} messages)`);
        messageHistory = history;
        resolve();
      });
      
      // Timeout after 5 seconds
      setTimeout(() => {
        console.log('Timed out waiting for message history');
        resolve();
      }, 5000);
    });
    
    // Extract posted IDs from message history
    const postedIds = extractPostedIds(messageHistory);
    console.log(`Found ${postedIds.size} previously posted IDs`);
    
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
    
    // Extract basic post data and fetch full details for each post
    const postsPromises = data.data.children.map(async post => {
      const postData = post.data;
      
      // Skip if this post has already been posted
      if (postedIds.has(postData.id)) {
        console.log(`Skipping already posted item: ${postData.title}`);
        return null;
      }
      
      // Get the full post content by making another request to the post URL
      const postUrl = `https://www.reddit.com${postData.permalink}.json`;
      const postResponse = await fetch(postUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Node.js Reddit Scraper)'
        }
      });
      
      if (!postResponse.ok) {
        console.error(`Error fetching post details for ${postData.title}: ${postResponse.status}`);
        return {
          id: postData.id,
          title: postData.title,
          author: postData.author,
          url: `https://www.reddit.com${postData.permalink}`,
          created_utc: postData.created_utc,
          score: postData.score,
          num_comments: postData.num_comments,
          subreddit: postData.subreddit_name_prefixed,
          body: "Failed to retrieve post body"
        };
      }
      
      const postDetail = await postResponse.json();
      
      // The post body text is in the 'selftext' property of the post data
      // For link posts without text, selftext may be empty
      const bodyText = postDetail[0].data.children[0].data.selftext || "(No text content - link post)";
      
      return {
        id: postData.id,
        title: postData.title,
        author: postData.author,
        url: `https://www.reddit.com${postData.permalink}`,
        created_utc: postData.created_utc,
        score: postData.score,
        num_comments: postData.num_comments,
        subreddit: postData.subreddit_name_prefixed,
        body: bodyText
      };
    });
    
    // Wait for all post detail requests to complete
    const posts = (await Promise.all(postsPromises)).filter(post => post !== null);

    // Output posts as JSON
    console.log(JSON.stringify(posts, null, 2));
    
    // Post each item to slack-feed channel
    console.log(`Found ${posts.length} new posts to send to slack-feed`);
    
    let updatedIds = false;
    for (const post of posts) {
      await sendToSlackFeed(post, socket);
      postedIds.add(post.id);
      updatedIds = true;
    }
    
    // Save the updated list of posted IDs to the channel
    if (updatedIds) {
      await updatePostedIds(postedIds, socket);
    }
    
    // Disconnect from socket
    socket.disconnect();
    console.log('Disconnected from chat server');
    
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