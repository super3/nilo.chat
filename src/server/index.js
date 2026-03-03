const express = require('express');
const http = require('http');
const path = require('path');
const socketIo = require('socket.io');
const { Pool } = require('pg');
const { createApiRouter, generateDocs } = require('./api');
// Create Express app and HTTP server
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: [
      'https://nilo.chat',
      'https://super3.github.io',
      'http://localhost:8080'
    ],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Define available channels — keep in sync with CHANNELS in MainSidebar.vue
const CHANNELS = ['welcome', 'general', 'growth', 'feedback'];

// Validation constants
const MAX_MESSAGE_LENGTH = 2000;

// Database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Seed messages inserted into empty databases for fresh deployments
const SEED_MESSAGES = [
  { channel: 'welcome', username: 'nilo-bot', message: 'Welcome to nilo.chat! Say hi — no account needed.' },
  { channel: 'welcome', username: 'alice', message: 'Hey everyone! Excited to be here.' },
  { channel: 'welcome', username: 'bob', message: 'Hi! This chat app is looking great.' },
  { channel: 'general', username: 'nilo-bot', message: 'This is the general channel for announcements and updates.' },
  { channel: 'general', username: 'alice', message: 'Anyone working on the new feature?' },
  { channel: 'general', username: 'charlie', message: 'Yes! The @username autocomplete is live — try typing @ in the message box.' },
  { channel: 'growth', username: 'nilo-bot', message: 'Track outreach, experiments, and new user activity here.' },
  { channel: 'growth', username: 'bob', message: 'We had 15 new signups this week!' },
  { channel: 'feedback', username: 'nilo-bot', message: 'Share bugs, ideas, and feature requests in this channel.' },
  { channel: 'feedback', username: 'charlie', message: 'Love the new mention feature. Try typing @alice or @bob!' }
];

// Seed the database with sample messages if empty
async function seedDatabase() {
  try {
    const result = await pool.query('SELECT COUNT(*) FROM messages');
    const count = parseInt(result.rows[0].count, 10);
    if (count === 0) {
      for (const msg of SEED_MESSAGES) {
        await pool.query(
          'INSERT INTO messages (timestamp, username, message, channel) VALUES ($1, $2, $3, $4)',
          [new Date().toISOString(), msg.username, msg.message, msg.channel]
        );
      }
      console.log(`Seeded database with ${SEED_MESSAGES.length} sample messages`);
    }
  } catch (error) {
    console.error('Error seeding database:', error);
  }
}

// Test database connection and ensure schema is up to date
async function initializeDatabase() {
  try {
    await pool.query('SELECT NOW()');
    console.log('Database connected successfully');
    // Create messages table if it doesn't exist (fresh databases)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        username VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        channel VARCHAR(50) NOT NULL DEFAULT 'general',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query('CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp DESC)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_messages_channel_timestamp ON messages(channel, timestamp DESC)');
    await pool.query('ALTER TABLE messages ADD COLUMN IF NOT EXISTS profile_image_url TEXT DEFAULT NULL');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id SERIAL PRIMARY KEY,
        key_hash VARCHAR(64) NOT NULL UNIQUE,
        agent_name VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query('CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash)');
    await seedDatabase();
  } catch (error) {
    console.error('Database connection error:', error);
  }
}

// Initialize database on startup
initializeDatabase();

// Debug current environment
console.log(`Current NODE_ENV: "${process.env.NODE_ENV}"`);

// Parse JSON request bodies (needed for REST API)
app.use(express.json());

// Health check endpoint - must come before other routes
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// llms.txt — AI-readable API documentation
app.get('/llms.txt', (req, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  res.type('text/markdown').send(generateDocs(baseUrl));
});

// REST API for agent/bot access
app.use('/api', createApiRouter(pool, io));

// Serve static files from the 'dist' folder (production build)
app.use(express.static(path.join(__dirname, '..', '..', 'dist')));

// Return the main index.html for all other routes (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'dist', 'index.html'));
});

// Helper function to fetch and send message history for a channel
async function sendMessageHistory(socket, channel) {
  try {
    const result = await pool.query(
      'SELECT timestamp, username, message, profile_image_url FROM messages WHERE channel = $1 ORDER BY timestamp ASC',
      [channel]
    );

    const history = result.rows.map(row =>
      `${row.timestamp.toISOString()}|${row.username}|${row.profile_image_url || ''}|${row.message}`
    );

    socket.emit('message_history', history);
  } catch (error) {
    console.error('Error loading message history:', error);
    socket.emit('message_history', []);
  }
}

// Track active users across all connections: Map<socketId, username>
const activeUsers = new Map();

// Get deduplicated list of active usernames
function getActiveUsernames() {
  return [...new Set(activeUsers.values())];
}

// Socket.IO event handling
function setupSocketHandlers(io) {
  return (socket) => {
    let username = 'Unknown User';

    // Handle user joining
    socket.on('user_connected', async (data) => {
      username = data.username;
      const channel = data.channel || 'welcome';

      // Track user and broadcast updated user list
      activeUsers.set(socket.id, username);
      io.emit('active_users', getActiveUsernames());

      socket.join(channel);
      await sendMessageHistory(socket, channel);
    });

    // Handle channel change
    socket.on('join_channel', async (data) => {
      const newChannel = data.channel || 'welcome';

      // Leave all channels
      CHANNELS.forEach(channel => {
        socket.leave(channel);
      });

      socket.join(newChannel);
      await sendMessageHistory(socket, newChannel);
    });

    // Handle new messages
    socket.on('chat_message', async (data) => {
      // Validate message input
      if (!data.message || typeof data.message !== 'string' || data.message.trim() === '') {
        socket.emit('error', { message: 'Message cannot be empty' });
        return;
      }
      if (data.message.length > MAX_MESSAGE_LENGTH) {
        socket.emit('error', { message: `Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters` });
        return;
      }
      if (!data.username || typeof data.username !== 'string' || data.username.trim() === '') {
        socket.emit('error', { message: 'Username is required' });
        return;
      }

      const timestamp = new Date().toISOString();
      const channel = data.channel || 'welcome';

      // Save message to database
      try {
        await pool.query(
          'INSERT INTO messages (timestamp, username, message, channel, profile_image_url) VALUES ($1, $2, $3, $4, $5)',
          [timestamp, data.username, data.message, channel, data.profileImageUrl || null]
        );

        // Create message object with channel explicitly included
        const messageObject = {
          timestamp,
          username: data.username,
          message: data.message,
          channel: channel,
          profileImageUrl: data.profileImageUrl || ''
        };

        // Broadcast to ALL clients, not just those in the channel
        // This way everyone can see notifications even if they're not in the channel
        io.emit('chat_message', messageObject);
      } catch (error) {
        console.error('Error saving message to database:', error);
        socket.emit('error', { message: 'Failed to save message' });
      }
    });

    socket.on('disconnect', () => {
      // Remove user from active list and broadcast updated list
      activeUsers.delete(socket.id);
      io.emit('active_users', getActiveUsernames());
    });
  };
}

io.on('connection', setupSocketHandlers(io));

// Start the server
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // Bind to all interfaces for Railway/Docker
server.listen(PORT, HOST, () => {
  console.log(`Server running on ${HOST}:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});

// Export for testing
if (process.env.NODE_ENV === 'test') {
  module.exports = { setupSocketHandlers, pool, app, activeUsers, getActiveUsernames, seedDatabase, SEED_MESSAGES };
}
