const { io } = require('socket.io-client');

const CHANNELS = ['welcome', 'general', 'growth', 'feedback'];

/**
 * Lightweight Socket.IO client for connecting to nilo.chat as a bot.
 *
 * Usage:
 *   const bot = new NiloBotClient('https://nilochat-production.up.railway.app', 'MyBot');
 *   bot.onMessage((msg) => console.log(msg));
 *   await bot.connect();
 *   await bot.sendMessage('general', 'Hello from the bot!');
 */
class NiloBotClient {
  constructor(serverUrl, username, options = {}) {
    if (!serverUrl) throw new Error('serverUrl is required');
    if (!username) throw new Error('username is required');

    this.serverUrl = serverUrl;
    this.username = username;
    this.currentChannel = options.channel || 'general';
    this.socket = null;
    this._messageListeners = [];
    this._historyListeners = [];
    this._errorListeners = [];
    this._connected = false;
  }

  /**
   * Connect to the nilo.chat server.
   * Returns a promise that resolves once the connection is established.
   */
  connect() {
    return new Promise((resolve, reject) => {
      this.socket = io(this.serverUrl, {
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 30000,
        transports: ['websocket', 'polling'],
      });

      this.socket.on('connect', () => {
        this._connected = true;
        this.socket.emit('user_connected', {
          username: this.username,
          channel: this.currentChannel,
        });
        resolve();
      });

      this.socket.on('connect_error', (err) => {
        if (!this._connected) {
          reject(new Error(`Connection failed: ${err.message}`));
        }
      });

      this.socket.on('chat_message', (msg) => {
        this._messageListeners.forEach((fn) => fn(msg));
      });

      this.socket.on('message_history', (history) => {
        this._historyListeners.forEach((fn) => fn(history));
      });

      this.socket.on('error', (err) => {
        this._errorListeners.forEach((fn) => fn(err));
      });

      this.socket.on('disconnect', () => {
        this._connected = false;
      });
    });
  }

  /** Register a listener for incoming chat messages. */
  onMessage(fn) {
    this._messageListeners.push(fn);
  }

  /** Register a listener for message history payloads. */
  onHistory(fn) {
    this._historyListeners.push(fn);
  }

  /** Register a listener for server errors. */
  onError(fn) {
    this._errorListeners.push(fn);
  }

  /** Send a chat message to the given channel. */
  sendMessage(channel, text) {
    if (!this._connected) throw new Error('Not connected');
    if (!CHANNELS.includes(channel)) {
      throw new Error(`Invalid channel "${channel}". Must be one of: ${CHANNELS.join(', ')}`);
    }
    if (this.currentChannel !== channel) {
      this.joinChannel(channel);
    }
    this.socket.emit('chat_message', {
      username: this.username,
      message: text,
      channel,
    });
  }

  /** Switch the bot to a different channel. */
  joinChannel(channel) {
    if (!this._connected) throw new Error('Not connected');
    if (!CHANNELS.includes(channel)) {
      throw new Error(`Invalid channel "${channel}". Must be one of: ${CHANNELS.join(', ')}`);
    }
    this.currentChannel = channel;
    this.socket.emit('join_channel', { channel });
  }

  /** Returns true when the underlying socket is connected. */
  get connected() {
    return this._connected;
  }

  /** Gracefully disconnect. */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this._connected = false;
    }
  }
}

module.exports = { NiloBotClient, CHANNELS };
