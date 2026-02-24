/**
 * @jest-environment node
 */
const { hashKey, generateKey, requireApiKey, requireAdmin } = require('../src/server/auth');

describe('auth — hashKey', () => {
  test('returns a 64-char hex string', () => {
    const hash = hashKey('test-key');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  test('same input always produces same hash', () => {
    expect(hashKey('abc')).toBe(hashKey('abc'));
  });

  test('different inputs produce different hashes', () => {
    expect(hashKey('key-a')).not.toBe(hashKey('key-b'));
  });
});

describe('auth — generateKey', () => {
  test('returns a 64-char hex string', () => {
    const key = generateKey();
    expect(key).toHaveLength(64);
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });

  test('generates unique keys', () => {
    const a = generateKey();
    const b = generateKey();
    expect(a).not.toBe(b);
  });
});

describe('auth — requireApiKey middleware', () => {
  function mockRes() {
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    return res;
  }

  test('returns 401 when x-api-key header is missing', async () => {
    const pool = { query: jest.fn() };
    const middleware = requireApiKey(pool);
    const req = { headers: {} };
    const res = mockRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Missing x-api-key header' });
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 401 when key is not found in DB', async () => {
    const pool = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    const middleware = requireApiKey(pool);
    const req = { headers: { 'x-api-key': 'bad-key' } };
    const res = mockRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid API key' });
    expect(next).not.toHaveBeenCalled();
  });

  test('calls next and sets req.agent when key is valid', async () => {
    const agentRow = { id: 1, agent_name: 'TestBot', created_at: '2026-01-01' };
    const pool = { query: jest.fn().mockResolvedValue({ rows: [agentRow] }) };
    const middleware = requireApiKey(pool);
    const req = { headers: { 'x-api-key': 'valid-key' } };
    const res = mockRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.agent).toEqual(agentRow);
    // Verify the correct hash was looked up
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT'),
      [hashKey('valid-key')]
    );
  });

  test('returns 500 on database error', async () => {
    const pool = { query: jest.fn().mockRejectedValue(new Error('DB down')) };
    const middleware = requireApiKey(pool);
    const req = { headers: { 'x-api-key': 'some-key' } };
    const res = mockRes();
    const next = jest.fn();
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Authentication error' });
    expect(next).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});

describe('auth — requireAdmin middleware', () => {
  function mockRes() {
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    return res;
  }

  const originalEnv = process.env.ADMIN_API_KEY;
  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.ADMIN_API_KEY;
    } else {
      process.env.ADMIN_API_KEY = originalEnv;
    }
  });

  test('returns 503 when ADMIN_API_KEY is not set', () => {
    delete process.env.ADMIN_API_KEY;
    const req = { headers: { 'x-api-key': 'anything' } };
    const res = mockRes();
    const next = jest.fn();

    requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 401 when x-api-key header is missing', () => {
    process.env.ADMIN_API_KEY = 'admin-secret';
    const req = { headers: {} };
    const res = mockRes();
    const next = jest.fn();

    requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 403 when key does not match ADMIN_API_KEY', () => {
    process.env.ADMIN_API_KEY = 'admin-secret';
    const req = { headers: { 'x-api-key': 'wrong-key' } };
    const res = mockRes();
    const next = jest.fn();

    requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('calls next when key matches ADMIN_API_KEY', () => {
    process.env.ADMIN_API_KEY = 'admin-secret';
    const req = { headers: { 'x-api-key': 'admin-secret' } };
    const res = mockRes();
    const next = jest.fn();

    requireAdmin(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});
