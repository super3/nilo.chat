const fs = require('fs');
const path = require('path');
const express = require('express');
const http = require('http');

// Path to the real general.txt file
const REAL_GENERAL_PATH = path.join(__dirname, '..', 'general.txt');

// Create a backup of the general.txt content before tests
const backupGeneralContent = fs.existsSync(REAL_GENERAL_PATH) 
  ? fs.readFileSync(REAL_GENERAL_PATH, 'utf8')
  : '';

// Mock modules
const mockStaticMiddleware = 'static-middleware';
const mockExpressApp = {
  use: jest.fn(),
  get: jest.fn()
};

// Store IO instance for tests
let mockIO;

// Create a mock socketIo function
const mockSocketIo = jest.fn(() => {
  mockIO = {
    on: jest.fn((event, callback) => {
      if (event === 'connection') {
        // Store the callback for later use in tests
        global.socketConnectionCallback = callback;
      }
      return mockIO;
    }),
    emit: jest.fn()
  };
  return mockIO;
});

// Mock express and socket.io
jest.mock('express', () => {
  const mockExpress = jest.fn(() => mockExpressApp);
  mockExpress.static = jest.fn(() => mockStaticMiddleware);
  return mockExpress;
});

jest.mock('socket.io', () => mockSocketIo);

describe('Server Module - Comprehensive', () => {
  let mockSocket;
  let mockServer;
  let originalCreateServer;
  let serverModule;
  
  beforeEach(() => {
    // Setup for a clean test environment
    jest.clearAllMocks();
    
    // Create mock socket for testing
    mockSocket = {
      on: jest.fn((event, callback) => {
        // Store callbacks for later use in tests
        if (event === 'user_connected') {
          mockSocket.userConnectedCallback = callback;
        } else if (event === 'chat_message') {
          mockSocket.chatMessageCallback = callback;
        } else if (event === 'disconnect') {
          mockSocket.disconnectCallback = callback;
        } else if (event === 'username_change') {
          mockSocket.usernameChangeCallback = callback;
        }
        return mockSocket;
      }),
      emit: jest.fn(),
      broadcast: {
        emit: jest.fn()
      }
    };
    
    // Mock http server
    mockServer = {
      listen: jest.fn((port, callback) => {
        if (callback) callback();
        return mockServer;
      })
    };
    
    // Mock http.createServer
    originalCreateServer = http.createServer;
    http.createServer = jest.fn(() => mockServer);
    
    // Load the server with our mocks in place
    jest.isolateModules(() => {
      serverModule = require('../server');
    });
    
    // Simulate socket connection if callback was stored
    if (global.socketConnectionCallback) {
      global.socketConnectionCallback(mockSocket);
    }
  });
  
  afterEach(() => {
    // Restore original createServer
    http.createServer = originalCreateServer;
    
    // Clean up global
    delete global.socketConnectionCallback;
  });
  
  // Restore the original general.txt content after all tests
  afterAll(() => {
    // Only write back if we had a backup
    if (backupGeneralContent) {
      fs.writeFileSync(REAL_GENERAL_PATH, backupGeneralContent);
    }
  });
  
  test('initializes socket.io with connection event handler', () => {
    // Verify socket.io was called
    expect(mockSocketIo).toHaveBeenCalled();
    
    // Verify connection event was set up
    expect(mockIO.on).toHaveBeenCalledWith('connection', expect.any(Function));
  });
  
  test('sets up user_connected event handler', () => {
    // Verify socket.on was called for user_connected event
    expect(mockSocket.on).toHaveBeenCalledWith('user_connected', expect.any(Function));
    
    // Simulate user_connected event
    mockSocket.userConnectedCallback({ username: 'TestUser' });
    
    // Verify message history was emitted back to the client
    expect(mockSocket.emit).toHaveBeenCalledWith('message_history', expect.any(Array));
  });
  
  test('sets up chat_message event handler and broadcasts messages', () => {
    // Verify socket.on was called for chat_message event
    expect(mockSocket.on).toHaveBeenCalledWith('chat_message', expect.any(Function));
    
    // Simulate chat_message event
    const messageData = {
      username: 'TestUser',
      message: 'Hello, test message!'
    };
    
    // Create spy to monitor appendFileSync calls
    const appendFileSpy = jest.spyOn(fs, 'appendFileSync');
    
    // Call the handler
    mockSocket.chatMessageCallback(messageData);
    
    // Verify message was broadcast
    expect(mockIO.emit).toHaveBeenCalledWith('chat_message', expect.objectContaining({
      username: messageData.username,
      message: messageData.message
    }));
    
    // Verify appendFileSync was called with the right message content
    expect(appendFileSpy).toHaveBeenCalled();
    const callArgs = appendFileSpy.mock.calls[0];
    expect(callArgs[0]).toContain('general.txt');
    expect(callArgs[1]).toContain(messageData.username);
    expect(callArgs[1]).toContain(messageData.message);
    
    // Restore the spy
    appendFileSpy.mockRestore();
  });
  
  test('sets up disconnect event handler', () => {
    // Verify socket.on was called for disconnect event
    expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
    
    // Call the disconnect handler
    if (mockSocket.disconnectCallback) {
      mockSocket.disconnectCallback();
    }
    
    // No specific behavior to test here, just covering the code path
  });
  
  test('handles username_change event and broadcasts notification', () => {
    // Verify socket.on was called for username_change event
    expect(mockSocket.on).toHaveBeenCalledWith('username_change', expect.any(Function));
    
    // Store the username_change callback for testing
    const usernameChangeCallback = mockSocket.on.mock.calls.find(
      call => call[0] === 'username_change'
    )[1];
    
    // Create spy to monitor appendFileSync calls
    const appendFileSpy = jest.spyOn(fs, 'appendFileSync');
    
    // Prepare test data
    const changeData = {
      oldUsername: 'OldUserName',
      newUsername: 'NewUserName'
    };
    
    // Call the handler
    usernameChangeCallback(changeData);
    
    // Verify username was updated in the socket handler
    expect(mockSocket.broadcast.emit).toHaveBeenCalledWith('chat_message', expect.objectContaining({
      username: 'System',
      message: `${changeData.oldUsername} changed their username to ${changeData.newUsername}`
    }));
    
    // Verify appendFileSync was called with the right message content
    expect(appendFileSpy).toHaveBeenCalled();
    const callArgs = appendFileSpy.mock.calls[0];
    expect(callArgs[0]).toContain('general.txt');
    expect(callArgs[1]).toContain('System');
    expect(callArgs[1]).toContain(`${changeData.oldUsername} changed their username to ${changeData.newUsername}`);
    
    // Restore the spy
    appendFileSpy.mockRestore();
  });
  
  test('configures express with static file middleware', () => {
    // Get express instance
    const express = require('express');
    
    // Verify express was called
    expect(express).toHaveBeenCalled();
    
    // Verify express.static was called with the dist directory
    expect(express.static).toHaveBeenCalled();
    expect(express.static.mock.calls[0][0]).toContain('dist');
    
    // Verify app.use was called
    expect(mockExpressApp.use).toHaveBeenCalled();
  });
  
  test('configures express with catch-all route', () => {
    // Verify catch-all route was configured
    expect(mockExpressApp.get).toHaveBeenCalledWith('*', expect.any(Function));
    
    // Get the route handler
    const handler = mockExpressApp.get.mock.calls[0][1];
    
    // Create mock request and response
    const req = {};
    const res = { sendFile: jest.fn() };
    
    // Call the handler
    handler(req, res);
    
    // Verify response.sendFile was called with the index.html path
    expect(res.sendFile).toHaveBeenCalled();
    expect(res.sendFile.mock.calls[0][0]).toContain('index.html');
  });
  
  test('handles production mode routes correctly', () => {
    // Save original NODE_ENV
    const originalNodeEnv = process.env.NODE_ENV;
    
    try {
      // Set to production mode
      process.env.NODE_ENV = 'production';
      
      // Clear mocks
      jest.clearAllMocks();
      
      // Reload server module in production mode
      jest.isolateModules(() => {
        require('../server');
      });
      
      // Verify catch-all route was configured
      expect(mockExpressApp.get).toHaveBeenCalledWith('*', expect.any(Function));
      
      // Get the route handler
      const handler = mockExpressApp.get.mock.calls[0][1];
      
      // Create mock request and response
      const req = {};
      const res = { 
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
      };
      
      // Call the handler
      handler(req, res);
      
      // Verify response status and message
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith('API Server Running');
    } finally {
      // Restore original NODE_ENV
      process.env.NODE_ENV = originalNodeEnv;
    }
  });
  
  test('ensures general.txt file exists on startup', () => {
    // Spy on writeFileSync
    const writeFileSpy = jest.spyOn(fs, 'writeFileSync');
    const existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValueOnce(false);
    
    // Require the server again to trigger file creation
    jest.isolateModules(() => {
      require('../server');
    });
    
    // Verify writeFileSync was called to create an empty file
    expect(writeFileSpy).toHaveBeenCalled();
    expect(writeFileSpy.mock.calls[0][0]).toContain('general.txt');
    
    // Restore the spies
    writeFileSpy.mockRestore();
    existsSpy.mockRestore();
  });
  
  test('server listens on configured port', () => {
    // Verify server.listen was called
    expect(mockServer.listen).toHaveBeenCalled();
    
    // Verify port
    const port = process.env.PORT || 3000;
    expect(mockServer.listen.mock.calls[0][0]).toBe(port);
    
    // Verify callback was provided
    expect(typeof mockServer.listen.mock.calls[0][1]).toBe('function');
  });
});

describe('Chat Message Operations', () => {
  // This test suite uses a separate test file to avoid modifying production file
  const testLogPath = path.join(__dirname, 'test-message-log.txt');
  
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