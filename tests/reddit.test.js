const {
  extractPostedIds,
  updatePostedIds,
  sendToSlackFeed,
  fetchRedditPosts
} = require('../scripts/reddit');

jest.mock('socket.io-client');

const socketIoClient = require('socket.io-client');

describe('reddit utilities', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  test('extractPostedIds parses IDs from message history', () => {
    const messages = [
      '2025-05-22T00:00:00Z|User|Hello',
      '2025-05-22T00:01:00Z|RedditBot|!POSTED_IDS: ["a","b","c"]'
    ];
    const ids = extractPostedIds(messages);
    expect(ids).toEqual(new Set(['a', 'b', 'c']));
  });

  test('sendToSlackFeed emits formatted chat message', async () => {
    jest.useFakeTimers();
    const mockSocket = { emit: jest.fn() };
    const post = {
      title: 'Test',
      subreddit: 'r/test',
      score: 1,
      num_comments: 2,
      url: 'https://example.com'
    };
    const promise = sendToSlackFeed(post, mockSocket);
    jest.runAllTimers();
    await promise;
    expect(mockSocket.emit).toHaveBeenCalledWith(
      'chat_message',
      expect.objectContaining({
        username: 'RedditBot',
        channel: 'slack-feed'
      })
    );
  });

  test('updatePostedIds emits ID list message', async () => {
    jest.useFakeTimers();
    const mockSocket = { emit: jest.fn() };
    const ids = new Set(['abc']);
    const promise = updatePostedIds(ids, mockSocket);
    jest.runAllTimers();
    await promise;
    expect(mockSocket.emit).toHaveBeenCalledWith(
      'chat_message',
      expect.objectContaining({
        username: 'RedditBot',
        channel: 'slack-feed'
      })
    );
    expect(mockSocket.emit.mock.calls[0][1].message).toContain('!POSTED_IDS:');
  });

  test('fetchRedditPosts returns empty array when connection fails', async () => {
    jest.useFakeTimers();
    const socket = {
      on: jest.fn((event, cb) => {
        if (event === 'connect_error') {
          cb(new Error('fail'));
        }
        return socket;
      }),
      emit: jest.fn(),
      disconnect: jest.fn()
    };
    socketIoClient.mockReturnValue(socket);

    const postsPromise = fetchRedditPosts('test');
    jest.runAllTimers();
    const posts = await postsPromise;

    expect(posts).toEqual([]);
  });
});
