// Mock socket.io-client
const mockSocket = {
  on: jest.fn(),
  emit: jest.fn(),
  disconnect: jest.fn(),
};

jest.mock('socket.io-client', () => ({
  io: jest.fn(() => mockSocket),
}));

// Mock @anthropic-ai/sdk
const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn(() => ({
    messages: { create: mockCreate },
  }));
});

const { io } = require('socket.io-client');
const { start, getAIResponse, addToHistory, getHistory, truncateMessage, channelHistory } = require('../src/bot/index');

describe('Bot Client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear channel history
    Object.keys(channelHistory).forEach(key => delete channelHistory[key]);
  });

  describe('truncateMessage', () => {
    test('returns short messages unchanged', () => {
      expect(truncateMessage('hello')).toBe('hello');
    });

    test('truncates messages exceeding 2000 characters', () => {
      const longMessage = 'a'.repeat(2500);
      const result = truncateMessage(longMessage);
      expect(result.length).toBe(2000);
      expect(result.endsWith('...')).toBe(true);
    });

    test('returns exactly 2000 char messages unchanged', () => {
      const exactMessage = 'a'.repeat(2000);
      expect(truncateMessage(exactMessage)).toBe(exactMessage);
    });
  });

  describe('conversation history', () => {
    test('getHistory returns empty array for new channel', () => {
      expect(getHistory('test-channel')).toEqual([]);
    });

    test('addToHistory adds messages', () => {
      addToHistory('general', 'user', 'hello');
      addToHistory('general', 'assistant', 'hi there');
      expect(getHistory('general')).toEqual([
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'hi there' },
      ]);
    });

    test('addToHistory caps at MAX_HISTORY (20) messages', () => {
      for (let i = 0; i < 25; i++) {
        addToHistory('general', 'user', `message ${i}`);
      }
      const history = getHistory('general');
      expect(history.length).toBe(20);
      expect(history[0].content).toBe('message 5');
      expect(history[19].content).toBe('message 24');
    });

    test('channels have independent histories', () => {
      addToHistory('general', 'user', 'general msg');
      addToHistory('feedback', 'user', 'feedback msg');
      expect(getHistory('general')).toEqual([{ role: 'user', content: 'general msg' }]);
      expect(getHistory('feedback')).toEqual([{ role: 'user', content: 'feedback msg' }]);
    });
  });

  describe('getAIResponse', () => {
    test('calls Anthropic API and returns response', async () => {
      mockCreate.mockResolvedValue({
        content: [{ text: 'Hello from Claude!' }],
      });

      const reply = await getAIResponse('general', 'hi', 'TestUser');

      expect(reply).toBe('Hello from Claude!');
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 1024,
          system: expect.stringContaining('#general'),
          messages: expect.any(Array),
        })
      );
    });

    test('adds user message and assistant reply to history', async () => {
      mockCreate.mockResolvedValue({
        content: [{ text: 'response' }],
      });

      await getAIResponse('general', 'hello', 'User1');

      const history = getHistory('general');
      expect(history).toEqual([
        { role: 'user', content: 'User1: hello' },
        { role: 'assistant', content: 'response' },
      ]);
    });

    test('propagates API errors', async () => {
      mockCreate.mockRejectedValue(new Error('API rate limit'));

      await expect(getAIResponse('general', 'hi', 'User1')).rejects.toThrow('API rate limit');
    });
  });

  describe('start', () => {
    test('connects to nilo server with correct options', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      start();

      expect(io).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          reconnection: true,
          reconnectionAttempts: Infinity,
        })
      );

      consoleLogSpy.mockRestore();
    });

    test('registers connect handler that joins channels', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      start();

      // Find the connect handler
      const connectCall = mockSocket.on.mock.calls.find(c => c[0] === 'connect');
      expect(connectCall).toBeDefined();

      // Simulate connect
      connectCall[1]();

      // Should emit user_connected for the first channel
      expect(mockSocket.emit).toHaveBeenCalledWith('user_connected', expect.objectContaining({
        username: 'Austin',
        channel: 'welcome',
        isReturningUser: true,
      }));

      // Should join remaining channels
      expect(mockSocket.emit).toHaveBeenCalledWith('join_channel', expect.objectContaining({
        channel: 'general',
      }));
      expect(mockSocket.emit).toHaveBeenCalledWith('join_channel', expect.objectContaining({
        channel: 'growth',
      }));
      expect(mockSocket.emit).toHaveBeenCalledWith('join_channel', expect.objectContaining({
        channel: 'feedback',
      }));

      consoleLogSpy.mockRestore();
    });

    test('registers chat_message handler that ignores own messages', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      start();

      const chatHandler = mockSocket.on.mock.calls.find(c => c[0] === 'chat_message');
      expect(chatHandler).toBeDefined();

      // Simulate own message
      await chatHandler[1]({ username: 'Austin', message: 'hello', channel: 'general' });

      // Should not call Anthropic API
      expect(mockCreate).not.toHaveBeenCalled();

      consoleLogSpy.mockRestore();
    });

    test('registers chat_message handler that ignores System messages', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      start();

      const chatHandler = mockSocket.on.mock.calls.find(c => c[0] === 'chat_message');
      await chatHandler[1]({ username: 'System', message: 'User joined', channel: 'general' });

      expect(mockCreate).not.toHaveBeenCalled();

      consoleLogSpy.mockRestore();
    });

    test('registers chat_message handler that ignores unknown channels', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      start();

      const chatHandler = mockSocket.on.mock.calls.find(c => c[0] === 'chat_message');
      await chatHandler[1]({ username: 'User1', message: 'hello', channel: 'unknown-channel' });

      expect(mockCreate).not.toHaveBeenCalled();

      consoleLogSpy.mockRestore();
    });

    test('responds to user messages with AI reply', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      mockCreate.mockResolvedValue({
        content: [{ text: 'Hi there!' }],
      });

      start();

      const chatHandler = mockSocket.on.mock.calls.find(c => c[0] === 'chat_message');
      await chatHandler[1]({ username: 'User1', message: 'hello', channel: 'general' });

      expect(mockCreate).toHaveBeenCalled();
      expect(mockSocket.emit).toHaveBeenCalledWith('chat_message', {
        username: 'Austin',
        message: 'Hi there!',
        channel: 'general',
      });

      consoleLogSpy.mockRestore();
    });

    test('handles AI API errors gracefully', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      mockCreate.mockRejectedValue(new Error('API error'));

      start();

      const chatHandler = mockSocket.on.mock.calls.find(c => c[0] === 'chat_message');
      await chatHandler[1]({ username: 'User1', message: 'hello', channel: 'general' });

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error getting AI response:', 'API error');

      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    test('registers disconnect handler', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      start();

      const disconnectCall = mockSocket.on.mock.calls.find(c => c[0] === 'disconnect');
      expect(disconnectCall).toBeDefined();

      // Simulate disconnect
      disconnectCall[1]('io server disconnect');

      consoleLogSpy.mockRestore();
    });

    test('registers connect_error handler', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      start();

      const errorCall = mockSocket.on.mock.calls.find(c => c[0] === 'connect_error');
      expect(errorCall).toBeDefined();

      // Simulate error
      errorCall[1](new Error('connection refused'));

      expect(consoleErrorSpy).toHaveBeenCalledWith('Connection error:', 'connection refused');

      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    test('uses default channel when message has no channel', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      mockCreate.mockResolvedValue({
        content: [{ text: 'reply' }],
      });

      start();

      const chatHandler = mockSocket.on.mock.calls.find(c => c[0] === 'chat_message');
      await chatHandler[1]({ username: 'User1', message: 'hello' });

      expect(mockSocket.emit).toHaveBeenCalledWith('chat_message', expect.objectContaining({
        channel: 'general',
      }));

      consoleLogSpy.mockRestore();
    });
  });
});
