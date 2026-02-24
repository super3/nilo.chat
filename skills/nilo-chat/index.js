/**
 * OpenClaw skill handler for nilo.chat.
 *
 * This module is loaded by the OpenClaw runtime when the nilo-chat skill is
 * activated.  It exposes three tools that let the agent interact with nilo.chat
 * through the REST API added in Phase 3, and optionally streams live messages
 * through a persistent Socket.IO connection.
 */

const { NiloBotClient } = require('../../src/server/bot-client');

const NILO_SERVER_URL =
  process.env.NILO_SERVER_URL || 'https://nilochat-production.up.railway.app';
const NILO_BOT_USERNAME = process.env.NILO_BOT_USERNAME || 'OpenClaw';
const NILO_API_KEY = process.env.NILO_API_KEY || '';

const CHANNELS = [
  { name: 'welcome',  description: 'Say hi — no account needed.' },
  { name: 'general',  description: 'Announcements and workspace updates.' },
  { name: 'growth',   description: 'Outreach, experiments, and new user activity.' },
  { name: 'feedback', description: 'Bugs, ideas, and feature requests.' },
];

// ---------------------------------------------------------------------------
// HTTP helpers (used for REST API calls — Phase 3)
// ---------------------------------------------------------------------------

async function apiRequest(path, options = {}) {
  const url = `${NILO_SERVER_URL}${path}`;
  const headers = { 'Content-Type': 'application/json' };
  if (NILO_API_KEY) {
    headers['x-api-key'] = NILO_API_KEY;
  }

  const res = await fetch(url, { ...options, headers: { ...headers, ...options.headers } });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${options.method || 'GET'} ${path} failed (${res.status}): ${body}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

async function nilo_send_message({ channel, message }) {
  return apiRequest('/api/messages', {
    method: 'POST',
    body: JSON.stringify({ channel, message, username: NILO_BOT_USERNAME }),
  });
}

async function nilo_read_messages({ channel, limit = 50 }) {
  return apiRequest(`/api/messages/${encodeURIComponent(channel)}?limit=${limit}`);
}

async function nilo_list_channels() {
  return CHANNELS;
}

// ---------------------------------------------------------------------------
// Live message streaming (Phase 3B — persistent Socket.IO connection)
// ---------------------------------------------------------------------------

let botClient = null;

/**
 * Start streaming live messages from nilo.chat.
 * The provided `onMessage` callback is invoked for every message that is NOT
 * from this bot (to prevent loops).
 */
async function startLiveStream(onMessage) {
  if (botClient && botClient.connected) return;

  botClient = new NiloBotClient(NILO_SERVER_URL, NILO_BOT_USERNAME);

  botClient.onMessage((msg) => {
    // Prevent self-reply loops
    if (msg.username === NILO_BOT_USERNAME) return;
    if (typeof onMessage === 'function') onMessage(msg);
  });

  await botClient.connect();
}

function stopLiveStream() {
  if (botClient) {
    botClient.disconnect();
    botClient = null;
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  tools: {
    nilo_send_message,
    nilo_read_messages,
    nilo_list_channels,
  },
  startLiveStream,
  stopLiveStream,
};
