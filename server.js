const express = require('express');
const http = require('http');
const path = require('path');
const socketIo = require('socket.io');
const fs = require('fs');

// Create Express app and HTTP server
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Path to general.txt file for storing messages
const generalLogPath = path.join(__dirname, 'general.txt');

// Ensure general.txt exists (create if it doesn't)
if (!fs.existsSync(generalLogPath)) {
  fs.writeFileSync(generalLogPath, '');
}

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
io.on('connection', (socket) => {
  let username = 'Unknown User';
  
  // Handle user joining
  socket.on('user_connected', (data) => {
    username = data.username;
    console.log(`User connected: ${username}`);
    
    // Send message history to the newly connected client
    const history = fs.readFileSync(generalLogPath, 'utf8').split('\n').filter(Boolean);
    socket.emit('message_history', history);
  });

  // Handle new messages
  socket.on('chat_message', (data) => {
    const timestamp = new Date().toISOString();
    const message = `${timestamp}|${data.username}|${data.message}`;
    
    // Log message to general.txt
    fs.appendFileSync(generalLogPath, message + '\n');
    
    // Broadcast to all clients
    io.emit('chat_message', {
      timestamp,
      username: data.username,
      message: data.message
    });
  });

  // Handle username changes
  socket.on('username_change', (data) => {
    console.log(`Username change: ${data.oldUsername} -> ${data.newUsername}`);
    
    // Update the username for this socket
    username = data.newUsername;
    
    // Log the username change as a system message
    const timestamp = new Date().toISOString();
    const systemMessage = `${timestamp}|System|${data.oldUsername} changed their username to ${data.newUsername}`;
    
    // Log message to general.txt
    fs.appendFileSync(generalLogPath, systemMessage + '\n');
    
    // Broadcast to all clients except the sender
    socket.broadcast.emit('chat_message', {
      timestamp,
      username: 'System',
      message: `${data.oldUsername} changed their username to ${data.newUsername}`
    });
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${username}`);
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
}); 