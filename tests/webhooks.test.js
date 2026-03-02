/**
 * @jest-environment node
 */
const express = require('express');
const request = require('supertest');
const crypto = require('crypto');
const { createWebhookRouter, generateWebhookSecret, signPayload } = require('../src/server/webhooks');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AGENT = { id: 1, agent_name: 'TestBot', created_at: '2026-01-01' };

/** Fake auth middleware that attaches req.agent. */
function fakeAuth(req, _res, next) {
  req.agent = { ...AGENT };
  next();
}

/** Build an Express app with the webhook router mounted. */
function buildApp(mockPool) {
  const { router, dispatchWebhooks } = createWebhookRouter(mockPool, fakeAuth);
  const app = express();
  app.use(express.json());
  app.use('/api/webhooks', router);
  return { app, dispatchWebhooks };
}

/** Default mock pool that succeeds for all queries. */
function defaultMockPool() {
  return {
    query: jest.fn(() => Promise.resolve({ rows: [] })),
  };
}

// ---------------------------------------------------------------------------
// generateWebhookSecret / signPayload (utility functions)
// ---------------------------------------------------------------------------

describe('generateWebhookSecret', () => {
  test('returns a 64-char hex string', () => {
    const secret = generateWebhookSecret();
    expect(secret).toMatch(/^[0-9a-f]{64}$/);
  });

  test('generates unique secrets', () => {
    const s1 = generateWebhookSecret();
    const s2 = generateWebhookSecret();
    expect(s1).not.toBe(s2);
  });
});

describe('signPayload', () => {
  test('produces a valid HMAC-SHA256 hex digest', () => {
    const payload = '{"event":"chat_message","data":{}}';
    const secret = 'abc123';
    const sig = signPayload(payload, secret);

    // Verify against Node's native HMAC
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    expect(sig).toBe(expected);
  });

  test('different secrets produce different signatures', () => {
    const payload = '{"hello":"world"}';
    expect(signPayload(payload, 'secret1')).not.toBe(signPayload(payload, 'secret2'));
  });
});

// ---------------------------------------------------------------------------
// POST /api/webhooks — create
// ---------------------------------------------------------------------------

