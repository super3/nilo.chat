const express = require('express');
const http = require('http');
const path = require('path');
const socketIo = require('socket.io');
const fs = require('fs');

// Create Express app and HTTP server
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Define available channels
const CHANNELS = ['general', 'feedback', 'slack-feed'];
// Define available DM channels
const DM_CHANNELS = ['dm_steve', 'dm_self'];

// Get channel log path function
const getChannelPath = (channel) => {
  if (DM_CHANNELS.includes(channel)) {
    // Handle DM channels
    return path.join(__dirname, 'channels', `${channel}.txt`);
  }
  
  if (!CHANNELS.includes(channel)) {
    console.warn(`Invalid channel: ${channel}, defaulting to general`);
    channel = 'general';
  }
  return path.join(__dirname, 'channels', `${channel}.txt`);
};

// Ensure channel files exist
[...CHANNELS, ...DM_CHANNELS].forEach(channel => {
  const channelPath = getChannelPath(channel);
  
  if (!fs.existsSync(channelPath)) {
    // Ensure the channels directory exists
    const channelsDir = path.join(__dirname, 'channels');
    if (!fs.existsSync(channelsDir)) {
      fs.mkdirSync(channelsDir);
    }
    fs.writeFileSync(channelPath, '');
    console.log(`Created channel file: ${channelPath}`);
    
    // If this is the steve DM channel, add a welcome message
    if (channel === 'dm_steve') {
      const timestamp = new Date().toISOString();
      const welcomeMessage = `${timestamp}|steve|Welcome to nilo.chat! I'm steve, your friendly assistant. Let me know if you need any help!`;
      fs.appendFileSync(channelPath, welcomeMessage + '\n');
    }
    
    // If this is the self DM channel, add info about the /nick command
    if (channel === 'dm_self') {
      const timestamp = new Date().toISOString();
      const selfWelcomeMessage = `${timestamp}|System|This is your personal space. You can change your username using the /nick command followed by your new username. Example: /nick SuperCoder`;
      fs.appendFileSync(channelPath, selfWelcomeMessage + '\n');
    }
  }
});

// Debug current environment
console.log(`Current NODE_ENV: "${process.env.NODE_ENV}"`);

// Serve static files and frontend routes only in development mode
if (process.env.NODE_ENV !== 'production') {
  console.log('Running in development mode - serving frontend files');
  // Serve static files from the 'dist' folder (production build)
  app.use(express.static(path.join(__dirname, '..', 'dist')));

  // Return the main index.html for all routes (SPA)
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
  });
} else {
  console.log('Running in production mode - not serving frontend files');
  
  // API-only mode in production - respond to non-socket requests with 200 OK
  app.get('*', (req, res) => {
    res.status(200).send('API Server Running');
  });
}

// Socket.IO event handling
function setupSocketHandlers(io) {
  return (socket) => {
    let username = 'Unknown User';
    
    // Handle user joining
    socket.on('user_connected', (data) => {
      username = data.username;
      const channel = data.channel || 'general';
      
      // Join the room for this channel
      socket.join(channel);
      
      // Also join the steve DM channel
      socket.join('dm_steve');
      
      // Also join the self DM channel
      socket.join('dm_self');
      
      // Send message history to the newly connected client
      const channelPath = getChannelPath(channel);
      const history = fs.readFileSync(channelPath, 'utf8').split('\n').filter(Boolean);
      socket.emit('message_history', history);
      
      // For first-time users, add a welcome message from steve to the dm_steve channel
      // but don't switch them to that channel
      const isFirstJoin = !data.isReturningUser;
      if (isFirstJoin) {
        const timestamp = new Date().toISOString();
        const welcomeMessage = {
          timestamp,
          username: 'steve',
          message: `Hello ${username}! Welcome to nilo.chat! Let me know if you need any help getting started.`,
          channel: 'dm_steve'  // Explicitly specify the channel
        };
        socket.emit('chat_message', welcomeMessage);
      }
    });

    // Handle channel change
    socket.on('join_channel', (data) => {
      const newChannel = data.channel || 'general';
      
      // Leave all regular channels (but stay in DM channels)
      CHANNELS.forEach(channel => {
        socket.leave(channel);
      });
      
      // If switching to a DM channel, leave other DM channels
      if (newChannel.startsWith('dm_')) {
        DM_CHANNELS.forEach(channel => {
          if (channel !== newChannel) {
            socket.leave(channel);
          }
        });
      }
      
      // Join the new channel
      socket.join(newChannel);
      
      // Send message history for the new channel
      const channelPath = getChannelPath(newChannel);
      const history = fs.readFileSync(channelPath, 'utf8').split('\n').filter(Boolean);
      socket.emit('message_history', history);
    });

    // Handle new messages
    socket.on('chat_message', (data) => {
      const timestamp = new Date().toISOString();
      const channel = data.channel || 'general';
      const message = `${timestamp}|${data.username}|${data.message}`;
      
      console.log(`New message from ${data.username} in channel ${channel}: ${data.message}`);
      
      // Log message to the channel's file
      const channelPath = getChannelPath(channel);
      fs.appendFileSync(channelPath, message + '\n');
      
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
    });

    // Handle username changes
    socket.on('username_change', (data) => {
      // Update the username for this socket
      username = data.newUsername;
      
      // Log the username change as a system message to the specified channel
      const timestamp = new Date().toISOString();
      const channel = data.channel || 'general';
      const systemMessage = `${timestamp}|System|${data.oldUsername} changed their username to ${data.newUsername}`;
      
      // Log message to the channel's file
      const channelPath = getChannelPath(channel);
      fs.appendFileSync(channelPath, systemMessage + '\n');
      
      // Broadcast to all clients in the channel except the sender
      socket.to(channel).emit('chat_message', {
        timestamp,
        username: 'System',
        message: `${data.oldUsername} changed their username to ${data.newUsername}`,
        channel: channel
      });
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${username}`);
    });
  };
}

io.on('connection', setupSocketHandlers(io));

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});

// Export for testing
if (process.env.NODE_ENV === 'test') {
  module.exports = { setupSocketHandlers };
} 