const request = require('supertest');
const { createServer } = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');
const express = require('express');
const fs = require('fs');
const path = require('path');

describe('Chat Server', () => {
  let app, server, io, clientSocket;
  const testLogPath = path.join(__dirname, '..', 'test-general.txt');
  
  beforeAll((done) => {
    // Setup express app and server for testing
    app = express();
    server = createServer(app);
    io = new Server(server);
    
    // Setup similar event handling as in the actual server
    io.on('connection', (socket) => {
      socket.on('user_connected', (data) => {
        const history = fs.existsSync(testLogPath) 
          ? fs.readFileSync(testLogPath, 'utf8').split('\n').filter(Boolean)
          : [];
        socket.emit('message_history', history);
      });

      socket.on('chat_message', (data) => {
        const timestamp = new Date().toISOString();
        const message = `${timestamp}|${data.username}|${data.message}`;
        
        if (fs.existsSync(testLogPath)) {
          fs.appendFileSync(testLogPath, message + '\n');
        } else {
          fs.writeFileSync(testLogPath, message + '\n');
        }
        
        io.emit('chat_message', {
          timestamp,
          username: data.username,
          message: data.message
        });
      });
    });

    // Start server on a test port
    server.listen(3001, () => {
      // Setup client socket for testing
      clientSocket = Client('http://localhost:3001');
      clientSocket.on('connect', done);
    });
  });

  afterAll((done) => {
    // Clean up
    if (fs.existsSync(testLogPath)) {
      fs.unlinkSync(testLogPath);
    }
    
    clientSocket.disconnect();
    server.close(done);
  });

  test('should receive message history on connection', (done) => {
    // Write a test message to the test log file
    const testMessage = `${new Date().toISOString()}|TestUser|Hello, test!`;
    fs.writeFileSync(testLogPath, testMessage + '\n');
    
    clientSocket.emit('user_connected', { username: 'TestUser' });
    
    clientSocket.once('message_history', (history) => {
      expect(history).toHaveLength(1);
      expect(history[0]).toBe(testMessage);
      done();
    });
  });
}); 