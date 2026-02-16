const http = require('http');
const ioClient = require('socket.io-client');

// Mock Groq SDK before requiring server module
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

// Mock pg Pool
const mockPool = {
  query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  end: jest.fn()
};

jest.mock('pg', () => ({
  Pool: jest.fn(() => mockPool)
}));

// Mock express to prevent the module-level server.listen() from binding a port
const mockExpressApp = { use: jest.fn(), get: jest.fn() };
jest.mock('express', () => {
  const fn = jest.fn(() => mockExpressApp);
  fn.static = jest.fn(() => 'static-middleware');
  return fn;
});

// Mock http.createServer so server.js module-level listen() is a no-op
const mockServerInstance = {
  listen: jest.fn((port, host, cb) => {
    const callback = typeof host === 'function' ? host : cb;
    if (callback) callback();
    return mockServerInstance;
  })
};

// Save real createServer before mocking
const originalCreateServer = http.createServer.bind(http);

jest.spyOn(http, 'createServer').mockReturnValue(mockServerInstance);

// Mock socket.io constructor used by server.js module-level code
jest.mock('socket.io', () => {
  return jest.fn(() => ({
    on: jest.fn(),
    emit: jest.fn(),
    to: jest.fn(() => ({ emit: jest.fn() }))
  }));
});

// Now require the server module - its module-level code runs against mocks
const { setupSocketHandlers } = require('../server');

