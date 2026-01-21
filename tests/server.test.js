const express = require('express');
const http = require('http');
const io = require('socket.io-client');

// Mock Groq SDK
jest.mock('groq-sdk', () => ({
  Groq: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'Mock AI response' } }]
        })
      }
    }
  }))
}));

// Mock database pool
const mockPool = {
  query: jest.fn((sql, params, callback) => {
    // Handle both callback and promise-based queries
    if (typeof callback === 'function') {
      // Callback style - used for connection test
      callback(null, { rows: [{ now: new Date() }] });
      return;
    }

    // Promise style - used for actual queries
    if (sql.includes('SELECT')) {
      // Return empty history by default
      return Promise.resolve({ rows: [] });
    } else if (sql.includes('INSERT')) {
      // Return success for inserts
      return Promise.resolve({ rows: [], rowCount: 1 });
    }
    return Promise.resolve({ rows: [] });
  }),
  end: jest.fn()
};

// Mock pg module
jest.mock('pg', () => ({
  Pool: jest.fn(() => mockPool)
}));

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
    emit: jest.fn(),
    to: jest.fn(() => ({
      emit: jest.fn()
    }))
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
        } else if (event === 'join_channel') {
          mockSocket.joinChannelCallback = callback;
        }
        return mockSocket;
      }),
      emit: jest.fn(),
      join: jest.fn(),
      leave: jest.fn(),
      to: jest.fn(() => ({
        emit: jest.fn()
      })),
      broadcast: {
        emit: jest.fn()
      }
    };
    
    // Mock http server
    mockServer = {
      listen: jest.fn((port, host, callback) => {
        // Handle both listen(port, callback) and listen(port, host, callback)
        const cb = typeof host === 'function' ? host : callback;
        if (cb) cb();
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

    // Clear mock pool calls
    mockPool.query.mockClear();
  });
  
  test('initializes socket.io with connection event handler', () => {
    // Verify socket.io was called
    expect(mockSocketIo).toHaveBeenCalled();
    
    // Verify connection event was set up
    expect(mockIO.on).toHaveBeenCalledWith('connection', expect.any(Function));
  });
  
  test('sets up user_connected event handler', async () => {
    // Verify socket.on was called for user_connected event
    expect(mockSocket.on).toHaveBeenCalledWith('user_connected', expect.any(Function));

    // Simulate user_connected event (it's async now)
    await mockSocket.userConnectedCallback({
      username: 'TestUser',
      channel: 'general'
    });

    // Verify message history was emitted back to the client
    expect(mockSocket.emit).toHaveBeenCalledWith('message_history', expect.any(Array));
  });
  
  test('sets up chat_message event handler and broadcasts messages', async () => {
    // Verify socket.on was called for chat_message event
    expect(mockSocket.on).toHaveBeenCalledWith('chat_message', expect.any(Function));

    // Simulate chat_message event
    const messageData = {
      username: 'TestUser',
      message: 'Hello, test message!'
    };

    // Setup mock IO to emitter
    const mockToEmitter = jest.fn();
    mockIO.to.mockReturnValue({ emit: mockToEmitter });

    // Call the handler (it's async now)
    await mockSocket.chatMessageCallback(messageData);

    // Verify message was broadcast to the room
    expect(mockIO.emit).toHaveBeenCalledWith('chat_message', expect.objectContaining({
      username: messageData.username,
      message: messageData.message
    }));

    // Verify database INSERT was called
    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO messages'),
      expect.arrayContaining([
        expect.any(String), // timestamp
        messageData.username,
        messageData.message,
        'general' // default channel
      ])
    );

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
  
  test('handles username_change event and broadcasts notification', async () => {
    // Verify socket.on was called for username_change event
    expect(mockSocket.on).toHaveBeenCalledWith('username_change', expect.any(Function));

    // Store the username_change callback for testing
    const usernameChangeCallback = mockSocket.on.mock.calls.find(
      call => call[0] === 'username_change'
    )[1];

    // Setup mock socket.to emitter
    const mockToEmitter = jest.fn();
    mockSocket.to.mockReturnValue({ emit: mockToEmitter });

    // Prepare test data
    const changeData = {
      oldUsername: 'OldUserName',
      newUsername: 'NewUserName'
    };

    // Call the handler (it's async now)
    await usernameChangeCallback(changeData);

    // Verify username was updated and broadcast to the room
    expect(mockSocket.to).toHaveBeenCalledWith('general');
    expect(mockToEmitter).toHaveBeenCalledWith('chat_message', expect.objectContaining({
      username: 'System',
      message: `${changeData.oldUsername} changed their username to ${changeData.newUsername}`
    }));

    // Verify database INSERT was called
    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO messages'),
      expect.arrayContaining([
        expect.any(String), // timestamp
        'System',
        `${changeData.oldUsername} changed their username to ${changeData.newUsername}`,
        'general' // default channel
      ])
    );
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
    // Verify health check route was configured
    expect(mockExpressApp.get).toHaveBeenCalledWith('/health', expect.any(Function));

    // Verify root route was configured
    expect(mockExpressApp.get).toHaveBeenCalledWith('/', expect.any(Function));

    // Verify catch-all route was configured in development mode
    expect(mockExpressApp.get).toHaveBeenCalledWith('*', expect.any(Function));

    // Test health check endpoint
    const healthHandler = mockExpressApp.get.mock.calls.find(call => call[0] === '/health')[1];
    const healthReq = {};
    const healthRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    healthHandler(healthReq, healthRes);
    expect(healthRes.status).toHaveBeenCalledWith(200);
    expect(healthRes.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'ok' }));

    // Test root endpoint
    const rootHandler = mockExpressApp.get.mock.calls.find(call => call[0] === '/')[1];
    const rootReq = {};
    const rootRes = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn()
    };
    rootHandler(rootReq, rootRes);
    expect(rootRes.status).toHaveBeenCalledWith(200);
    expect(rootRes.send).toHaveBeenCalled();

    // Get the catch-all route handler (should be the one with '*')
    const handler = mockExpressApp.get.mock.calls.find(call => call[0] === '*')[1];

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

      // Verify health check route was configured
      expect(mockExpressApp.get).toHaveBeenCalledWith('/health', expect.any(Function));

      // Verify root route was configured
      expect(mockExpressApp.get).toHaveBeenCalledWith('/', expect.any(Function));

      // In production mode, there should NOT be a wildcard route
      const wildcardCalls = mockExpressApp.get.mock.calls.filter(call => call[0] === '*');
      expect(wildcardCalls.length).toBe(0);

      // Test health check endpoint
      const healthHandler = mockExpressApp.get.mock.calls.find(call => call[0] === '/health')[1];
      const healthReq = {};
      const healthRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      healthHandler(healthReq, healthRes);
      expect(healthRes.status).toHaveBeenCalledWith(200);

      // Test root endpoint
      const rootHandler = mockExpressApp.get.mock.calls.find(call => call[0] === '/')[1];

      // Create mock request and response
      const req = {};
      const res = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
      };

      // Call the handler
      rootHandler(req, res);

      // Verify response status and message
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith('Nilo.chat API Server - OK');
    } finally {
      // Restore original NODE_ENV
      process.env.NODE_ENV = originalNodeEnv;
    }
  });
  
  // Test removed - file-based storage replaced with database
  
  test('server listens on configured port', () => {
    // Verify server.listen was called
    expect(mockServer.listen).toHaveBeenCalled();

    // Verify port
    const port = process.env.PORT || 3000;
    expect(mockServer.listen.mock.calls[0][0]).toBe(port);

    // Verify host
    expect(mockServer.listen.mock.calls[0][1]).toBe('0.0.0.0');

    // Verify callback was provided
    expect(typeof mockServer.listen.mock.calls[0][2]).toBe('function');
  });

  test('handlers should use default channel when none is provided', async () => {
    // Mock socket for testing
    const socket = {
      join: jest.fn(),
      leave: jest.fn(),
      emit: jest.fn(),
      to: jest.fn().mockReturnThis()
    };

    // Create handlers
    const handlers = {};
    socket.on = jest.fn((event, callback) => {
      handlers[event] = callback;
    });

    // Test join_channel handler with no channel
    let onConnection;
    const mockIO = {
      on: jest.fn((event, callback) => {
        if (event === 'connection') {
          onConnection = callback;
        }
      }),
      to: jest.fn().mockReturnThis(),
      emit: jest.fn()
    };

    // Simulate connection
    onConnection = require('../server').setupSocketHandlers(mockIO);
    onConnection(socket);

    // Test join_channel with no channel specified
    await handlers.join_channel({});
    expect(socket.leave).toHaveBeenCalled();
    expect(socket.join).toHaveBeenCalledWith('general');

    // Test user_connected with no channel specified
    socket.join.mockClear();
    await handlers.user_connected({ username: 'testuser' });
    expect(socket.join).toHaveBeenCalledWith('general');

    // Test chat_message with no channel specified
    await handlers.chat_message({ username: 'testuser', message: 'hello' });

    // Test username_change with no channel specified
    await handlers.username_change({ oldUsername: 'old', newUsername: 'new' });
  });

  // File-based tests removed - replaced with database storage

  test('handles both first-time and returning users correctly', async () => {
    // Mock socket for testing
    const socket = {
      join: jest.fn(),
      leave: jest.fn(),
      emit: jest.fn(),
      on: jest.fn()
    };

    const io = {
      on: jest.fn()
    };

    // Get the socket handler function
    const setupSocketHandlers = require('../server').setupSocketHandlers;
    const socketHandler = setupSocketHandlers(io);

    // Register handlers
    socketHandler(socket);

    // Get user_connected handler
    const userConnectedHandler = socket.on.mock.calls.find(call => call[0] === 'user_connected')[1];

    // Reset socket.emit mock to clear previous calls
    socket.emit.mockClear();

    // Test first-time user (isReturningUser = false or undefined)
    await userConnectedHandler({
      username: 'TestUser',
      channel: 'general',
      // isReturningUser not provided (undefined)
    });

    // For first-time users, should only emit message_history
    expect(socket.emit).toHaveBeenCalledWith('message_history', expect.any(Array));

    // Reset socket.emit mock
    socket.emit.mockClear();

    // Test returning user (isReturningUser = true)
    await userConnectedHandler({
      username: 'ReturningUser',
      channel: 'general',
      isReturningUser: true
    });

    // For returning users, should only emit message_history, not the welcome message
    expect(socket.emit).toHaveBeenCalledWith('message_history', expect.any(Array));
    
    // Make sure we only had one call to emit (the message_history)
    expect(socket.emit).toHaveBeenCalledTimes(1);
  });
});

// Database-based message operations are tested in the socket handler tests above 