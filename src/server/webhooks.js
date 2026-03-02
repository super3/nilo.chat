const crypto = require('crypto');

const CHANNELS = ['welcome', 'general', 'growth', 'feedback'];
const MAX_URL_LENGTH = 2048;
const MAX_WEBHOOKS_PER_AGENT = 10;

/**
 * Generate a unique webhook secret for HMAC signing.
 * @returns {string} 32-byte hex string
 */
function generateWebhookSecret() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Compute HMAC-SHA256 signature for a payload using the webhook secret.
 * @param {string} payload - JSON string to sign
 * @param {string} secret - Webhook secret
 * @returns {string} Hex-encoded HMAC signature
 */
function signPayload(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Build the webhook router and outgoing dispatcher.
 *
 * @param {import('pg').Pool} pool - PostgreSQL connection pool
 * @param {Function} authMiddleware - requireApiKey middleware instance
 * @returns {{ router: import('express').Router, dispatchWebhooks: Function }}
 */
function createWebhookRouter(pool, authMiddleware) {
  const express = require('express');
  const router = express.Router();

  // -------------------------------------------------------------------------
  // POST /api/webhooks — register a new outgoing webhook
  // -------------------------------------------------------------------------
  router.post('/', authMiddleware, async (req, res) => {
    const { url, channels } = req.body;

    // Validate URL
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
      return res.status(400).json({ error: 'url must be a valid URL' });
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return res.status(400).json({ error: 'url must use http or https protocol' });
    }

    // Validate channels (optional — defaults to all)
    let subscribedChannels = CHANNELS;
    if (channels !== undefined) {
      if (!Array.isArray(channels) || channels.length === 0) {
        return res.status(400).json({ error: 'channels must be a non-empty array' });
      }
      const invalid = channels.filter((c) => !CHANNELS.includes(c));
      if (invalid.length > 0) {
        return res.status(400).json({
          error: `Invalid channels: ${invalid.join(', ')}. Must be one of: ${CHANNELS.join(', ')}`,
        });
      }
      subscribedChannels = channels;
    }

    try {
      // Enforce per-agent limit
      const countResult = await pool.query(
        'SELECT COUNT(*) AS cnt FROM webhooks WHERE agent_id = $1',
        [req.agent.id]
      );
      if (parseInt(countResult.rows[0].cnt, 10) >= MAX_WEBHOOKS_PER_AGENT) {
        return res.status(400).json({
          error: `Maximum of ${MAX_WEBHOOKS_PER_AGENT} webhooks per agent`,
        });
      }

      const secret = generateWebhookSecret();

      const result = await pool.query(
        `INSERT INTO webhooks (agent_id, url, channels, secret)
         VALUES ($1, $2, $3, $4)
         RETURNING id, url, channels, created_at`,
        [req.agent.id, url.trim(), JSON.stringify(subscribedChannels), secret]
      );

      const row = result.rows[0];
      res.status(201).json({
        id: row.id,
        url: row.url,
        channels: JSON.parse(row.channels),
        secret,
        created_at: row.created_at,
      });
    } catch (err) {
      console.error('Webhooks: Error creating webhook:', err);
      res.status(500).json({ error: 'Failed to create webhook' });
    }
  });

  // -------------------------------------------------------------------------
  // GET /api/webhooks — list webhooks for the authenticated agent
  // -------------------------------------------------------------------------
  router.get('/', authMiddleware, async (req, res) => {
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

  // -------------------------------------------------------------------------
  // DELETE /api/webhooks/:id — delete a webhook owned by the agent
  // -------------------------------------------------------------------------
  router.delete('/:id', authMiddleware, async (req, res) => {
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

      res.json({ deleted: result.rows[0] });
    } catch (err) {
      console.error('Webhooks: Error deleting webhook:', err);
      res.status(500).json({ error: 'Failed to delete webhook' });
    }
  });

  // -------------------------------------------------------------------------
  // Outgoing webhook dispatcher — call this after a message is saved
  // -------------------------------------------------------------------------

  /**
   * Fire outgoing webhooks for a new chat message.
   *
   * @param {{ timestamp: string, username: string, message: string, channel: string }} messageObject
   */
  async function dispatchWebhooks(messageObject) {
    let rows;
    try {
      const result = await pool.query('SELECT id, url, channels, secret FROM webhooks');
      rows = result.rows;
    } catch (err) {
      console.error('Webhooks: Error fetching webhooks for dispatch:', err);
      return;
    }

    for (const row of rows) {
      const channels = JSON.parse(row.channels);
      if (!channels.includes(messageObject.channel)) continue;

      const payload = JSON.stringify({
        event: 'chat_message',
        data: messageObject,
      });

      const signature = signPayload(payload, row.secret);

      // Fire-and-forget — don't block message flow
      fetch(row.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Nilo-Signature': signature,
        },
        body: payload,
        signal: AbortSignal.timeout(5000),
      }).catch((err) => {
        console.error(`Webhooks: delivery failed for webhook ${row.id} (${row.url}):`, err.message);
      });
    }
  }

  return { router, dispatchWebhooks };
}

module.exports = { createWebhookRouter, generateWebhookSecret, signPayload };
