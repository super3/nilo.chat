/**
 * @jest-environment node
 */
const express = require('express');
const request = require('supertest');
const { createApiRouter, generateDocs } = require('../src/server/api');
const { hashKey } = require('../src/server/auth');

// Helpers -------------------------------------------------------------------

const VALID_KEY = 'test-agent-key-abc123';
const VALID_KEY_HASH = hashKey(VALID_KEY);
const ADMIN_KEY = 'test-admin-secret';

/** Build an Express app with the API router mounted. */
function buildApp(mockPool, mockIo) {
  const app = express();
  app.use(express.json());
  app.use('/api', createApiRouter(mockPool, mockIo));
  return app;
}

/**
 * Mock pool that returns a valid agent row when the auth middleware looks up
 * an API key, and empty rows for everything else by default.
 */
function authedMockPool() {
  const pool = {
    query: jest.fn((sql, params) => {
      // Auth middleware SELECT for api_keys
      if (sql.includes('SELECT') && sql.includes('api_keys') && params && params[0] === VALID_KEY_HASH) {
        return Promise.resolve({
          rows: [{ id: 1, agent_name: 'TestBot', created_at: '2026-01-01' }],
        });
      }
      return Promise.resolve({ rows: [] });
    }),
  };
  return pool;
}

function defaultMockIo() {
  return { emit: jest.fn() };
}

// ---------------------------------------------------------------------------
// Auth enforcement
// ---------------------------------------------------------------------------

describe('REST API — auth enforcement', () => {
  test('returns 401 for chat endpoints without API key', async () => {
    const app = buildApp(authedMockPool(), defaultMockIo());

    const channelsRes = await request(app).get('/api/channels');
    expect(channelsRes.status).toBe(401);

    const messagesRes = await request(app).get('/api/messages/general');
    expect(messagesRes.status).toBe(401);

    const postRes = await request(app)
      .post('/api/messages')
      .send({ channel: 'general', message: 'Hi', username: 'Bot' });
    expect(postRes.status).toBe(401);
  });

  test('returns 401 for invalid API key', async () => {
    const app = buildApp(authedMockPool(), defaultMockIo());

    const res = await request(app)
      .get('/api/channels')
      .set('x-api-key', 'wrong-key');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid API key');
  });
});

// ---------------------------------------------------------------------------
// Chat endpoints (with valid API key)
// ---------------------------------------------------------------------------

describe('REST API — /api/channels', () => {
  test('returns all channels with descriptions', async () => {
    const app = buildApp(authedMockPool(), defaultMockIo());
    const res = await request(app)
      .get('/api/channels')
      .set('x-api-key', VALID_KEY);

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
    const pool = authedMockPool();
    const originalQuery = pool.query;
    pool.query = jest.fn((sql, params) => {
      // Let auth pass, then return message rows for the SELECT messages query
      if (sql.includes('SELECT') && sql.includes('messages')) {
        return Promise.resolve({ rows: [...mockRows].reverse() });
      }
      return originalQuery(sql, params);
    });

    const app = buildApp(pool, defaultMockIo());
    const res = await request(app)
      .get('/api/messages/general')
      .set('x-api-key', VALID_KEY);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    // API fetches DESC then reverses → chronological (oldest first)
    expect(res.body[0].username).toBe('Alice');
    expect(res.body[1].username).toBe('Bob');
  });

  test('rejects invalid channel', async () => {
    const app = buildApp(authedMockPool(), defaultMockIo());
    const res = await request(app)
      .get('/api/messages/invalid')
      .set('x-api-key', VALID_KEY);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid channel/);
  });

  test('clamps limit to MAX_LIMIT', async () => {
    const pool = authedMockPool();
    const app = buildApp(pool, defaultMockIo());
    await request(app)
      .get('/api/messages/general?limit=999')
      .set('x-api-key', VALID_KEY);

    // Second call (after auth) is the messages query
    const messageQuery = pool.query.mock.calls.find(
      (c) => c[0].includes('messages') && c[0].includes('SELECT')
    );
    expect(messageQuery[1]).toEqual(['general', 200]);
  });

  test('uses default limit for invalid value', async () => {
    const pool = authedMockPool();
    const app = buildApp(pool, defaultMockIo());
    await request(app)
      .get('/api/messages/general?limit=abc')
      .set('x-api-key', VALID_KEY);

    const messageQuery = pool.query.mock.calls.find(
      (c) => c[0].includes('messages') && c[0].includes('SELECT')
    );
    expect(messageQuery[1]).toEqual(['general', 50]);
  });

  test('handles database error gracefully', async () => {
    const pool = authedMockPool();
    const originalQuery = pool.query;
    pool.query = jest.fn((sql, params) => {
      if (sql.includes('SELECT') && sql.includes('messages')) {
        return Promise.reject(new Error('DB down'));
      }
      return originalQuery(sql, params);
    });
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    const app = buildApp(pool, defaultMockIo());
    const res = await request(app)
      .get('/api/messages/general')
      .set('x-api-key', VALID_KEY);

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to read messages');

    consoleSpy.mockRestore();
  });
});

