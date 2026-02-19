const express = require('express');

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

  // --- GET /api/channels ---------------------------------------------------
  router.get('/channels', (_req, res) => {
    const channels = CHANNELS.map((name) => ({
      name,
      description: CHANNEL_DESCRIPTIONS[name],
    }));
    res.json(channels);
  });

  // --- GET /api/messages/:channel ------------------------------------------
  router.get('/messages/:channel', async (req, res) => {
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
  router.post('/messages', async (req, res) => {
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
