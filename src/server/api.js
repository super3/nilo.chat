const express = require('express');
const { hashKey, generateKey, requireApiKey, requireAdmin } = require('./auth');

const CHANNELS = ['welcome', 'general', 'growth', 'feedback'];
const CHANNEL_DESCRIPTIONS = {
  welcome:  'Say hi — no account needed.',
  general:  'Announcements and workspace updates.',
  growth:   'Outreach, experiments, and new user activity.',
  feedback: 'Bugs, ideas, and feature requests.',
};

const MAX_MESSAGE_LENGTH = 2000;
const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

/**
 * Build the /api router.
 *
 * @param {import('pg').Pool} pool  - PostgreSQL connection pool
 * @param {import('socket.io').Server} io - Socket.IO server instance
 * @returns {express.Router}
 */
function createApiRouter(pool, io) {
  const router = express.Router();
  const auth = requireApiKey(pool);

  // =========================================================================
  // Key management (admin-only)
  // =========================================================================

  // --- POST /api/keys — create a new API key -------------------------------
  router.post('/keys', requireAdmin, async (req, res) => {
    const { agent_name } = req.body;

    if (!agent_name || typeof agent_name !== 'string' || agent_name.trim() === '') {
      return res.status(400).json({ error: 'agent_name is required' });
    }

    const rawKey = generateKey();
    const keyHash = hashKey(rawKey);

    try {
      const result = await pool.query(
        'INSERT INTO api_keys (key_hash, agent_name) VALUES ($1, $2) RETURNING id, agent_name, created_at',
        [keyHash, agent_name.trim()]
      );

      const row = result.rows[0];

      // Return the raw key ONCE — it cannot be retrieved again
      res.status(201).json({
        id: row.id,
        agent_name: row.agent_name,
        api_key: rawKey,
        created_at: row.created_at,
      });
    } catch (err) {
      console.error('API: Error creating API key:', err);
      res.status(500).json({ error: 'Failed to create API key' });
    }
  });

  // --- DELETE /api/keys/:id — revoke an API key ----------------------------
  router.delete('/keys/:id', requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid key id' });
    }

    try {
      const result = await pool.query(
        'DELETE FROM api_keys WHERE id = $1 RETURNING id, agent_name',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'API key not found' });
      }

      res.json({ deleted: result.rows[0] });
    } catch (err) {
      console.error('API: Error deleting API key:', err);
      res.status(500).json({ error: 'Failed to delete API key' });
    }
  });

  // --- GET /api/keys — list all API keys (no secrets exposed) --------------
  router.get('/keys', requireAdmin, async (_req, res) => {
    try {
      const result = await pool.query(
        'SELECT id, agent_name, created_at FROM api_keys ORDER BY created_at DESC'
      );
      res.json(result.rows);
    } catch (err) {
      console.error('API: Error listing API keys:', err);
      res.status(500).json({ error: 'Failed to list API keys' });
    }
  });

  // =========================================================================
  // Chat endpoints (require valid agent API key)
  // =========================================================================

  // --- GET /api/channels ---------------------------------------------------
  router.get('/channels', auth, (_req, res) => {
    const channels = CHANNELS.map((name) => ({
      name,
      description: CHANNEL_DESCRIPTIONS[name],
    }));
    res.json(channels);
  });

  // --- GET /api/messages/:channel ------------------------------------------
  router.get('/messages/:channel', auth, async (req, res) => {
    const { channel } = req.params;
    if (!CHANNELS.includes(channel)) {
      return res.status(400).json({ error: `Invalid channel. Must be one of: ${CHANNELS.join(', ')}` });
    }

    let limit = parseInt(req.query.limit, 10);
    if (Number.isNaN(limit) || limit < 1) limit = DEFAULT_LIMIT;
    if (limit > MAX_LIMIT) limit = MAX_LIMIT;

    try {
      const result = await pool.query(
        'SELECT timestamp, username, message, channel FROM messages WHERE channel = $1 ORDER BY timestamp DESC LIMIT $2',
        [channel, limit]
      );
      // Return in chronological order (oldest first)
      res.json(result.rows.reverse());
    } catch (err) {
      console.error('API: Error reading messages:', err);
      res.status(500).json({ error: 'Failed to read messages' });
    }
  });

  // --- POST /api/messages --------------------------------------------------
  router.post('/messages', auth, async (req, res) => {
    const { channel, message, username } = req.body;

    // Validate channel
    if (!channel || !CHANNELS.includes(channel)) {
      return res.status(400).json({ error: `Invalid channel. Must be one of: ${CHANNELS.join(', ')}` });
    }
    // Validate message
    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ error: `Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters` });
    }
    // Validate username
    if (!username || typeof username !== 'string' || username.trim() === '') {
      return res.status(400).json({ error: 'Username is required' });
    }

    const timestamp = new Date().toISOString();

    try {
      await pool.query(
        'INSERT INTO messages (timestamp, username, message, channel) VALUES ($1, $2, $3, $4)',
        [timestamp, username, message, channel]
      );

      const messageObject = { timestamp, username, message, channel };

      // Broadcast to all connected Socket.IO clients so they see it in real time
      io.emit('chat_message', messageObject);

      res.status(201).json(messageObject);
    } catch (err) {
      console.error('API: Error saving message:', err);
      res.status(500).json({ error: 'Failed to save message' });
    }
  });

  return router;
}

module.exports = { createApiRouter };
