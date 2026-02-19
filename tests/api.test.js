/**
 * @jest-environment node
 */
const express = require('express');
const request = require('supertest');
const { createApiRouter } = require('../src/server/api');

// Helpers -------------------------------------------------------------------

function buildApp(mockPool, mockIo) {
  const app = express();
  app.use(express.json());
  app.use('/api', createApiRouter(mockPool, mockIo));
  return app;
}

function defaultMockPool() {
  return {
    query: jest.fn().mockResolvedValue({ rows: [] }),
  };
}

function defaultMockIo() {
  return { emit: jest.fn() };
}

// Tests ---------------------------------------------------------------------

describe('REST API — /api/channels', () => {
  test('returns all channels with descriptions', async () => {
    const app = buildApp(defaultMockPool(), defaultMockIo());
    const res = await request(app).get('/api/channels');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(4);
    expect(res.body[0]).toEqual({
      name: 'welcome',
      description: 'Say hi — no account needed.',
    });
    expect(res.body.map((c) => c.name)).toEqual(['welcome', 'general', 'growth', 'feedback']);
  });
});

describe('REST API — GET /api/messages/:channel', () => {
  test('returns messages for a valid channel', async () => {
    const mockRows = [
      { timestamp: '2026-01-01T00:00:00Z', username: 'Alice', message: 'Hi', channel: 'general' },
      { timestamp: '2026-01-01T00:01:00Z', username: 'Bob', message: 'Hey', channel: 'general' },
    ];
    const pool = defaultMockPool();
    // The API fetches DESC and then reverses, so mock returns DESC order
    pool.query.mockResolvedValue({ rows: [...mockRows].reverse() });

    const app = buildApp(pool, defaultMockIo());
    const res = await request(app).get('/api/messages/general');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    // API fetches DESC then reverses → chronological (oldest first)
    expect(res.body[0].username).toBe('Alice');
    expect(res.body[1].username).toBe('Bob');

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT'),
      ['general', 50] // default limit
    );
  });

  test('rejects invalid channel', async () => {
    const app = buildApp(defaultMockPool(), defaultMockIo());
    const res = await request(app).get('/api/messages/invalid');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid channel/);
  });

  test('clamps limit to MAX_LIMIT', async () => {
    const pool = defaultMockPool();
    const app = buildApp(pool, defaultMockIo());
    await request(app).get('/api/messages/general?limit=999');

    expect(pool.query).toHaveBeenCalledWith(expect.any(String), ['general', 200]);
  });

  test('uses default limit for invalid value', async () => {
    const pool = defaultMockPool();
    const app = buildApp(pool, defaultMockIo());
    await request(app).get('/api/messages/general?limit=abc');

    expect(pool.query).toHaveBeenCalledWith(expect.any(String), ['general', 50]);
  });

  test('handles database error gracefully', async () => {
    const pool = defaultMockPool();
    pool.query.mockRejectedValue(new Error('DB down'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    const app = buildApp(pool, defaultMockIo());
    const res = await request(app).get('/api/messages/general');

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to read messages');

    consoleSpy.mockRestore();
  });
});

describe('REST API — POST /api/messages', () => {
  test('creates a message and broadcasts via Socket.IO', async () => {
    const pool = defaultMockPool();
    const io = defaultMockIo();
    const app = buildApp(pool, io);

    const res = await request(app)
      .post('/api/messages')
      .send({ channel: 'general', message: 'Hello API!', username: 'TestBot' });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Hello API!');
    expect(res.body.username).toBe('TestBot');
    expect(res.body.channel).toBe('general');
    expect(res.body.timestamp).toBeDefined();

    // Verify DB insert
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO messages'),
      expect.arrayContaining(['TestBot', 'Hello API!', 'general'])
    );

    // Verify Socket.IO broadcast
    expect(io.emit).toHaveBeenCalledWith('chat_message', expect.objectContaining({
      message: 'Hello API!',
      username: 'TestBot',
      channel: 'general',
    }));
  });

  test('rejects missing channel', async () => {
    const app = buildApp(defaultMockPool(), defaultMockIo());
    const res = await request(app)
      .post('/api/messages')
      .send({ message: 'Hi', username: 'Bot' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid channel/);
  });

  test('rejects invalid channel', async () => {
    const app = buildApp(defaultMockPool(), defaultMockIo());
    const res = await request(app)
      .post('/api/messages')
      .send({ channel: 'nope', message: 'Hi', username: 'Bot' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid channel/);
  });

  test('rejects empty message', async () => {
    const app = buildApp(defaultMockPool(), defaultMockIo());
    const res = await request(app)
      .post('/api/messages')
      .send({ channel: 'general', message: '', username: 'Bot' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Message cannot be empty');
  });

  test('rejects message exceeding max length', async () => {
    const app = buildApp(defaultMockPool(), defaultMockIo());
    const res = await request(app)
      .post('/api/messages')
      .send({ channel: 'general', message: 'a'.repeat(2001), username: 'Bot' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/maximum length/);
  });

  test('rejects missing username', async () => {
    const app = buildApp(defaultMockPool(), defaultMockIo());
    const res = await request(app)
      .post('/api/messages')
      .send({ channel: 'general', message: 'Hi' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Username is required');
  });

  test('handles database error gracefully', async () => {
    const pool = defaultMockPool();
    pool.query.mockRejectedValue(new Error('DB write fail'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    const app = buildApp(pool, defaultMockIo());
    const res = await request(app)
      .post('/api/messages')
      .send({ channel: 'general', message: 'Hi', username: 'Bot' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to save message');

    consoleSpy.mockRestore();
  });
});