describe('POST /api/webhooks', () => {
  test('creates a webhook with default channels', async () => {
    const pool = defaultMockPool();
    // Count query → 0 existing
    pool.query.mockResolvedValueOnce({ rows: [{ cnt: '0' }] });
    // Insert query
    pool.query.mockResolvedValueOnce({
      rows: [{
        id: 10,
        url: 'https://example.com/hook',
        channels: '["welcome","general","growth","feedback"]',
        created_at: '2026-01-01T00:00:00Z',
      }],
    });

    const { app } = buildApp(pool);
    const res = await request(app)
      .post('/api/webhooks')
      .send({ url: 'https://example.com/hook' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(10);
    expect(res.body.url).toBe('https://example.com/hook');
    expect(res.body.channels).toEqual(['welcome', 'general', 'growth', 'feedback']);
    expect(res.body.secret).toBeDefined();
    expect(res.body.secret).toHaveLength(64);
    expect(res.body.created_at).toBeDefined();
  });

  test('creates a webhook with specific channels', async () => {
    const pool = defaultMockPool();
    pool.query.mockResolvedValueOnce({ rows: [{ cnt: '0' }] });
    pool.query.mockResolvedValueOnce({
      rows: [{
        id: 11,
        url: 'https://example.com/hook',
        channels: '["general","feedback"]',
        created_at: '2026-01-01T00:00:00Z',
      }],
    });

    const { app } = buildApp(pool);
    const res = await request(app)
      .post('/api/webhooks')
      .send({ url: 'https://example.com/hook', channels: ['general', 'feedback'] });

    expect(res.status).toBe(201);
    expect(res.body.channels).toEqual(['general', 'feedback']);
  });

  test('rejects missing url', async () => {
    const { app } = buildApp(defaultMockPool());
    const res = await request(app).post('/api/webhooks').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('url is required');
  });

  test('rejects empty url', async () => {
    const { app } = buildApp(defaultMockPool());
    const res = await request(app).post('/api/webhooks').send({ url: '  ' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('url is required');
  });

  test('rejects url exceeding max length', async () => {
    const { app } = buildApp(defaultMockPool());
    const res = await request(app)
      .post('/api/webhooks')
      .send({ url: 'https://example.com/' + 'a'.repeat(2048) });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/maximum length/);
  });

  test('rejects invalid url', async () => {
    const { app } = buildApp(defaultMockPool());
    const res = await request(app)
      .post('/api/webhooks')
      .send({ url: 'not-a-url' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('url must be a valid URL');
  });

  test('rejects non-http(s) protocol', async () => {
    const { app } = buildApp(defaultMockPool());
    const res = await request(app)
      .post('/api/webhooks')
      .send({ url: 'ftp://example.com/hook' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('url must use http or https protocol');
  });

  test('rejects non-array channels', async () => {
    const { app } = buildApp(defaultMockPool());
    const res = await request(app)
      .post('/api/webhooks')
      .send({ url: 'https://example.com/hook', channels: 'general' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('channels must be a non-empty array');
  });

  test('rejects empty channels array', async () => {
    const { app } = buildApp(defaultMockPool());
    const res = await request(app)
      .post('/api/webhooks')
      .send({ url: 'https://example.com/hook', channels: [] });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('channels must be a non-empty array');
  });

  test('rejects invalid channel names', async () => {
    const { app } = buildApp(defaultMockPool());
    const res = await request(app)
      .post('/api/webhooks')
      .send({ url: 'https://example.com/hook', channels: ['general', 'nope'] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid channels: nope/);
  });

  test('rejects when agent exceeds max webhooks', async () => {
    const pool = defaultMockPool();
    pool.query.mockResolvedValueOnce({ rows: [{ cnt: '10' }] });

    const { app } = buildApp(pool);
    const res = await request(app)
      .post('/api/webhooks')
      .send({ url: 'https://example.com/hook' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Maximum of 10 webhooks/);
  });

  test('handles database error on insert', async () => {
    const pool = defaultMockPool();
    pool.query.mockResolvedValueOnce({ rows: [{ cnt: '0' }] });
    pool.query.mockRejectedValueOnce(new Error('DB fail'));

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const { app } = buildApp(pool);
    const res = await request(app)
      .post('/api/webhooks')
      .send({ url: 'https://example.com/hook' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to create webhook');
    consoleSpy.mockRestore();
  });

  test('accepts http url', async () => {
    const pool = defaultMockPool();
    pool.query.mockResolvedValueOnce({ rows: [{ cnt: '0' }] });
    pool.query.mockResolvedValueOnce({
      rows: [{
        id: 12,
        url: 'http://localhost:4000/hook',
        channels: '["general"]',
        created_at: '2026-01-01T00:00:00Z',
      }],
    });

    const { app } = buildApp(pool);
    const res = await request(app)
      .post('/api/webhooks')
      .send({ url: 'http://localhost:4000/hook', channels: ['general'] });
    expect(res.status).toBe(201);
  });
});

// ---------------------------------------------------------------------------
// GET /api/webhooks — list
// ---------------------------------------------------------------------------

describe('GET /api/webhooks', () => {
  test('returns webhooks for the authenticated agent', async () => {
    const pool = defaultMockPool();
    pool.query.mockResolvedValueOnce({
      rows: [
        { id: 1, url: 'https://a.com/hook', channels: '["general"]', created_at: '2026-01-01' },
        { id: 2, url: 'https://b.com/hook', channels: '["feedback","growth"]', created_at: '2026-01-02' },
      ],
    });

    const { app } = buildApp(pool);
    const res = await request(app).get('/api/webhooks');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].channels).toEqual(['general']);
    expect(res.body[1].channels).toEqual(['feedback', 'growth']);
  });

  test('returns empty array when no webhooks exist', async () => {
    const pool = defaultMockPool();
    pool.query.mockResolvedValueOnce({ rows: [] });

    const { app } = buildApp(pool);
    const res = await request(app).get('/api/webhooks');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('handles database error', async () => {
    const pool = defaultMockPool();
    pool.query.mockRejectedValueOnce(new Error('DB fail'));

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const { app } = buildApp(pool);
    const res = await request(app).get('/api/webhooks');

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to list webhooks');
    consoleSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/webhooks/:id
// ---------------------------------------------------------------------------

describe('DELETE /api/webhooks/:id', () => {
  test('deletes a webhook owned by the agent', async () => {
    const pool = defaultMockPool();
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 5, url: 'https://example.com/hook' }],
    });

    const { app } = buildApp(pool);
    const res = await request(app).delete('/api/webhooks/5');

    expect(res.status).toBe(200);
    expect(res.body.deleted).toEqual({ id: 5, url: 'https://example.com/hook' });
  });

  test('returns 404 for non-existent webhook', async () => {
    const pool = defaultMockPool();
    pool.query.mockResolvedValueOnce({ rows: [] });

    const { app } = buildApp(pool);
    const res = await request(app).delete('/api/webhooks/999');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Webhook not found');
  });

  test('returns 400 for invalid id', async () => {
    const { app } = buildApp(defaultMockPool());
    const res = await request(app).delete('/api/webhooks/abc');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid webhook id');
  });

  test('handles database error', async () => {
    const pool = defaultMockPool();
    pool.query.mockRejectedValueOnce(new Error('DB fail'));

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const { app } = buildApp(pool);
    const res = await request(app).delete('/api/webhooks/1');

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to delete webhook');
    consoleSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// dispatchWebhooks
// ---------------------------------------------------------------------------

describe('dispatchWebhooks', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('fires POST to matching webhook URLs with correct signature', async () => {
    const secret = 'test-secret-abc';
    const pool = defaultMockPool();
    pool.query.mockResolvedValueOnce({
      rows: [
        { id: 1, url: 'https://a.com/hook', channels: '["general"]', secret },
      ],
    });

    global.fetch = jest.fn(() => Promise.resolve({ ok: true }));

    const { dispatchWebhooks } = buildApp(pool);
    const msg = { timestamp: '2026-01-01T00:00:00Z', username: 'Bot', message: 'Hi', channel: 'general' };
    await dispatchWebhooks(msg);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toBe('https://a.com/hook');
    expect(opts.method).toBe('POST');
    expect(opts.headers['Content-Type']).toBe('application/json');

    // Verify signature
    const body = JSON.parse(opts.body);
    expect(body.event).toBe('chat_message');
    expect(body.data).toEqual(msg);

    const expectedSig = signPayload(opts.body, secret);
    expect(opts.headers['X-Nilo-Signature']).toBe(expectedSig);
  });

  test('skips webhooks that are not subscribed to the channel', async () => {
    const pool = defaultMockPool();
    pool.query.mockResolvedValueOnce({
      rows: [
        { id: 1, url: 'https://a.com/hook', channels: '["feedback"]', secret: 's1' },
      ],
    });

    global.fetch = jest.fn(() => Promise.resolve({ ok: true }));

    const { dispatchWebhooks } = buildApp(pool);
    await dispatchWebhooks({ timestamp: 'T', username: 'U', message: 'M', channel: 'general' });

    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('handles fetch failure gracefully', async () => {
    const pool = defaultMockPool();
    pool.query.mockResolvedValueOnce({
      rows: [
        { id: 1, url: 'https://a.com/hook', channels: '["general"]', secret: 's1' },
      ],
    });

    global.fetch = jest.fn(() => Promise.reject(new Error('Network error')));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    const { dispatchWebhooks } = buildApp(pool);
    await dispatchWebhooks({ timestamp: 'T', username: 'U', message: 'M', channel: 'general' });

    // Wait for fire-and-forget promise to settle
    await new Promise((r) => setTimeout(r, 50));

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('delivery failed for webhook 1'),
      'Network error'
    );
    consoleSpy.mockRestore();
  });

  test('handles database error when fetching webhooks', async () => {
    const pool = defaultMockPool();
    pool.query.mockRejectedValueOnce(new Error('DB fail'));

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    const { dispatchWebhooks } = buildApp(pool);
    await dispatchWebhooks({ timestamp: 'T', username: 'U', message: 'M', channel: 'general' });

    expect(consoleSpy).toHaveBeenCalledWith(
      'Webhooks: Error fetching webhooks for dispatch:',
      expect.any(Error)
    );
    consoleSpy.mockRestore();
  });

  test('dispatches to multiple matching webhooks', async () => {
    const pool = defaultMockPool();
    pool.query.mockResolvedValueOnce({
      rows: [
        { id: 1, url: 'https://a.com/hook', channels: '["general"]', secret: 's1' },
        { id: 2, url: 'https://b.com/hook', channels: '["general","feedback"]', secret: 's2' },
        { id: 3, url: 'https://c.com/hook', channels: '["feedback"]', secret: 's3' },
      ],
    });

    global.fetch = jest.fn(() => Promise.resolve({ ok: true }));

    const { dispatchWebhooks } = buildApp(pool);
    await dispatchWebhooks({ timestamp: 'T', username: 'U', message: 'M', channel: 'general' });

    // Only webhooks 1 and 2 match 'general'
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch.mock.calls[0][0]).toBe('https://a.com/hook');
    expect(global.fetch.mock.calls[1][0]).toBe('https://b.com/hook');
  });
});
