/**
 * @jest-environment node
 */
const { NiloBotClient, CHANNELS } = require('../src/server/bot-client');

// Mock socket.io-client
const mockSocket = {
  on: jest.fn(),
  emit: jest.fn(),
  disconnect: jest.fn(),
};

jest.mock('socket.io-client', () => ({
  io: jest.fn(() => mockSocket),
}));

const { io: mockIo } = require('socket.io-client');

describe('NiloBotClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset on to store callbacks
    mockSocket.on.mockImplementation(() => mockSocket);
  });

  test('throws if serverUrl is missing', () => {
    expect(() => new NiloBotClient(null, 'Bot')).toThrow('serverUrl is required');
  });

  test('throws if username is missing', () => {
    expect(() => new NiloBotClient('http://localhost:3000', '')).toThrow('username is required');
  });

  test('connect() resolves on successful connection', async () => {
    // Capture callbacks registered via socket.on
    const callbacks = {};
    mockSocket.on.mockImplementation((event, fn) => {
      callbacks[event] = fn;
      return mockSocket;
    });

    const bot = new NiloBotClient('http://localhost:3000', 'TestBot');
    const connectPromise = bot.connect();

    // Simulate connection
    callbacks.connect();

    await connectPromise;

    expect(bot.connected).toBe(true);
    expect(mockSocket.emit).toHaveBeenCalledWith('user_connected', {
      username: 'TestBot',
      channel: 'general',
    });
  });

  test('connect() rejects on connection error before connected', async () => {
    const callbacks = {};
    mockSocket.on.mockImplementation((event, fn) => {
      callbacks[event] = fn;
      return mockSocket;
    });

    const bot = new NiloBotClient('http://localhost:3000', 'TestBot');
    const connectPromise = bot.connect();

    // Simulate connection error
    callbacks.connect_error(new Error('refused'));

    await expect(connectPromise).rejects.toThrow('Connection failed: refused');
  });

  test('sendMessage emits chat_message', async () => {
    const callbacks = {};
    mockSocket.on.mockImplementation((event, fn) => {
      callbacks[event] = fn;
      return mockSocket;
    });

    const bot = new NiloBotClient('http://localhost:3000', 'TestBot');
    const connectPromise = bot.connect();
    callbacks.connect();
    await connectPromise;

    mockSocket.emit.mockClear();

    bot.sendMessage('general', 'Hello!');

    expect(mockSocket.emit).toHaveBeenCalledWith('chat_message', {
      username: 'TestBot',
      message: 'Hello!',
      channel: 'general',
    });
  });

  test('sendMessage throws for invalid channel', async () => {
    const callbacks = {};
    mockSocket.on.mockImplementation((event, fn) => {
      callbacks[event] = fn;
      return mockSocket;
    });

    const bot = new NiloBotClient('http://localhost:3000', 'TestBot');
    const connectPromise = bot.connect();
    callbacks.connect();
    await connectPromise;

    expect(() => bot.sendMessage('invalid-channel', 'Hi')).toThrow('Invalid channel');
  });

  test('sendMessage throws when not connected', () => {
    const bot = new NiloBotClient('http://localhost:3000', 'TestBot');
    expect(() => bot.sendMessage('general', 'Hi')).toThrow('Not connected');
  });

  test('joinChannel emits join_channel and updates currentChannel', async () => {
    const callbacks = {};
    mockSocket.on.mockImplementation((event, fn) => {
      callbacks[event] = fn;
      return mockSocket;
    });

    const bot = new NiloBotClient('http://localhost:3000', 'TestBot');
    const connectPromise = bot.connect();
    callbacks.connect();
    await connectPromise;

    mockSocket.emit.mockClear();

    bot.joinChannel('feedback');

    expect(bot.currentChannel).toBe('feedback');
    expect(mockSocket.emit).toHaveBeenCalledWith('join_channel', { channel: 'feedback' });
  });

  test('joinChannel throws for invalid channel', async () => {
    const callbacks = {};
    mockSocket.on.mockImplementation((event, fn) => {
      callbacks[event] = fn;
      return mockSocket;
    });

    const bot = new NiloBotClient('http://localhost:3000', 'TestBot');
    const connectPromise = bot.connect();
    callbacks.connect();
    await connectPromise;

    expect(() => bot.joinChannel('nope')).toThrow('Invalid channel');
  });

  test('onMessage receives incoming messages', async () => {
    const callbacks = {};
    mockSocket.on.mockImplementation((event, fn) => {
      callbacks[event] = fn;
      return mockSocket;
    });

    const bot = new NiloBotClient('http://localhost:3000', 'TestBot');
    const received = [];
    bot.onMessage((msg) => received.push(msg));

    const connectPromise = bot.connect();
    callbacks.connect();
    await connectPromise;

    const testMsg = { username: 'User1', message: 'Hi', channel: 'general', timestamp: '2026-01-01T00:00:00Z' };
    callbacks.chat_message(testMsg);

    expect(received).toEqual([testMsg]);
  });

  test('onHistory receives history payloads', async () => {
    const callbacks = {};
    mockSocket.on.mockImplementation((event, fn) => {
      callbacks[event] = fn;
      return mockSocket;
    });

    const bot = new NiloBotClient('http://localhost:3000', 'TestBot');
    const received = [];
    bot.onHistory((h) => received.push(h));

    const connectPromise = bot.connect();
    callbacks.connect();
    await connectPromise;

    callbacks.message_history(['msg1', 'msg2']);

    expect(received).toEqual([['msg1', 'msg2']]);
  });

  test('onError receives error payloads', async () => {
    const callbacks = {};
    mockSocket.on.mockImplementation((event, fn) => {
      callbacks[event] = fn;
      return mockSocket;
    });

    const bot = new NiloBotClient('http://localhost:3000', 'TestBot');
    const received = [];
    bot.onError((e) => received.push(e));

    const connectPromise = bot.connect();
    callbacks.connect();
    await connectPromise;

    callbacks.error({ message: 'oops' });

    expect(received).toEqual([{ message: 'oops' }]);
  });

  test('disconnect closes the socket', async () => {
    const callbacks = {};
    mockSocket.on.mockImplementation((event, fn) => {
      callbacks[event] = fn;
      return mockSocket;
    });

    const bot = new NiloBotClient('http://localhost:3000', 'TestBot');
    const connectPromise = bot.connect();
    callbacks.connect();
    await connectPromise;

    bot.disconnect();

    expect(mockSocket.disconnect).toHaveBeenCalled();
    expect(bot.connected).toBe(false);
  });

  test('sendMessage switches channel when different from current', async () => {
    const callbacks = {};
    mockSocket.on.mockImplementation((event, fn) => {
      callbacks[event] = fn;
      return mockSocket;
    });

    const bot = new NiloBotClient('http://localhost:3000', 'TestBot');
    const connectPromise = bot.connect();
    callbacks.connect();
    await connectPromise;

    mockSocket.emit.mockClear();

    // Currently on 'general', send to 'feedback'
    bot.sendMessage('feedback', 'Switching!');

    // Should have emitted join_channel first, then chat_message
    expect(mockSocket.emit).toHaveBeenCalledWith('join_channel', { channel: 'feedback' });
    expect(mockSocket.emit).toHaveBeenCalledWith('chat_message', {
      username: 'TestBot',
      message: 'Switching!',
      channel: 'feedback',
    });
  });

  test('CHANNELS exports the correct list', () => {
    expect(CHANNELS).toEqual(['welcome', 'general', 'growth', 'feedback']);
  });

  test('uses custom initial channel from options', async () => {
    const callbacks = {};
    mockSocket.on.mockImplementation((event, fn) => {
      callbacks[event] = fn;
      return mockSocket;
    });

    const bot = new NiloBotClient('http://localhost:3000', 'TestBot', { channel: 'welcome' });
    const connectPromise = bot.connect();
    callbacks.connect();
    await connectPromise;

    expect(mockSocket.emit).toHaveBeenCalledWith('user_connected', {
      username: 'TestBot',
      channel: 'welcome',
    });
  });

  test('joinChannel throws when not connected', () => {
    const bot = new NiloBotClient('http://localhost:3000', 'TestBot');
    expect(() => bot.joinChannel('general')).toThrow('Not connected');
  });

  test('disconnect does nothing when socket is null', () => {
    const bot = new NiloBotClient('http://localhost:3000', 'TestBot');
    // socket is null before connect(); should not throw
    expect(() => bot.disconnect()).not.toThrow();
    expect(bot.connected).toBe(false);
  });

  test('connect_error after already connected does not reject', async () => {
    const callbacks = {};
    mockSocket.on.mockImplementation((event, fn) => {
      callbacks[event] = fn;
      return mockSocket;
    });

    const bot = new NiloBotClient('http://localhost:3000', 'TestBot');
    const connectPromise = bot.connect();
    callbacks.connect();
    await connectPromise;

    // Fire connect_error after already connected — should be silently ignored
    expect(() => callbacks.connect_error(new Error('transient'))).not.toThrow();
    expect(bot.connected).toBe(true);
  });

  test('disconnect on socket sets connected to false', async () => {
    const callbacks = {};
    mockSocket.on.mockImplementation((event, fn) => {
      callbacks[event] = fn;
      return mockSocket;
    });

    const bot = new NiloBotClient('http://localhost:3000', 'TestBot');
    const connectPromise = bot.connect();
    callbacks.connect();
    await connectPromise;

    expect(bot.connected).toBe(true);

    // Simulate server-side disconnect
    callbacks.disconnect();
    expect(bot.connected).toBe(false);
  });
});
