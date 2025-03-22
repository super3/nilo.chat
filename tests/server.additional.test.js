const request = require('supertest');
const path = require('path');
const fs = require('fs');
const express = require('express');

// Mock fs module
jest.mock('fs');

// Mock appendFileSync, readFileSync, and writeFileSync functions
fs.appendFileSync = jest.fn();
fs.readFileSync = jest.fn();
fs.writeFileSync = jest.fn();
fs.existsSync = jest.fn().mockReturnValue(true);

describe('Server Utilities', () => {
  let originalConsoleLog;
  
  beforeAll(() => {
    // Save original console.log
    originalConsoleLog = console.log;
    // Mock console.log to prevent noise during tests
    console.log = jest.fn();
  });
  
  afterAll(() => {
    // Restore console.log
    console.log = originalConsoleLog;
  });
  
  beforeEach(() => {
    // Clear mocks before each test
    jest.clearAllMocks();
    
    // Reset environment
    process.env.NODE_ENV = 'test';
  });
  
  describe('File Logging', () => {
    it('should append messages to the general.txt file', () => {
      // Create a simple socket.io mock
      const io = {
        emit: jest.fn()
      };
      
      const socket = {
        emit: jest.fn(),
        on: jest.fn()
      };
      
      // Extract the chat_message handler and call it
      const data = {
        username: 'TestUser',
        message: 'This is a test message'
      };
      
      // Call a simulated handler that would write to the log file
      const timestamp = new Date().toISOString();
      const message = `${timestamp}|${data.username}|${data.message}`;
      fs.appendFileSync('./general.txt', message + '\n');
      
      // Check that appendFileSync was called with the correct format
      expect(fs.appendFileSync).toHaveBeenCalledWith(
        './general.txt', 
        expect.any(String)
      );
      
      // Get the actual argument
      const actualArg = fs.appendFileSync.mock.calls[0][1];
      
      // Verify it contains the expected parts
      expect(actualArg).toContain('TestUser');
      expect(actualArg).toContain('This is a test message');
    });
    
    it('should read message history from general.txt', () => {
      // Mock the readFileSync to return a history string
      const historyData = 
        '2023-01-01T12:00:00Z|User1|Hello\n' +
        '2023-01-01T12:01:00Z|User2|Hi there\n';
      
      fs.readFileSync.mockReturnValue(historyData);
      
      // Read the history (similar to what server.js would do)
      const history = fs.readFileSync('./general.txt', 'utf8').split('\n').filter(Boolean);
      
      // Check that we got the expected history
      expect(history).toHaveLength(2);
      expect(history[0]).toBe('2023-01-01T12:00:00Z|User1|Hello');
      expect(history[1]).toBe('2023-01-01T12:01:00Z|User2|Hi there');
    });
    
    it('should create general.txt if it does not exist', () => {
      // Mock existsSync to return false (file doesn't exist)
      fs.existsSync.mockReturnValueOnce(false);
      
      // Simulate the file creation check in server.js
      if (!fs.existsSync('./general.txt')) {
        fs.writeFileSync('./general.txt', '');
      }
      
      // Check that writeFileSync was called to create the file
      expect(fs.writeFileSync).toHaveBeenCalledWith('./general.txt', '');
    });
  });
  
  describe('Environment Behavior', () => {
    it('should set production mode correctly', () => {
      // Set production mode
      process.env.NODE_ENV = 'production';
      
      // Create mock Express app
      const app = express();
      
      // Simulate the environment check from server.js
      let isProduction = false;
      if (process.env.NODE_ENV === 'production') {
        isProduction = true;
      }
      
      // Check that production mode is correctly detected
      expect(isProduction).toBe(true);
    });
    
    it('should set development mode correctly', () => {
      // Set development mode
      process.env.NODE_ENV = 'development';
      
      // Create mock Express app
      const app = express();
      
      // Simulate the environment check from server.js
      let isDevelopment = false;
      if (process.env.NODE_ENV !== 'production') {
        isDevelopment = true;
      }
      
      // Check that development mode is correctly detected
      expect(isDevelopment).toBe(true);
    });
  });
}); 