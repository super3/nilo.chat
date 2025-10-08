const express = require('express');
const http = require('http');
const path = require('path');
const socketIo = require('socket.io');
const { Pool } = require('pg');
const { Groq } = require('groq-sdk');

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

// Define available channels
const CHANNELS = ['general', 'feedback'];

// Database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize Groq AI client
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Test database connection
async function initializeDatabase() {
  try {
    await pool.query('SELECT NOW()');
    console.log('Database connected successfully');
  } catch (error) {
    console.error('Database connection error:', error);
  }
}

// Initialize database on startup
initializeDatabase();

// Debug current environment
console.log(`Current NODE_ENV: "${process.env.NODE_ENV}"`);

// Health check endpoint - must come before other routes
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root endpoint for Railway health checks
app.get('/', (req, res) => {
  res.status(200).send('Nilo.chat API Server - OK');
});

// Serve static files and frontend routes only in development mode
if (process.env.NODE_ENV !== 'production') {
  console.log('Running in development mode - serving frontend files');
  // Serve static files from the 'dist' folder (production build)
  app.use(express.static(path.join(__dirname, 'dist')));

  // Return the main index.html for all routes (SPA)
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
} else {
  console.log('Running in production mode - not serving frontend files');
}

// Socket.IO event handling
function setupSocketHandlers(io) {
  return (socket) => {
    let username = 'Unknown User';
    
    // Handle user joining
    socket.on('user_connected', async (data) => {
      username = data.username;
      const channel = data.channel || 'general';

      // Join the room for this channel
      socket.join(channel);

      // Send message history to the newly connected client from database
      try {
        const result = await pool.query(
          'SELECT timestamp, username, message FROM messages WHERE channel = $1 ORDER BY timestamp ASC',
          [channel]
        );

        // Format messages in the same format as before: timestamp|username|message
        const history = result.rows.map(row =>
          `${row.timestamp.toISOString()}|${row.username}|${row.message}`
        );

        socket.emit('message_history', history);
      } catch (error) {
        console.error('Error loading message history:', error);
        socket.emit('message_history', []);
      }
    });

    // Handle channel change
    socket.on('join_channel', async (data) => {
      const newChannel = data.channel || 'general';

      // Leave all channels
      CHANNELS.forEach(channel => {
        socket.leave(channel);
      });

      // Join the new channel
      socket.join(newChannel);

      // Send message history for the new channel from database
      try {
        const result = await pool.query(
          'SELECT timestamp, username, message FROM messages WHERE channel = $1 ORDER BY timestamp ASC',
          [newChannel]
        );

        // Format messages in the same format as before: timestamp|username|message
        const history = result.rows.map(row =>
          `${row.timestamp.toISOString()}|${row.username}|${row.message}`
        );

        socket.emit('message_history', history);
      } catch (error) {
        console.error('Error loading message history:', error);
        socket.emit('message_history', []);
      }
    });

    // Handle new messages
    socket.on('chat_message', async (data) => {
      const timestamp = new Date().toISOString();
      const channel = data.channel || 'general';

      console.log(`New message from ${data.username} in channel ${channel}: ${data.message}`);

      // Save message to database
      try {
        await pool.query(
          'INSERT INTO messages (timestamp, username, message, channel) VALUES ($1, $2, $3, $4)',
          [timestamp, data.username, data.message, channel]
        );

        // Create message object with channel explicitly included
        const messageObject = {
          timestamp,
          username: data.username,
          message: data.message,
          channel: channel
        };

        console.log(`Broadcasting message to all clients with channel ${channel}:`, messageObject);

        // Broadcast to ALL clients, not just those in the channel
        // This way everyone can see notifications even if they're not in the channel
        io.emit('chat_message', messageObject);

        // Generate AI response using Groq
        const chatCompletion = await groq.chat.completions.create({
          messages: [{ role: "user", content: data.message }],
          model: "llama-3.1-8b-instant",
          temperature: 1,
          max_completion_tokens: 1024,
          top_p: 1,
          stream: false
        });

        const aiResponse = chatCompletion.choices[0]?.message?.content;

        if (aiResponse) {
          const aiTimestamp = new Date().toISOString();

          // Save AI response to database
          await pool.query(
            'INSERT INTO messages (timestamp, username, message, channel) VALUES ($1, $2, $3, $4)',
            [aiTimestamp, 'AI Assistant', aiResponse, channel]
          );

          // Broadcast AI response to all clients
          io.emit('chat_message', {
            timestamp: aiTimestamp,
            username: 'AI Assistant',
            message: aiResponse,
            channel: channel
          });
        }
      } catch (error) {
        console.error('Error saving message to database:', error);
        socket.emit('error', { message: 'Failed to save message' });
      }
    });

    // Handle username changes
    socket.on('username_change', async (data) => {
      // Update the username for this socket
      username = data.newUsername;

      // Log the username change as a system message to the specified channel
      const timestamp = new Date().toISOString();
      const channel = data.channel || 'general';
      const systemMessage = `${data.oldUsername} changed their username to ${data.newUsername}`;

      // Save system message to database
      try {
        await pool.query(
          'INSERT INTO messages (timestamp, username, message, channel) VALUES ($1, $2, $3, $4)',
          [timestamp, 'System', systemMessage, channel]
        );

        // Broadcast to all clients in the channel except the sender
        socket.to(channel).emit('chat_message', {
          timestamp,
          username: 'System',
          message: systemMessage,
          channel: channel
        });
      } catch (error) {
        console.error('Error saving username change to database:', error);
      }
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${username}`);
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
  module.exports = { setupSocketHandlers, pool };
}
