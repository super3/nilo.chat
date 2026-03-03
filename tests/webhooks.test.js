/**
 * @jest-environment node
 */
const express = require('express');
const request = require('supertest');
const { createWebhookRouter, generateWebhookSecret, signPayload } = require('../src/server/webhooks');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildApp(mockPool) {
  const authMiddleware = (req, _res, next) => {
    req.agent = { id: 1, agent_name: 'TestBot' };
    next();
  };

  const { router, dispatchWebhooks } = createWebhookRouter(mockPool, authMiddleware);
  const app = express();
  app.use(express.json());
  app.use('/api/webhooks', router);
  return { app, dispatchWebhooks };
}

function defaultMockPool() {
  return {
    query: jest.fn().mockResolvedValue({ rows: [] }),
  };
}

// ---------------------------------------------------------------------------
// generateWebhookSecret
// ---------------------------------------------------------------------------

describe('generateWebhookSecret', () => {
  test('returns a 64-character hex string', () => {
    const secret = generateWebhookSecret();
    expect(secret).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(secret)).toBe(true);
  });

  test('generates unique values', () => {
    const a = generateWebhookSecret();
    const b = generateWebhookSecret();
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// signPayload
// ---------------------------------------------------------------------------

describe('signPayload', () => {
  test('produces a valid HMAC-SHA256 hex digest', () => {
    const sig = signPayload('{"test":true}', 'mysecret');
    expect(/^[0-9a-f]{64}$/.test(sig)).toBe(true);
  });

  test('different secrets produce different signatures', () => {
    const payload = '{"test":true}';
    const sig1 = signPayload(payload, 'secret1');
    const sig2 = signPayload(payload, 'secret2');
    expect(sig1).not.toBe(sig2);
  });
});

// ---------------------------------------------------------------------------
// POST /api/webhooks — create
// ---------------------------------------------------------------------------

describe('POST /api/webhooks', () => {
  test('creates a webhook with default channels', async () => {
    const pool = defaultMockPool();
    pool.query
      .mockResolvedValueOnce({ rows: [{ count: '0' }] }) // count check
      .mockResolvedValueOnce({
        rows: [{
          id: 1,
          url: 'https://example.com/hook',
          channels: '["welcome","general","growth","feedback"]',
          secret: 'a'.repeat(64),
          created_at: '2026-01-01T00:00:00Z',
        }],
      });

    const { app } = buildApp(pool);
    const res = await request(app)
      .post('/api/webhooks')
      .send({ url: 'https://example.com/hook' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(1);
    expect(res.body.url).toBe('https://example.com/hook');
    expect(res.body.channels).toEqual(['welcome', 'general', 'growth', 'feedback']);
    expect(res.body.secret).toBeDefined();
    expect(res.body.created_at).toBeDefined();
  });

  test('creates a webhook with specific channels', async () => {
    const pool = defaultMockPool();
    pool.query
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })
      .mockResolvedValueOnce({
        rows: [{
          id: 2,
          url: 'https://example.com/hook',
          channels: '["general","feedback"]',
          secret: 'b'.repeat(64),
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
    const res = await request(app)
      .post('/api/webhooks')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('url is required');
  });

  test('rejects empty url', async () => {
    const { app } = buildApp(defaultMockPool());
    const res = await request(app)
      .post('/api/webhooks')
      .send({ url: '   ' });

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
    expect(res.body.error).toBe('url is not a valid URL');
  });

  test('rejects non-http protocol', async () => {
    const { app } = buildApp(defaultMockPool());
    const res = await request(app)
      .post('/api/webhooks')
      .send({ url: 'ftp://example.com/hook' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('url must use http or https protocol');
  });

  test('accepts http url', async () => {
    const pool = defaultMockPool();
    pool.query
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })
      .mockResolvedValueOnce({
        rows: [{
          id: 3,
          url: 'http://example.com/hook',
          channels: '["welcome","general","growth","feedback"]',
          secret: 'c'.repeat(64),
          created_at: '2026-01-01T00:00:00Z',
        }],
      });

    const { app } = buildApp(pool);
    const res = await request(app)
      .post('/api/webhooks')
      .send({ url: 'http://example.com/hook' });

    expect(res.status).toBe(201);
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

  test('rejects invalid channel name', async () => {
    const { app } = buildApp(defaultMockPool());
    const res = await request(app)
      .post('/api/webhooks')
      .send({ url: 'https://example.com/hook', channels: ['nope'] });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid channel: nope/);
  });

  test('enforces max webhooks per agent', async () => {
    const pool = defaultMockPool();
    pool.query.mockResolvedValueOnce({ rows: [{ count: '10' }] });

    const { app } = buildApp(pool);
    const res = await request(app)
      .post('/api/webhooks')
      .send({ url: 'https://example.com/hook' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Maximum of 10/);
  });

  test('handles database error', async () => {
    const pool = defaultMockPool();
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
});

// ---------------------------------------------------------------------------
// GET /api/webhooks — list
// ---------------------------------------------------------------------------

describe('GET /api/webhooks', () => {
  test('lists webhooks for the agent', async () => {
    const pool = defaultMockPool();
    pool.query.mockResolvedValueOnce({
      rows: [
        { id: 1, url: 'https://a.com/hook', channels: '["general"]', created_at: '2026-01-01' },
        { id: 2, url: 'https://b.com/hook', channels: '["feedback"]', created_at: '2026-01-02' },
      ],
    });

    const { app } = buildApp(pool);
    const res = await request(app).get('/api/webhooks');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].url).toBe('https://a.com/hook');
    expect(res.body[0].channels).toEqual(['general']);
    // No secret exposed
    expect(res.body[0].secret).toBeUndefined();
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
      rows: [{ id: 1, url: 'https://example.com/hook' }],
    });

    const { app } = buildApp(pool);
    const res = await request(app).delete('/api/webhooks/1');

    expect(res.status).toBe(200);
    expect(res.body.deleted).toEqual({ id: 1, url: 'https://example.com/hook' });
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

  test('POSTs to matching webhooks with correct signature', async () => {
    const pool = defaultMockPool();
    pool.query.mockResolvedValueOnce({
      rows: [
        { url: 'https://a.com/hook', channels: '["general"]', secret: 'abc123' },
      ],
    });

    global.fetch = jest.fn().mockResolvedValue({ ok: true });

    const { dispatchWebhooks } = buildApp(pool);
    await dispatchWebhooks({ channel: 'general', message: 'hi', username: 'Bot' });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toBe('https://a.com/hook');
    expect(opts.method).toBe('POST');
    expect(opts.headers['Content-Type']).toBe('application/json');
    expect(opts.headers['X-Nilo-Signature']).toBeDefined();

    // Verify signature is correct
    const body = JSON.parse(opts.body);
    expect(body.event).toBe('chat_message');
    expect(body.data.message).toBe('hi');
    const expectedSig = signPayload(opts.body, 'abc123');
    expect(opts.headers['X-Nilo-Signature']).toBe(expectedSig);
  });

  test('skips webhooks not subscribed to the channel', async () => {
    const pool = defaultMockPool();
    pool.query.mockResolvedValueOnce({
      rows: [
        { url: 'https://a.com/hook', channels: '["feedback"]', secret: 'abc' },
      ],
    });

    global.fetch = jest.fn().mockResolvedValue({ ok: true });

    const { dispatchWebhooks } = buildApp(pool);
    await dispatchWebhooks({ channel: 'general', message: 'hi', username: 'Bot' });

    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('handles fetch failures gracefully', async () => {
    const pool = defaultMockPool();
    pool.query.mockResolvedValueOnce({
      rows: [
        { url: 'https://a.com/hook', channels: '["general"]', secret: 'abc' },
      ],
    });

    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    const { dispatchWebhooks } = buildApp(pool);
    await dispatchWebhooks({ channel: 'general', message: 'hi', username: 'Bot' });

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to deliver'),
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });

  test('handles database errors gracefully', async () => {
    const pool = defaultMockPool();
    pool.query.mockRejectedValueOnce(new Error('DB fail'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    const { dispatchWebhooks } = buildApp(pool);
    await dispatchWebhooks({ channel: 'general', message: 'hi', username: 'Bot' });

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Error dispatching'),
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });

  test('dispatches to multiple matching webhooks', async () => {
    const pool = defaultMockPool();
    pool.query.mockResolvedValueOnce({
      rows: [
        { url: 'https://a.com/hook', channels: '["general"]', secret: 'abc' },
        { url: 'https://b.com/hook', channels: '["general","feedback"]', secret: 'def' },
      ],
    });

    global.fetch = jest.fn().mockResolvedValue({ ok: true });

    const { dispatchWebhooks } = buildApp(pool);
    await dispatchWebhooks({ channel: 'general', message: 'hi', username: 'Bot' });

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch.mock.calls[0][0]).toBe('https://a.com/hook');
    expect(global.fetch.mock.calls[1][0]).toBe('https://b.com/hook');
  });
});
