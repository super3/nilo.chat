const express = require('express');
const http = require('http');
const io = require('socket.io-client');

// Track if we should fail the database connection test
let shouldFailDbConnection = false;

// Mock database pool
const mockPool = {
  query: jest.fn((sql, params, callback) => {
    // Handle both callback and promise-based queries
    if (typeof callback === 'function') {
      // Callback style - used for connection test
      callback(null, { rows: [{ now: new Date() }] });
      return;
    }

    // Check if we should fail the connection test
    if (shouldFailDbConnection && sql === 'SELECT NOW()') {
      return Promise.reject(new Error('Database connection failed'));
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

describe('Server Module - Database Connection Error', () => {
  let originalCreateServer;
  let mockServer;

  beforeEach(() => {
    mockServer = {
      listen: jest.fn((port, host, callback) => {
        const cb = typeof host === 'function' ? host : callback;
        if (cb) cb();
        return mockServer;
      })
    };
    originalCreateServer = http.createServer;
    http.createServer = jest.fn(() => mockServer);
  });

  afterEach(() => {
    http.createServer = originalCreateServer;
  });

  test('handles database connection error in initializeDatabase', async () => {
    // Set flag to fail database connection
    shouldFailDbConnection = true;

    // Spy on console.error
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

    // Load the server module - this will trigger initializeDatabase which should fail
    jest.isolateModules(() => {
      require('../server');
    });

    // Wait for async initializeDatabase to complete
    await new Promise(resolve => setTimeout(resolve, 50));

    // Verify error was logged
    expect(consoleErrorSpy).toHaveBeenCalledWith('Database connection error:', expect.any(Error));

    // Reset flag
    shouldFailDbConnection = false;
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });
});

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
  
  test('configures express with health check and catch-all route', () => {
    // Verify health check route was configured
    expect(mockExpressApp.get).toHaveBeenCalledWith('/health', expect.any(Function));

    // Verify catch-all route was configured
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
  
  test('serves static files and SPA catch-all in production mode', () => {
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

      // Verify static files and catch-all are served in production too
      expect(mockExpressApp.use).toHaveBeenCalled();
      expect(mockExpressApp.get).toHaveBeenCalledWith('*', expect.any(Function));

      // Test health check endpoint
      const healthHandler = mockExpressApp.get.mock.calls.find(call => call[0] === '/health')[1];
      const healthRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      healthHandler({}, healthRes);
      expect(healthRes.status).toHaveBeenCalledWith(200);

      // Test catch-all serves index.html
      const catchAllHandler = mockExpressApp.get.mock.calls.find(call => call[0] === '*')[1];
      const res = { sendFile: jest.fn() };
      catchAllHandler({}, res);
      expect(res.sendFile).toHaveBeenCalled();
      expect(res.sendFile.mock.calls[0][0]).toContain('index.html');
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

  test('formats message history correctly when database returns rows', async () => {
    // Mock socket for testing
    const socket = {
      join: jest.fn(),
      leave: jest.fn(),
      emit: jest.fn(),
      on: jest.fn(),
      to: jest.fn().mockReturnThis()
    };

    const io = {
      on: jest.fn(),
      to: jest.fn().mockReturnThis(),
      emit: jest.fn()
    };

    // Mock pool.query to return actual message rows
    const mockTimestamp = new Date('2024-01-15T10:30:00Z');
    mockPool.query.mockImplementation((sql) => {
      if (sql.includes('SELECT') && sql.includes('messages')) {
        return Promise.resolve({
          rows: [
            { timestamp: mockTimestamp, username: 'User1', message: 'Hello' },
            { timestamp: mockTimestamp, username: 'User2', message: 'Hi there' }
          ]
        });
      }
      return Promise.resolve({ rows: [], rowCount: 1 });
    });

    // Get the socket handler function
    const setupSocketHandlers = require('../server').setupSocketHandlers;
    const socketHandler = setupSocketHandlers(io);

    // Register handlers
    socketHandler(socket);

    // Get handlers
    const userConnectedHandler = socket.on.mock.calls.find(call => call[0] === 'user_connected')[1];
    const joinChannelHandler = socket.on.mock.calls.find(call => call[0] === 'join_channel')[1];

    // Test user_connected with message history
    await userConnectedHandler({ username: 'TestUser', channel: 'general' });

    // Verify formatted history was emitted
    expect(socket.emit).toHaveBeenCalledWith('message_history', expect.arrayContaining([
      expect.stringContaining('|User1|Hello'),
      expect.stringContaining('|User2|Hi there')
    ]));

    socket.emit.mockClear();

    // Test join_channel with message history
    await joinChannelHandler({ channel: 'feedback' });

    // Verify formatted history was emitted
    expect(socket.emit).toHaveBeenCalledWith('message_history', expect.arrayContaining([
      expect.stringContaining('|User1|Hello'),
      expect.stringContaining('|User2|Hi there')
    ]));

    // Reset mock
    mockPool.query.mockReset();
  });

  test('handles database error when loading message history in user_connected', async () => {
    // Mock socket for testing
    const socket = {
      join: jest.fn(),
      leave: jest.fn(),
      emit: jest.fn(),
      on: jest.fn(),
      to: jest.fn().mockReturnThis()
    };

    const io = {
      on: jest.fn(),
      to: jest.fn().mockReturnThis(),
      emit: jest.fn()
    };

    // Mock pool.query to throw error on SELECT
    mockPool.query.mockImplementation((sql) => {
      if (sql.includes('SELECT')) {
        return Promise.reject(new Error('Database error'));
      }
      return Promise.resolve({ rows: [], rowCount: 1 });
    });

    // Get the socket handler function
    const setupSocketHandlers = require('../server').setupSocketHandlers;
    const socketHandler = setupSocketHandlers(io);

    // Register handlers
    socketHandler(socket);

    // Get user_connected handler
    const userConnectedHandler = socket.on.mock.calls.find(call => call[0] === 'user_connected')[1];

    // Spy on console.error
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Test user_connected with database error
    await userConnectedHandler({ username: 'TestUser', channel: 'general' });

    // Verify error was logged and empty history was emitted
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error loading message history:', expect.any(Error));
    expect(socket.emit).toHaveBeenCalledWith('message_history', []);

    consoleErrorSpy.mockRestore();
    mockPool.query.mockReset();
  });

  test('handles database error when loading message history in join_channel', async () => {
    // Mock socket for testing
    const socket = {
      join: jest.fn(),
      leave: jest.fn(),
      emit: jest.fn(),
      on: jest.fn(),
      to: jest.fn().mockReturnThis()
    };

    const io = {
      on: jest.fn(),
      to: jest.fn().mockReturnThis(),
      emit: jest.fn()
    };

    // Mock pool.query to throw error on SELECT
    mockPool.query.mockImplementation((sql) => {
      if (sql.includes('SELECT')) {
        return Promise.reject(new Error('Database error'));
      }
      return Promise.resolve({ rows: [], rowCount: 1 });
    });

    // Get the socket handler function
    const setupSocketHandlers = require('../server').setupSocketHandlers;
    const socketHandler = setupSocketHandlers(io);

    // Register handlers
    socketHandler(socket);

    // Get join_channel handler
    const joinChannelHandler = socket.on.mock.calls.find(call => call[0] === 'join_channel')[1];

    // Spy on console.error
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Test join_channel with database error
    await joinChannelHandler({ channel: 'feedback' });

    // Verify error was logged and empty history was emitted
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error loading message history:', expect.any(Error));
    expect(socket.emit).toHaveBeenCalledWith('message_history', []);

    consoleErrorSpy.mockRestore();
    mockPool.query.mockReset();
  });

  test('handles database error when saving chat message', async () => {
    // Mock socket for testing
    const socket = {
      join: jest.fn(),
      leave: jest.fn(),
      emit: jest.fn(),
      on: jest.fn(),
      to: jest.fn().mockReturnThis()
    };

    const io = {
      on: jest.fn(),
      to: jest.fn().mockReturnThis(),
      emit: jest.fn()
    };

    // Mock pool.query to throw error on INSERT
    mockPool.query.mockImplementation((sql) => {
      if (sql.includes('INSERT')) {
        return Promise.reject(new Error('Database write error'));
      }
      return Promise.resolve({ rows: [] });
    });

    // Get the socket handler function
    const setupSocketHandlers = require('../server').setupSocketHandlers;
    const socketHandler = setupSocketHandlers(io);

    // Register handlers
    socketHandler(socket);

    // Get chat_message handler
    const chatMessageHandler = socket.on.mock.calls.find(call => call[0] === 'chat_message')[1];

    // Spy on console.error
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Test chat_message with database error
    await chatMessageHandler({ username: 'TestUser', message: 'Hello', channel: 'general' });

    // Verify error was logged and error was emitted to socket
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error saving message to database:', expect.any(Error));
    expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Failed to save message' });

    consoleErrorSpy.mockRestore();
    mockPool.query.mockReset();
  });

  test('rejects chat_message with empty message', async () => {
    await mockSocket.chatMessageCallback({ username: 'TestUser', message: '' });
    expect(mockSocket.emit).toHaveBeenCalledWith('error', { message: 'Message cannot be empty' });
    expect(mockPool.query).not.toHaveBeenCalledWith(
      expect.stringContaining('INSERT'),
      expect.anything()
    );
  });

  test('rejects chat_message with missing message', async () => {
    await mockSocket.chatMessageCallback({ username: 'TestUser' });
    expect(mockSocket.emit).toHaveBeenCalledWith('error', { message: 'Message cannot be empty' });
  });

  test('rejects chat_message exceeding max length', async () => {
    const longMessage = 'a'.repeat(2001);
    await mockSocket.chatMessageCallback({ username: 'TestUser', message: longMessage });
    expect(mockSocket.emit).toHaveBeenCalledWith('error', {
      message: 'Message exceeds maximum length of 2000 characters'
    });
  });

  test('rejects chat_message with empty username', async () => {
    await mockSocket.chatMessageCallback({ username: '', message: 'Hello' });
    expect(mockSocket.emit).toHaveBeenCalledWith('error', { message: 'Username is required' });
  });

  test('rejects chat_message with missing username', async () => {
    await mockSocket.chatMessageCallback({ message: 'Hello' });
    expect(mockSocket.emit).toHaveBeenCalledWith('error', { message: 'Username is required' });
  });

  test('rejects username_change with empty new username', async () => {
    await mockSocket.usernameChangeCallback({ oldUsername: 'Old', newUsername: '' });
    expect(mockSocket.emit).toHaveBeenCalledWith('error', { message: 'Username cannot be empty' });
  });

  test('rejects username_change with missing new username', async () => {
    await mockSocket.usernameChangeCallback({ oldUsername: 'Old' });
    expect(mockSocket.emit).toHaveBeenCalledWith('error', { message: 'Username cannot be empty' });
  });

  test('rejects username_change exceeding max length', async () => {
    const longUsername = 'a'.repeat(31);
    await mockSocket.usernameChangeCallback({ oldUsername: 'Old', newUsername: longUsername });
    expect(mockSocket.emit).toHaveBeenCalledWith('error', {
      message: 'Username exceeds maximum length of 30 characters'
    });
  });

  test('handles database error when saving username change', async () => {
    // Mock socket for testing
    const socket = {
      join: jest.fn(),
      leave: jest.fn(),
      emit: jest.fn(),
      on: jest.fn(),
      to: jest.fn().mockReturnThis()
    };

    const io = {
      on: jest.fn(),
      to: jest.fn().mockReturnThis(),
      emit: jest.fn()
    };

    // Mock pool.query to throw error on INSERT
    mockPool.query.mockImplementation((sql) => {
      if (sql.includes('INSERT')) {
        return Promise.reject(new Error('Database write error'));
      }
      return Promise.resolve({ rows: [] });
    });

    // Get the socket handler function
    const setupSocketHandlers = require('../server').setupSocketHandlers;
    const socketHandler = setupSocketHandlers(io);

    // Register handlers
    socketHandler(socket);

    // Get username_change handler
    const usernameChangeHandler = socket.on.mock.calls.find(call => call[0] === 'username_change')[1];

    // Spy on console.error
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Test username_change with database error
    await usernameChangeHandler({ oldUsername: 'OldName', newUsername: 'NewName', channel: 'general' });

    // Verify error was logged
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error saving username change to database:', expect.any(Error));

    consoleErrorSpy.mockRestore();
    mockPool.query.mockReset();
  });

});

