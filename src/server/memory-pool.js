/**
 * In-memory drop-in replacement for pg.Pool.
 *
 * Used when DATABASE_URL is not configured (e.g. Railway PR previews).
 * Supports the subset of SQL used by this application:
 *   - SELECT NOW()
 *   - ALTER TABLE / CREATE TABLE / CREATE INDEX (no-ops)
 *   - SELECT COUNT(*) FROM messages
 *   - INSERT INTO messages ...
 *   - SELECT ... FROM messages WHERE channel = $1 ...
 *   - INSERT INTO api_keys ...
 *   - SELECT ... FROM api_keys WHERE key_hash = $1
 *   - DELETE FROM api_keys WHERE id = $1
 *   - SELECT ... FROM api_keys ORDER BY ...
 */

function createMemoryPool() {
  const messages = [];
  const apiKeys = [];
  let apiKeySeq = 1;

  function query(sql, params) {
    const s = sql.trim();

    // Connection test
    if (s.startsWith('SELECT NOW()')) {
      return Promise.resolve({ rows: [{ now: new Date() }] });
    }

    // Schema DDL — no-ops
    if (s.startsWith('ALTER TABLE') || s.startsWith('CREATE TABLE') || s.startsWith('CREATE INDEX')) {
      return Promise.resolve({ rows: [] });
    }

    // Seed check
    if (s.includes('SELECT COUNT(*)') && s.includes('messages')) {
      return Promise.resolve({ rows: [{ count: String(messages.length) }] });
    }

    // Insert message
    if (s.startsWith('INSERT INTO messages')) {
      const [timestamp, username, message, channel, profileImageUrl] = params || [];
      const row = {
        timestamp: typeof timestamp === 'string' ? new Date(timestamp) : timestamp,
        username,
        message,
        channel,
        profile_image_url: profileImageUrl || null,
      };
      messages.push(row);
      return Promise.resolve({ rows: [row], rowCount: 1 });
    }

    // Select messages by channel (history query — ASC)
    if (s.includes('FROM messages') && s.includes('WHERE channel') && s.includes('ORDER BY timestamp ASC')) {
      const channel = params && params[0];
      const rows = messages
        .filter((m) => m.channel === channel)
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      return Promise.resolve({ rows });
    }

    // Select messages by channel (API query — DESC with LIMIT)
    if (s.includes('FROM messages') && s.includes('WHERE channel') && s.includes('ORDER BY timestamp DESC')) {
      const channel = params && params[0];
      const limit = (params && params[1]) || 50;
      const rows = messages
        .filter((m) => m.channel === channel)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, limit);
      return Promise.resolve({ rows });
    }

    // Insert API key
    if (s.startsWith('INSERT INTO api_keys')) {
      const [keyHash, agentName] = params || [];
      const row = { id: apiKeySeq++, key_hash: keyHash, agent_name: agentName, created_at: new Date() };
      apiKeys.push(row);
      return Promise.resolve({ rows: [{ id: row.id, agent_name: row.agent_name, created_at: row.created_at }] });
    }

    // Select API key by hash
    if (s.includes('FROM api_keys') && s.includes('WHERE key_hash')) {
      const hash = params && params[0];
      const rows = apiKeys
        .filter((k) => k.key_hash === hash)
        .map(({ id, agent_name, created_at }) => ({ id, agent_name, created_at }));
      return Promise.resolve({ rows });
    }

    // Delete API key by id
    if (s.startsWith('DELETE FROM api_keys')) {
      const id = params && params[0];
      const idx = apiKeys.findIndex((k) => k.id === id);
      if (idx === -1) return Promise.resolve({ rows: [] });
      const [removed] = apiKeys.splice(idx, 1);
      return Promise.resolve({ rows: [{ id: removed.id, agent_name: removed.agent_name }] });
    }

    // List API keys (admin)
    if (s.includes('FROM api_keys') && s.includes('ORDER BY')) {
      const rows = apiKeys
        .map(({ id, agent_name, created_at }) => ({ id, agent_name, created_at }))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      return Promise.resolve({ rows });
    }

    // Fallback — return empty result
    return Promise.resolve({ rows: [] });
  }

  return { query, _messages: messages, _apiKeys: apiKeys };
}

module.exports = { createMemoryPool };