describe('REST API — POST /api/messages', () => {
  test('creates a message and broadcasts via Socket.IO', async () => {
    const pool = authedMockPool();
    const io = defaultMockIo();
    const app = buildApp(pool, io);

    const res = await request(app)
      .post('/api/messages')
      .set('x-api-key', VALID_KEY)
      .send({ channel: 'general', message: 'Hello API!', username: 'TestBot' });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Hello API!');
    expect(res.body.username).toBe('TestBot');
    expect(res.body.channel).toBe('general');
    expect(res.body.timestamp).toBeDefined();

    // Verify DB insert
    const insertCall = pool.query.mock.calls.find((c) => c[0].includes('INSERT INTO messages'));
    expect(insertCall).toBeDefined();
    expect(insertCall[1]).toEqual(
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
    const app = buildApp(authedMockPool(), defaultMockIo());
    const res = await request(app)
      .post('/api/messages')
      .set('x-api-key', VALID_KEY)
      .send({ message: 'Hi', username: 'Bot' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid channel/);
  });

  test('rejects invalid channel', async () => {
    const app = buildApp(authedMockPool(), defaultMockIo());
    const res = await request(app)
      .post('/api/messages')
      .set('x-api-key', VALID_KEY)
      .send({ channel: 'nope', message: 'Hi', username: 'Bot' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid channel/);
  });

  test('rejects empty message', async () => {
    const app = buildApp(authedMockPool(), defaultMockIo());
    const res = await request(app)
      .post('/api/messages')
      .set('x-api-key', VALID_KEY)
      .send({ channel: 'general', message: '', username: 'Bot' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Message cannot be empty');
  });

  test('rejects message exceeding max length', async () => {
    const app = buildApp(authedMockPool(), defaultMockIo());
    const res = await request(app)
      .post('/api/messages')
      .set('x-api-key', VALID_KEY)
      .send({ channel: 'general', message: 'a'.repeat(2001), username: 'Bot' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/maximum length/);
  });

  test('rejects missing username', async () => {
    const app = buildApp(authedMockPool(), defaultMockIo());
    const res = await request(app)
      .post('/api/messages')
      .set('x-api-key', VALID_KEY)
      .send({ channel: 'general', message: 'Hi' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Username is required');
  });

  test('handles database error gracefully', async () => {
    const pool = authedMockPool();
    const originalQuery = pool.query;
    pool.query = jest.fn((sql, params) => {
      if (sql.includes('INSERT INTO messages')) {
        return Promise.reject(new Error('DB write fail'));
      }
      return originalQuery(sql, params);
    });
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    const app = buildApp(pool, defaultMockIo());
    const res = await request(app)
      .post('/api/messages')
      .set('x-api-key', VALID_KEY)
      .send({ channel: 'general', message: 'Hi', username: 'Bot' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to save message');

    consoleSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// generateDocs
// ---------------------------------------------------------------------------

describe('generateDocs', () => {
  test('returns markdown with all sections', () => {
    const md = generateDocs('https://nilo.chat');

    expect(md).toContain('# nilo.chat API');
    expect(md).toContain('## Getting Started');
    expect(md).toContain('## Endpoints');
    expect(md).toContain('## Channels');
  });

  test('includes base URL in examples', () => {
    const md = generateDocs('https://nilo.chat');

    expect(md).toContain('https://nilo.chat/api/keys');
    expect(md).toContain('https://nilo.chat/api/channels');
    expect(md).toContain('https://nilo.chat/api/messages');
  });

  test('documents all endpoints', () => {
    const md = generateDocs('http://localhost:3000');

    expect(md).toContain('### POST /api/keys');
    expect(md).toContain('### DELETE /api/keys/:id');
    expect(md).toContain('### GET /api/channels');
    expect(md).toContain('### GET /api/messages/:channel');
    expect(md).toContain('### POST /api/messages');
  });

  test('includes all channel descriptions', () => {
    const md = generateDocs('https://nilo.chat');

    expect(md).toContain('| welcome |');
    expect(md).toContain('| general |');
    expect(md).toContain('| growth |');
    expect(md).toContain('| feedback |');
  });
});

// ---------------------------------------------------------------------------
// Key management endpoints
// ---------------------------------------------------------------------------

describe('REST API — POST /api/keys (create, open)', () => {
  test('creates a new API key without any auth', async () => {
    const pool = authedMockPool();
    const originalQuery = pool.query;
    pool.query = jest.fn((sql, params) => {
      if (sql.includes('INSERT INTO api_keys')) {
        return Promise.resolve({
          rows: [{ id: 42, agent_name: 'NewAgent', created_at: '2026-02-19T00:00:00Z' }],
        });
      }
      return originalQuery(sql, params);
    });

    const app = buildApp(pool, defaultMockIo());
    const res = await request(app)
      .post('/api/keys')
      .send({ agent_name: 'NewAgent' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(42);
    expect(res.body.agent_name).toBe('NewAgent');
    expect(res.body.api_key).toBeDefined();
    expect(res.body.api_key).toHaveLength(64); // 32 bytes hex
    expect(res.body.created_at).toBeDefined();
  });

  test('rejects missing agent_name', async () => {
    const app = buildApp(authedMockPool(), defaultMockIo());
    const res = await request(app)
      .post('/api/keys')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('agent_name is required');
  });

  test('rejects empty agent_name', async () => {
    const app = buildApp(authedMockPool(), defaultMockIo());
    const res = await request(app)
      .post('/api/keys')
      .send({ agent_name: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('agent_name is required');
  });

  test('handles database error', async () => {
    const pool = authedMockPool();
    const originalQuery = pool.query;
    pool.query = jest.fn((sql, params) => {
      if (sql.includes('INSERT INTO api_keys')) {
        return Promise.reject(new Error('DB fail'));
      }
      return originalQuery(sql, params);
    });
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    const app = buildApp(pool, defaultMockIo());
    const res = await request(app)
      .post('/api/keys')
      .send({ agent_name: 'Agent' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to create API key');

    consoleSpy.mockRestore();
  });
});

describe('REST API — DELETE /api/keys/:id', () => {
  const originalAdminKey = process.env.ADMIN_API_KEY;
  beforeEach(() => { process.env.ADMIN_API_KEY = ADMIN_KEY; });
  afterEach(() => {
    if (originalAdminKey === undefined) delete process.env.ADMIN_API_KEY;
    else process.env.ADMIN_API_KEY = originalAdminKey;
  });

  test('admin can delete any key', async () => {
    const pool = authedMockPool();
    const originalQuery = pool.query;
    pool.query = jest.fn((sql, params) => {
      if (sql.includes('DELETE FROM api_keys')) {
        return Promise.resolve({ rows: [{ id: 5, agent_name: 'OldBot' }] });
      }
      return originalQuery(sql, params);
    });

    const app = buildApp(pool, defaultMockIo());
    const res = await request(app)
      .delete('/api/keys/5')
      .set('x-api-key', ADMIN_KEY);

    expect(res.status).toBe(200);
    expect(res.body.deleted).toEqual({ id: 5, agent_name: 'OldBot' });
  });

  test('agent can delete its own key', async () => {
    const pool = authedMockPool();
    const originalQuery = pool.query;
    pool.query = jest.fn((sql, params) => {
      // Ownership lookup — VALID_KEY maps to id:1
      if (sql.includes('SELECT') && sql.includes('api_keys') && !sql.includes('ORDER BY')) {
        return Promise.resolve({ rows: [{ id: 1 }] });
      }
      if (sql.includes('DELETE FROM api_keys')) {
        return Promise.resolve({ rows: [{ id: 1, agent_name: 'TestBot' }] });
      }
      return originalQuery(sql, params);
    });

    const app = buildApp(pool, defaultMockIo());
    const res = await request(app)
      .delete('/api/keys/1')
      .set('x-api-key', VALID_KEY);

    expect(res.status).toBe(200);
    expect(res.body.deleted).toEqual({ id: 1, agent_name: 'TestBot' });
  });

  test('agent cannot delete another agents key', async () => {
    const pool = authedMockPool();
    const originalQuery = pool.query;
    pool.query = jest.fn((sql, params) => {
      // Ownership lookup — VALID_KEY maps to id:1, not id:99
      if (sql.includes('SELECT') && sql.includes('api_keys') && !sql.includes('ORDER BY')) {
        return Promise.resolve({ rows: [{ id: 1 }] });
      }
      return originalQuery(sql, params);
    });

    const app = buildApp(pool, defaultMockIo());
    const res = await request(app)
      .delete('/api/keys/99')
      .set('x-api-key', VALID_KEY);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/you can only delete your own key/);
  });

  test('returns 403 for unknown agent key', async () => {
    const app = buildApp(authedMockPool(), defaultMockIo());
    const res = await request(app)
      .delete('/api/keys/1')
      .set('x-api-key', 'unknown-key');

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/you can only delete your own key/);
  });

  test('returns 401 with no key', async () => {
    const app = buildApp(authedMockPool(), defaultMockIo());
    const res = await request(app)
      .delete('/api/keys/1');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Missing x-api-key header');
  });

  test('returns 404 for non-existent key (admin)', async () => {
    const app = buildApp(authedMockPool(), defaultMockIo());
    const res = await request(app)
      .delete('/api/keys/999')
      .set('x-api-key', ADMIN_KEY);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('API key not found');
  });

  test('returns 400 for invalid id', async () => {
    const app = buildApp(authedMockPool(), defaultMockIo());
    const res = await request(app)
      .delete('/api/keys/abc')
      .set('x-api-key', ADMIN_KEY);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid key id');
  });

  test('handles database error on ownership lookup', async () => {
    const pool = authedMockPool();
    const originalQuery = pool.query;
    pool.query = jest.fn((sql, params) => {
      if (sql.includes('SELECT') && sql.includes('api_keys')) {
        return Promise.reject(new Error('DB fail'));
      }
      return originalQuery(sql, params);
    });
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    const app = buildApp(pool, defaultMockIo());
    const res = await request(app)
      .delete('/api/keys/1')
      .set('x-api-key', VALID_KEY);

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to delete API key');

    consoleSpy.mockRestore();
  });

  test('handles database error on delete', async () => {
    const pool = authedMockPool();
    const originalQuery = pool.query;
    pool.query = jest.fn((sql, params) => {
      if (sql.includes('DELETE FROM api_keys')) {
        return Promise.reject(new Error('DB fail'));
      }
      return originalQuery(sql, params);
    });

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    const app = buildApp(pool, defaultMockIo());
    const res = await request(app)
      .delete('/api/keys/1')
      .set('x-api-key', ADMIN_KEY);

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to delete API key');

    consoleSpy.mockRestore();
  });
});

describe('REST API — GET /api/keys (list)', () => {
  const originalAdminKey = process.env.ADMIN_API_KEY;
  beforeEach(() => { process.env.ADMIN_API_KEY = ADMIN_KEY; });
  afterEach(() => {
    if (originalAdminKey === undefined) delete process.env.ADMIN_API_KEY;
    else process.env.ADMIN_API_KEY = originalAdminKey;
  });

  test('lists all keys without exposing secrets', async () => {
    const pool = authedMockPool();
    const originalQuery = pool.query;
    pool.query = jest.fn((sql, params) => {
      if (sql.includes('SELECT') && sql.includes('api_keys') && sql.includes('ORDER BY')) {
        return Promise.resolve({
          rows: [
            { id: 1, agent_name: 'Bot1', created_at: '2026-01-01' },
            { id: 2, agent_name: 'Bot2', created_at: '2026-01-02' },
          ],
        });
      }
      return originalQuery(sql, params);
    });

    const app = buildApp(pool, defaultMockIo());
    const res = await request(app)
      .get('/api/keys')
      .set('x-api-key', ADMIN_KEY);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].agent_name).toBe('Bot1');
    // No api_key or key_hash exposed
    expect(res.body[0].api_key).toBeUndefined();
    expect(res.body[0].key_hash).toBeUndefined();
  });

  test('returns 403 without admin key', async () => {
    const app = buildApp(authedMockPool(), defaultMockIo());
    const res = await request(app)
      .get('/api/keys')
      .set('x-api-key', 'not-admin');

    expect(res.status).toBe(403);
  });

  test('handles database error', async () => {
    const pool = authedMockPool();
    const originalQuery = pool.query;
    pool.query = jest.fn((sql, params) => {
      if (sql.includes('SELECT') && sql.includes('api_keys') && sql.includes('ORDER BY')) {
        return Promise.reject(new Error('DB fail'));
      }
      return originalQuery(sql, params);
    });
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    const app = buildApp(pool, defaultMockIo());
    const res = await request(app)
      .get('/api/keys')
      .set('x-api-key', ADMIN_KEY);

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to list API keys');

    consoleSpy.mockRestore();
  });
});
