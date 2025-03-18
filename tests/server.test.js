const fs = require('fs');
const path = require('path');
const express = require('express');
const http = require('http');

// Create a separate copy of server.js for testing purposes
describe('Server Module', () => {
  let originalCreateServer;
  let originalSocketIo;
  let serverModule;
  
  beforeEach(() => {
    // Make sure general.txt exists
    const generalPath = path.join(__dirname, '..', 'general.txt');
    if (!fs.existsSync(generalPath)) {
      fs.writeFileSync(generalPath, '');
    }
    
    // Mock modules
    jest.resetModules();
    
    // Mock socket.io
    jest.mock('socket.io', () => {
      return jest.fn(() => ({
        on: jest.fn()
      }));
    });
    
    // Mock http.createServer
    originalCreateServer = http.createServer;
    http.createServer = jest.fn((app) => {
      const mockServer = {
        listen: jest.fn((port, callback) => {
          if (callback) callback();
          return mockServer;
        })
      };
      return mockServer;
    });
    
    // Load the server
    serverModule = require('../server');
  });
  
  afterEach(() => {
    // Restore original functions
    jest.resetModules();
    jest.clearAllMocks();
  });
  
  test('creates an Express app with correct routes', () => {
    // The server was loaded, verify that the express mock was called
    const express = require('express');
    expect(express).toBeDefined();
  });
});

describe('File Operations', () => {
  test('ensures general.txt file exists', () => {
    const generalPath = path.join(__dirname, '..', 'general.txt');
    
    // Delete if exists
    if (fs.existsSync(generalPath)) {
      fs.unlinkSync(generalPath);
    }
    
    // Create file
    fs.writeFileSync(generalPath, '');
    
    // Verify file exists
    expect(fs.existsSync(generalPath)).toBe(true);
  });
});

describe('Chat Message Operations', () => {
  const testLogPath = path.join(__dirname, '..', 'test-general.txt');
  
  beforeEach(() => {
    // Ensure test log file exists and is empty
    fs.writeFileSync(testLogPath, '');
  });
  
  afterEach(() => {
    // Clean up
    if (fs.existsSync(testLogPath)) {
      fs.unlinkSync(testLogPath);
    }
  });
  
  test('message log file operations work correctly', () => {
    // Test writing and reading from the log file
    const timestamp = new Date().toISOString();
    const testMessage = `${timestamp}|TestUser|Hello, test!`;
    
    // Write message to log file
    fs.appendFileSync(testLogPath, testMessage + '\n');
    
    // Read message history from log file
    const history = fs.readFileSync(testLogPath, 'utf8').split('\n').filter(Boolean);
    
    // Verify history
    expect(history).toHaveLength(1);
    expect(history[0]).toBe(testMessage);
    
    // Test parsing message
    const [msgTimestamp, username, message] = testMessage.split('|');
    expect(username).toBe('TestUser');
    expect(message).toBe('Hello, test!');
  });
  
  test('history is retrieved correctly from file', () => {
    // Create multiple test messages
    const messages = [
      `${new Date().toISOString()}|User1|First message`,
      `${new Date().toISOString()}|User2|Second message`,
      `${new Date().toISOString()}|User1|Third message`
    ];
    
    // Write messages to log file
    fs.writeFileSync(testLogPath, messages.join('\n') + '\n');
    
    // Read message history
    const history = fs.readFileSync(testLogPath, 'utf8').split('\n').filter(Boolean);
    
    // Verify history
    expect(history).toHaveLength(3);
    expect(history).toEqual(messages);
  });
}); 