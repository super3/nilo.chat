const { createMemoryPool } = require('../src/server/memory-pool');

describe('createMemoryPool', () => {
  let pool;

  beforeEach(() => {
    pool = createMemoryPool();
  });

  test('SELECT NOW() returns current date', async () => {
    const result = await pool.query('SELECT NOW()');
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].now).toBeInstanceOf(Date);
  });

  test('ALTER TABLE is a no-op', async () => {
    const result = await pool.query('ALTER TABLE messages ADD COLUMN IF NOT EXISTS foo TEXT');
    expect(result.rows).toEqual([]);
  });

  test('CREATE TABLE is a no-op', async () => {
    const result = await pool.query('CREATE TABLE IF NOT EXISTS test (id SERIAL)');
    expect(result.rows).toEqual([]);
  });

  test('CREATE INDEX is a no-op', async () => {
    const result = await pool.query('CREATE INDEX IF NOT EXISTS idx ON test(id)');
    expect(result.rows).toEqual([]);
  });

  test('SELECT COUNT(*) returns 0 for empty messages', async () => {
    const result = await pool.query('SELECT COUNT(*) FROM messages');
    expect(result.rows[0].count).toBe('0');
  });

  test('INSERT INTO messages stores a message', async () => {
    const ts = new Date().toISOString();
    const result = await pool.query(
      'INSERT INTO messages (timestamp, username, message, channel) VALUES ($1, $2, $3, $4)',
      [ts, 'alice', 'hello', 'general']
    );
    expect(result.rowCount).toBe(1);

    const count = await pool.query('SELECT COUNT(*) FROM messages');
    expect(count.rows[0].count).toBe('1');
  });

  test('INSERT INTO messages with profile_image_url', async () => {
    const ts = new Date().toISOString();
    await pool.query(
      'INSERT INTO messages (timestamp, username, message, channel, profile_image_url) VALUES ($1, $2, $3, $4, $5)',
      [ts, 'bob', 'hi', 'welcome', 'http://img.jpg']
    );

    const result = await pool.query(
      'SELECT timestamp, username, message, profile_image_url FROM messages WHERE channel = $1 ORDER BY timestamp ASC',
      ['welcome']
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].username).toBe('bob');
    expect(result.rows[0].profile_image_url).toBe('http://img.jpg');
  });

  test('INSERT INTO messages defaults profile_image_url to null', async () => {
    const ts = new Date().toISOString();
    await pool.query(
      'INSERT INTO messages (timestamp, username, message, channel) VALUES ($1, $2, $3, $4)',
      [ts, 'carol', 'hey', 'general']
    );

    const result = await pool.query(
      'SELECT timestamp, username, message, profile_image_url FROM messages WHERE channel = $1 ORDER BY timestamp ASC',
      ['general']
    );
    expect(result.rows[0].profile_image_url).toBeNull();
  });

  test('SELECT messages by channel ASC returns correct order', async () => {
    await pool.query('INSERT INTO messages (timestamp, username, message, channel) VALUES ($1, $2, $3, $4)',
      ['2023-01-01T00:00:00Z', 'bob', 'second', 'general']);
    await pool.query('INSERT INTO messages (timestamp, username, message, channel) VALUES ($1, $2, $3, $4)',
      ['2022-01-01T00:00:00Z', 'alice', 'first', 'general']);
    await pool.query('INSERT INTO messages (timestamp, username, message, channel) VALUES ($1, $2, $3, $4)',
      ['2024-01-01T00:00:00Z', 'carol', 'other-channel', 'welcome']);

    const result = await pool.query(
      'SELECT timestamp, username, message, profile_image_url FROM messages WHERE channel = $1 ORDER BY timestamp ASC',
      ['general']
    );
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].username).toBe('alice');
    expect(result.rows[1].username).toBe('bob');
  });

  test('SELECT messages by channel DESC with LIMIT', async () => {
    await pool.query('INSERT INTO messages (timestamp, username, message, channel) VALUES ($1, $2, $3, $4)',
      ['2022-01-01T00:00:00Z', 'alice', 'msg1', 'general']);
    await pool.query('INSERT INTO messages (timestamp, username, message, channel) VALUES ($1, $2, $3, $4)',
      ['2023-01-01T00:00:00Z', 'bob', 'msg2', 'general']);
    await pool.query('INSERT INTO messages (timestamp, username, message, channel) VALUES ($1, $2, $3, $4)',
      ['2024-01-01T00:00:00Z', 'carol', 'msg3', 'general']);

    const result = await pool.query(
      'SELECT timestamp, username, message, channel FROM messages WHERE channel = $1 ORDER BY timestamp DESC LIMIT $2',
      ['general', 2]
    );
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].username).toBe('carol');
    expect(result.rows[1].username).toBe('bob');
  });

  test('SELECT messages DESC defaults limit to 50', async () => {
    await pool.query('INSERT INTO messages (timestamp, username, message, channel) VALUES ($1, $2, $3, $4)',
      ['2023-01-01T00:00:00Z', 'alice', 'msg', 'general']);

    const result = await pool.query(
      'SELECT timestamp, username, message, channel FROM messages WHERE channel = $1 ORDER BY timestamp DESC LIMIT $2',
      ['general']
    );
    expect(result.rows).toHaveLength(1);
  });

  // API key tests
  test('INSERT INTO api_keys and SELECT by key_hash', async () => {
    const result = await pool.query(
      'INSERT INTO api_keys (key_hash, agent_name) VALUES ($1, $2) RETURNING id, agent_name, created_at',
      ['hash123', 'TestBot']
    );
    expect(result.rows[0].id).toBe(1);
    expect(result.rows[0].agent_name).toBe('TestBot');
    expect(result.rows[0].created_at).toBeInstanceOf(Date);

    const lookup = await pool.query(
      'SELECT id, agent_name, created_at FROM api_keys WHERE key_hash = $1',
      ['hash123']
    );
    expect(lookup.rows).toHaveLength(1);
    expect(lookup.rows[0].agent_name).toBe('TestBot');
  });

  test('SELECT api_keys by key_hash returns empty for unknown hash', async () => {
    const result = await pool.query(
      'SELECT id, agent_name, created_at FROM api_keys WHERE key_hash = $1',
      ['nonexistent']
    );
    expect(result.rows).toEqual([]);
  });

  test('DELETE FROM api_keys removes key and returns it', async () => {
    await pool.query(
      'INSERT INTO api_keys (key_hash, agent_name) VALUES ($1, $2) RETURNING id, agent_name, created_at',
      ['hash456', 'Bot2']
    );

    const del = await pool.query('DELETE FROM api_keys WHERE id = $1 RETURNING id, agent_name', [1]);
    expect(del.rows).toHaveLength(1);
    expect(del.rows[0].agent_name).toBe('Bot2');

    // Verify it's gone
    const lookup = await pool.query(
      'SELECT id, agent_name, created_at FROM api_keys WHERE key_hash = $1',
      ['hash456']
    );
    expect(lookup.rows).toEqual([]);
  });

  test('DELETE FROM api_keys returns empty for nonexistent id', async () => {
    const result = await pool.query('DELETE FROM api_keys WHERE id = $1 RETURNING id, agent_name', [999]);
    expect(result.rows).toEqual([]);
  });

  test('SELECT api_keys ORDER BY returns all keys sorted', async () => {
    await pool.query('INSERT INTO api_keys (key_hash, agent_name) VALUES ($1, $2) RETURNING id, agent_name, created_at',
      ['h1', 'First']);
    await pool.query('INSERT INTO api_keys (key_hash, agent_name) VALUES ($1, $2) RETURNING id, agent_name, created_at',
      ['h2', 'Second']);

    const result = await pool.query('SELECT id, agent_name, created_at FROM api_keys ORDER BY created_at DESC');
    expect(result.rows).toHaveLength(2);
  });

  test('auto-increments api key ids', async () => {
    await pool.query('INSERT INTO api_keys (key_hash, agent_name) VALUES ($1, $2) RETURNING id, agent_name, created_at',
      ['a', 'Bot1']);
    const r2 = await pool.query('INSERT INTO api_keys (key_hash, agent_name) VALUES ($1, $2) RETURNING id, agent_name, created_at',
      ['b', 'Bot2']);
    expect(r2.rows[0].id).toBe(2);
  });

  test('fallback returns empty rows for unrecognized SQL', async () => {
    const result = await pool.query('DROP TABLE something');
    expect(result.rows).toEqual([]);
  });

  test('handles INSERT INTO messages with no params', async () => {
    const result = await pool.query('INSERT INTO messages (timestamp, username, message, channel) VALUES ($1, $2, $3, $4)');
    expect(result.rowCount).toBe(1);
    expect(pool._messages).toHaveLength(1);
  });

  test('handles INSERT INTO api_keys with no params', async () => {
    const result = await pool.query('INSERT INTO api_keys (key_hash, agent_name) VALUES ($1, $2) RETURNING id, agent_name, created_at');
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].id).toBe(1);
  });
});