describe('Socket.io Integration Tests', () => {
  let httpServer;
  let io;
  let serverPort;

  beforeAll((done) => {
    // Create a real HTTP server and socket.io instance for integration testing
    httpServer = originalCreateServer();
    const { Server } = jest.requireActual('socket.io');
    io = new Server(httpServer, { cors: { origin: '*' } });
    io.on('connection', setupSocketHandlers(io));
    httpServer.listen(0, () => {
      serverPort = httpServer.address().port;
      done();
    });
  });

  afterAll((done) => {
    io.disconnectSockets(true);
    io.close();
    httpServer.close(done);
  });

  beforeEach(() => {
    mockPool.query.mockReset();
    mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  function connectClient() {
    return ioClient(`http://localhost:${serverPort}`, {
      transports: ['websocket'],
      forceNew: true
    });
  }

  function waitForEvent(socket, event, timeout = 3000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timeout waiting for "${event}"`)), timeout);
      socket.once(event, (data) => {
        clearTimeout(timer);
        resolve(data);
      });
    });
  }

  test('client connects and receives message history on user_connected', async () => {
    const mockTimestamp = new Date('2024-01-15T10:30:00Z');
    mockPool.query.mockResolvedValue({
      rows: [
        { timestamp: mockTimestamp, username: 'Alice', message: 'Hello' },
        { timestamp: mockTimestamp, username: 'Bob', message: 'Hi there' }
      ]
    });

    const client = connectClient();

    try {
      const historyPromise = waitForEvent(client, 'message_history');
      client.emit('user_connected', { username: 'TestUser', channel: 'general' });
      const history = await historyPromise;

      expect(Array.isArray(history)).toBe(true);
      expect(history).toHaveLength(2);
      expect(history[0]).toContain('Alice');
      expect(history[0]).toContain('Hello');
      expect(history[1]).toContain('Bob');
      expect(history[1]).toContain('Hi there');
    } finally {
      client.disconnect();
    }
  });

  test('message from one client is broadcast to another client', async () => {
    const client1 = connectClient();
    const client2 = connectClient();

    try {
      const history1Promise = waitForEvent(client1, 'message_history');
      const history2Promise = waitForEvent(client2, 'message_history');
      client1.emit('user_connected', { username: 'Alice', channel: 'general' });
      client2.emit('user_connected', { username: 'Bob', channel: 'general' });
      await Promise.all([history1Promise, history2Promise]);

      const messagePromise = waitForEvent(client2, 'chat_message');

      client1.emit('chat_message', {
        username: 'Alice',
        message: 'Hello everyone!',
        channel: 'general'
      });

      const received = await messagePromise;
      expect(received.username).toBe('Alice');
      expect(received.message).toBe('Hello everyone!');
      expect(received.channel).toBe('general');
    } finally {
      client1.disconnect();
      client2.disconnect();
    }
  });

  test('AI response is broadcast after user message', async () => {
    const client = connectClient();

    try {
      const historyPromise = waitForEvent(client, 'message_history');
      client.emit('user_connected', { username: 'TestUser', channel: 'general' });
      await historyPromise;

      const messages = [];
      const aiResponsePromise = new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timeout waiting for AI response')), 5000);
        client.on('chat_message', (data) => {
          messages.push(data);
          if (messages.length >= 2) {
            clearTimeout(timer);
            resolve();
          }
        });
      });

      client.emit('chat_message', {
        username: 'TestUser',
        message: 'Hello AI!',
        channel: 'general'
      });

      await aiResponsePromise;

      expect(messages[0].username).toBe('TestUser');
      expect(messages[0].message).toBe('Hello AI!');
      expect(messages[1].username).toBe('Austin');
      expect(messages[1].message).toBe('Mock AI response');
    } finally {
      client.disconnect();
    }
  });

  test('client receives new history after switching channels', async () => {
    const feedbackTimestamp = new Date('2024-02-01T12:00:00Z');
    let queryCount = 0;

    mockPool.query.mockImplementation((sql) => {
      if (sql.includes('SELECT') && sql.includes('messages')) {
        queryCount++;
        if (queryCount === 1) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({
          rows: [
            { timestamp: feedbackTimestamp, username: 'Admin', message: 'Welcome to feedback' }
          ]
        });
      }
      return Promise.resolve({ rows: [], rowCount: 1 });
    });

    const client = connectClient();

    try {
      const generalHistory = waitForEvent(client, 'message_history');
      client.emit('user_connected', { username: 'TestUser', channel: 'general' });
      await generalHistory;

      const feedbackHistory = waitForEvent(client, 'message_history');
      client.emit('join_channel', { channel: 'feedback' });
      const history = await feedbackHistory;

      expect(history).toHaveLength(1);
      expect(history[0]).toContain('Admin');
      expect(history[0]).toContain('Welcome to feedback');
    } finally {
      client.disconnect();
    }
  });

  test('username change is broadcast to other clients in the channel', async () => {
    const client1 = connectClient();
    const client2 = connectClient();

    try {
      const h1 = waitForEvent(client1, 'message_history');
      const h2 = waitForEvent(client2, 'message_history');
      client1.emit('user_connected', { username: 'OldName', channel: 'general' });
      client2.emit('user_connected', { username: 'Bob', channel: 'general' });
      await Promise.all([h1, h2]);

      const systemMsg = waitForEvent(client2, 'chat_message');

      client1.emit('username_change', {
        oldUsername: 'OldName',
        newUsername: 'NewName',
        channel: 'general'
      });

      const received = await systemMsg;
      expect(received.username).toBe('System');
      expect(received.message).toContain('OldName');
      expect(received.message).toContain('NewName');
    } finally {
      client1.disconnect();
      client2.disconnect();
    }
  });

  test('database error on chat_message emits error to sender', async () => {
    mockPool.query.mockImplementation((sql) => {
      if (sql.includes('INSERT')) {
        return Promise.reject(new Error('DB write failed'));
      }
      return Promise.resolve({ rows: [] });
    });

    const client = connectClient();

    try {
      const historyPromise = waitForEvent(client, 'message_history');
      client.emit('user_connected', { username: 'TestUser', channel: 'general' });
      await historyPromise;

      const errorPromise = waitForEvent(client, 'error');
      client.emit('chat_message', {
        username: 'TestUser',
        message: 'This will fail',
        channel: 'general'
      });

      const error = await errorPromise;
      expect(error.message).toBe('Failed to save message');
    } finally {
      client.disconnect();
    }
  });

  test('empty history returned on database error during join', async () => {
    mockPool.query.mockRejectedValue(new Error('DB read failed'));

    const client = connectClient();

    try {
      const historyPromise = waitForEvent(client, 'message_history');
      client.emit('user_connected', { username: 'TestUser', channel: 'general' });
      const history = await historyPromise;

      expect(history).toEqual([]);
    } finally {
      client.disconnect();
    }
  });
});
