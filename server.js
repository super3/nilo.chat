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

// Serve static files from the 'dist' folder (production build)
app.use(express.static(path.join(__dirname, 'dist')));

// Return the main index.html for all routes (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

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

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${username}`);
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 