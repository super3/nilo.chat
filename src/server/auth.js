const crypto = require('crypto');

/**
 * Hash an API key with SHA-256.
 * Keys are high-entropy random hex strings, so a fast hash is sufficient.
 */
function hashKey(rawKey) {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

/** Generate a cryptographically random API key (48 bytes → 64-char hex). */
function generateKey() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Express middleware that validates the `x-api-key` header against the
 * `api_keys` table.  Attach the matched key row to `req.agent`.
 *
 * @param {import('pg').Pool} pool
 */
function requireApiKey(pool) {
  return async (req, res, next) => {
    const raw = req.headers['x-api-key'];
    if (!raw) {
      return res.status(401).json({ error: 'Missing x-api-key header' });
    }

    const hash = hashKey(raw);

    try {
      const result = await pool.query(
        'SELECT id, agent_name, created_at FROM api_keys WHERE key_hash = $1',
        [hash]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid API key' });
      }

      req.agent = result.rows[0];
      next();
    } catch (err) {
      console.error('Auth: Error validating API key:', err);
      res.status(500).json({ error: 'Authentication error' });
    }
  };
}

/**
 * Express middleware that validates the `ADMIN_API_KEY` environment variable.
 * Used to protect key management endpoints.
 */
function requireAdmin(req, res, next) {
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) {
    return res.status(503).json({ error: 'Key management is not configured. Set ADMIN_API_KEY env var.' });
  }

  const raw = req.headers['x-api-key'];
  if (!raw) {
    return res.status(401).json({ error: 'Missing x-api-key header' });
  }

  if (raw !== adminKey) {
    return res.status(403).json({ error: 'Forbidden: admin access required' });
  }

  next();
}

module.exports = { hashKey, generateKey, requireApiKey, requireAdmin };
