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
const CHANNELS = ['general', 'feedback'];

// Get channel log path function
const getChannelPath = (channel) => {
  if (!CHANNELS.includes(channel)) {
    console.warn(`Invalid channel: ${channel}, defaulting to general`);
    channel = 'general';
  }
  return path.join(__dirname, 'channels', `${channel}.txt`);
};

// Ensure channel files exist
CHANNELS.forEach(channel => {
  const channelPath = getChannelPath(channel);
  
  if (!fs.existsSync(channelPath)) {
    // Ensure the channels directory exists
    const channelsDir = path.join(__dirname, 'channels');
    if (!fs.existsSync(channelsDir)) {
      fs.mkdirSync(channelsDir);
    }
    fs.writeFileSync(channelPath, '');
    console.log(`Created channel file: ${channelPath}`);
  }
});

// Debug current environment
console.log(`Current NODE_ENV: "${process.env.NODE_ENV}"`);

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
  
  // API-only mode in production - respond to non-socket requests with 200 OK
  app.get('*', (req, res) => {
    res.status(200).send('API Server Running');
  });
}

// Socket.IO event handling
function setupSocketHandlers(io, socket) {
  return (socket) => {
    let username = 'Unknown User';
    
    // Handle user joining
    socket.on('user_connected', (data) => {
      username = data.username;
      const channel = data.channel || 'general';
      
      // Join the room for this channel
      socket.join(channel);
      
      // Send message history to the newly connected client
      const channelPath = getChannelPath(channel);
      const history = fs.readFileSync(channelPath, 'utf8').split('\n').filter(Boolean);
      socket.emit('message_history', history);
    });

    // Handle channel change
    socket.on('join_channel', (data) => {
      const newChannel = data.channel || 'general';
      
      // Leave all channels and join the new one
      CHANNELS.forEach(channel => {
        socket.leave(channel);
      });
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
      
      // Log message to the channel's file
      const channelPath = getChannelPath(channel);
      fs.appendFileSync(channelPath, message + '\n');
      
      // Broadcast to all clients in the channel
      io.to(channel).emit('chat_message', {
        timestamp,
        username: data.username,
        message: data.message
      });
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
        message: `${data.oldUsername} changed their username to ${data.newUsername}`
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