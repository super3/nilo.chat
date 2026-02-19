const { io } = require('socket.io-client');
const Anthropic = require('@anthropic-ai/sdk');

// Configuration
const NILO_URL = process.env.NILO_URL || 'http://localhost:3000';
const BOT_USERNAME = process.env.BOT_USERNAME || 'Austin';
const CHANNELS = ['welcome', 'general', 'growth', 'feedback'];
const MAX_HISTORY = 20;
const MAX_MESSAGE_LENGTH = 2000;

// Initialize Anthropic client
const anthropic = new Anthropic();

// Per-channel conversation history
const channelHistory = {};

function getHistory(channel) {
  if (!channelHistory[channel]) {
    channelHistory[channel] = [];
  }
  return channelHistory[channel];
}

function addToHistory(channel, role, content) {
  const history = getHistory(channel);
  history.push({ role, content });
  // Keep only the last MAX_HISTORY messages
  if (history.length > MAX_HISTORY) {
    channelHistory[channel] = history.slice(-MAX_HISTORY);
  }
}

async function getAIResponse(channel, userMessage, username) {
  addToHistory(channel, 'user', `${username}: ${userMessage}`);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1024,
    system: `You are ${BOT_USERNAME}, a friendly and helpful assistant in the nilo.chat community. You are chatting in the #${channel} channel. Keep responses concise and conversational. Do not use markdown formatting — this is a plain text chat.`,
    messages: getHistory(channel),
  });

  const reply = response.content[0].text;
  addToHistory(channel, 'assistant', reply);

  return reply;
}

function truncateMessage(message) {
  if (message.length <= MAX_MESSAGE_LENGTH) {
    return message;
  }
  return message.slice(0, MAX_MESSAGE_LENGTH - 3) + '...';
}

function start() {
  console.log(`Connecting to ${NILO_URL} as "${BOT_USERNAME}"...`);

  const socket = io(NILO_URL, {
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
  });

  socket.on('connect', () => {
    console.log('Connected to nilo.chat');

    // Join the first channel to register
    socket.emit('user_connected', {
      username: BOT_USERNAME,
      channel: CHANNELS[0],
      isReturningUser: true,
    });

    // Join all other channels
    for (let i = 1; i < CHANNELS.length; i++) {
      socket.emit('join_channel', {
        username: BOT_USERNAME,
        channel: CHANNELS[i],
      });
    }

    console.log(`Joined channels: ${CHANNELS.map(c => '#' + c).join(', ')}`);
  });

  socket.on('chat_message', async (msg) => {
    // Ignore own messages
    if (msg.username === BOT_USERNAME) {
      return;
    }

    // Ignore system messages
    if (msg.username === 'System') {
      return;
    }

    // Only respond in channels we're in
    const channel = msg.channel || 'general';
    if (!CHANNELS.includes(channel)) {
      return;
    }

    console.log(`[#${channel}] ${msg.username}: ${msg.message}`);

    try {
      const reply = await getAIResponse(channel, msg.message, msg.username);

      socket.emit('chat_message', {
        username: BOT_USERNAME,
        message: truncateMessage(reply),
        channel,
      });

      console.log(`[#${channel}] ${BOT_USERNAME}: ${reply.slice(0, 100)}${reply.length > 100 ? '...' : ''}`);
    } catch (error) {
      console.error('Error getting AI response:', error.message);
    }
  });

  socket.on('disconnect', (reason) => {
    console.log(`Disconnected: ${reason}`);
  });

  socket.on('connect_error', (error) => {
    console.error('Connection error:', error.message);
  });

  return socket;
}

// Run if executed directly
if (require.main === module) {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Error: ANTHROPIC_API_KEY environment variable is required');
    process.exit(1);
  }
  start();
}

module.exports = { start, getAIResponse, addToHistory, getHistory, truncateMessage, channelHistory };
