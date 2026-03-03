const crypto = require('crypto');
const express = require('express');

const CHANNELS = ['welcome', 'general', 'growth', 'feedback'];
const MAX_URL_LENGTH = 2048;
const MAX_WEBHOOKS_PER_AGENT = 10;

/** Generate a 32-byte hex secret for HMAC signing. */
function generateWebhookSecret() {
  return crypto.randomBytes(32).toString('hex');
}

/** HMAC-SHA256 sign a JSON payload string with the given secret. */
function signPayload(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Build the webhook router and dispatcher.
 *
 * @param {import('pg').Pool} pool - PostgreSQL connection pool
 * @param {Function} authMiddleware - Express middleware for x-api-key auth
 * @returns {{ router: express.Router, dispatchWebhooks: Function }}
 */
function createWebhookRouter(pool, authMiddleware) {
  const router = express.Router();

  // All routes require API key auth
  router.use(authMiddleware);

  // --- POST / — register a new webhook ------------------------------------
  router.post('/', async (req, res) => {
    const { url, channels } = req.body;

    // Validate url
    if (!url || typeof url !== 'string' || url.trim() === '') {
      return res.status(400).json({ error: 'url is required' });
    }
    if (url.length > MAX_URL_LENGTH) {
      return res.status(400).json({ error: `url exceeds maximum length of ${MAX_URL_LENGTH} characters` });
    }
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return res.status(400).json({ error: 'url is not a valid URL' });
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return res.status(400).json({ error: 'url must use http or https protocol' });
    }

    // Validate channels
    let selectedChannels = CHANNELS; // default: all
    if (channels !== undefined) {
      if (!Array.isArray(channels) || channels.length === 0) {
        return res.status(400).json({ error: 'channels must be a non-empty array' });
      }
      for (const ch of channels) {
        if (!CHANNELS.includes(ch)) {
          return res.status(400).json({ error: `Invalid channel: ${ch}. Must be one of: ${CHANNELS.join(', ')}` });
        }
      }
      selectedChannels = channels;
    }

    const agentId = req.agent.id;

    try {
      // Enforce per-agent limit
      const countResult = await pool.query(
        'SELECT COUNT(*) FROM webhooks WHERE agent_id = $1',
        [agentId]
      );
      if (parseInt(countResult.rows[0].count, 10) >= MAX_WEBHOOKS_PER_AGENT) {
        return res.status(400).json({ error: `Maximum of ${MAX_WEBHOOKS_PER_AGENT} webhooks per agent` });
      }

      const secret = generateWebhookSecret();
      const result = await pool.query(
        'INSERT INTO webhooks (agent_id, url, channels, secret) VALUES ($1, $2, $3, $4) RETURNING id, url, channels, secret, created_at',
        [agentId, url, JSON.stringify(selectedChannels), secret]
      );

      const row = result.rows[0];
      res.status(201).json({
        id: row.id,
        url: row.url,
        channels: JSON.parse(row.channels),
        secret: row.secret,
        created_at: row.created_at,
      });
    } catch (err) {
      console.error('Webhooks: Error creating webhook:', err);
      res.status(500).json({ error: 'Failed to create webhook' });
    }
  });

  // --- GET / — list agent's webhooks --------------------------------------
  router.get('/', async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT id, url, channels, created_at FROM webhooks WHERE agent_id = $1 ORDER BY created_at DESC',
        [req.agent.id]
      );
      const webhooks = result.rows.map((row) => ({
        id: row.id,
        url: row.url,
        channels: JSON.parse(row.channels),
        created_at: row.created_at,
      }));
      res.json(webhooks);
    } catch (err) {
      console.error('Webhooks: Error listing webhooks:', err);
      res.status(500).json({ error: 'Failed to list webhooks' });
    }
  });

  // --- DELETE /:id — delete a webhook -------------------------------------
  router.delete('/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid webhook id' });
    }

    try {
      const result = await pool.query(
        'DELETE FROM webhooks WHERE id = $1 AND agent_id = $2 RETURNING id, url',
        [id, req.agent.id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Webhook not found' });
      }
      res.json({ deleted: { id: result.rows[0].id, url: result.rows[0].url } });
    } catch (err) {
      console.error('Webhooks: Error deleting webhook:', err);
      res.status(500).json({ error: 'Failed to delete webhook' });
    }
  });

  // --- dispatchWebhooks — fire-and-forget POST to all matching webhooks ---
  async function dispatchWebhooks(messageObject) {
    try {
      const result = await pool.query('SELECT url, channels, secret FROM webhooks');
      for (const row of result.rows) {
        const channels = JSON.parse(row.channels);
        if (!channels.includes(messageObject.channel)) {
          continue;
        }
        const payload = JSON.stringify({ event: 'chat_message', data: messageObject });
        const signature = signPayload(payload, row.secret);
        try {
          await fetch(row.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Nilo-Signature': signature,
            },
            body: payload,
            signal: AbortSignal.timeout(5000),
          });
        } catch (err) {
          console.error(`Webhooks: Failed to deliver to ${row.url}:`, err);
        }
      }
    } catch (err) {
      console.error('Webhooks: Error dispatching webhooks:', err);
    }
  }

  return { router, dispatchWebhooks };
}

module.exports = { createWebhookRouter, generateWebhookSecret, signPayload };
