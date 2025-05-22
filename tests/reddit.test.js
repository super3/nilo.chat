jest.useFakeTimers();
jest.setTimeout(10000);

jest.mock('node-fetch', () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock('socket.io-client', () => jest.fn());

const fetchMock = require('node-fetch').default;
const socketIo = require('socket.io-client');

// Import functions after mocks are set up
const reddit = require('../scripts/reddit');
const {
  extractPostedIds,
  updatePostedIds,
  sendToSlackFeed,
  fetchRedditPosts
} = reddit;

describe('reddit utilities', () => {
  test('extractPostedIds parses stored IDs', () => {
    const messages = [
      '2025|User|hello',
      `2025|RedditBot|!POSTED_IDS: ["abc","def"]`
    ];
    const ids = extractPostedIds(messages);
    expect(ids).toEqual(new Set(['abc', 'def']));
  });

  test('updatePostedIds emits message', async () => {
    const socket = { emit: jest.fn() };
    const ids = new Set(['a', 'b']);
    const promise = updatePostedIds(ids, socket);
    jest.runAllTimers();
    await promise;
    expect(socket.emit).toHaveBeenCalledWith('chat_message', expect.objectContaining({
      username: 'RedditBot',
      channel: 'slack-feed',
      message: expect.stringContaining('!POSTED_IDS:')
    }));
  });

  test('sendToSlackFeed emits formatted message', async () => {
    const socket = { emit: jest.fn() };
    const post = {
      title: 'Hello',
      subreddit: 'r/test',
      score: 1,
      num_comments: 2,
      url: 'https://example.com'
    };
    const promise = sendToSlackFeed(post, socket);
    jest.runAllTimers();
    await promise;
    expect(socket.emit).toHaveBeenCalledWith('chat_message', expect.objectContaining({
      username: 'RedditBot',
      channel: 'slack-feed',
      message: expect.stringContaining('Reddit: Hello')
    }));
  });
});

describe('fetchRedditPosts', () => {
  test('returns empty array when connection fails', async () => {
    const socket = { on: jest.fn(), emit: jest.fn(), disconnect: jest.fn() };
    socketIo.mockReturnValue(socket);

    const promise = fetchRedditPosts('test');
    jest.runAllTimers();
    const posts = await promise;

    expect(posts).toEqual([]);
  });
});
