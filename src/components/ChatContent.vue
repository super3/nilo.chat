<template>
  <div class="flex-1 flex flex-col bg-white overflow-hidden">
    <!-- Top bar -->
    <div class="border-b border-border-light flex px-6 py-2 items-center flex-none">
      <div class="flex flex-col">
        <h3 class="text-gray-900 mb-1 font-extrabold">
          <span>#{{ getChannelDisplayName() }}</span>
        </h3>
        <div class="text-gray-600 text-sm truncate">
          {{ channelDescription }}
        </div>
      </div>
      <!-- Search box disabled - not currently functional
      <div class="ml-auto hidden lg:block">
        <div class="relative">
          <input type="search" placeholder="Search" class="appearance-none border border-gray-300 rounded-lg pl-8 pr-4 py-2 w-64">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center justify-center">
            <svg class="fill-current text-gray-500 h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
              <path d="M12.9 14.32a8 8 0 1 1 1.41-1.41l5.35 5.33-1.42 1.42-5.33-5.34zM8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12z" />
            </svg>
          </div>
        </div>
      </div>
      -->
    </div>
    <!-- Chat messages -->
    <div ref="messageContainer" class="px-6 py-4 flex-1 overflow-y-auto" @scroll="checkScrollPosition">
      <ChatMessage
        v-for="(message, index) in messages"
        :key="index"
        :username="message.username"
        :timestamp="formatTimestamp(message.timestamp)"
        :message="message.message"
        :code="message.code || ''"
        :avatar-color="getAvatarColor(message.username)"
      />
    </div>
    <div class="pb-6 px-4 flex-none">
      <div class="flex rounded-lg border-2 border-gray-300 overflow-hidden">
        <span class="text-3xl text-gray-500 border-r-2 border-gray-300 p-2">
          <svg class="fill-current h-6 w-6 block" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
            <path d="M16 10c0 .553-.048 1-.601 1H11v4.399c0 .552-.447.601-1 .601-.553 0-1-.049-1-.601V11H4.601C4.049 11 4 10.553 4 10c0-.553.049-1 .601-1H9V4.601C9 4.048 9.447 4 10 4c.553 0 1 .048 1 .601V9h4.399c.553 0 .601.447.601 1z"/>
          </svg>
        </span>
        <input
          type="text"
          class="w-full px-4"
          :placeholder="getInputPlaceholder()"
          v-model="newMessage"
          @keyup.enter="sendMessage"
        />
      </div>
    </div>
  </div>
</template>

<script>
import ChatMessage from './ChatMessage.vue'
import io from 'socket.io-client'

const MAX_MESSAGE_LENGTH = 2000
const MAX_USERNAME_LENGTH = 30

export default {
  name: 'ChatContent',
  components: {
    ChatMessage
  },
  props: {
    username: {
      type: String,
      required: true
    },
    currentChannel: {
      type: String,
      default: 'general'
    }
  },
  data() {
    return {
      newMessage: '',
      messages: [],
      socket: null,
      isConnected: false,
      isAtBottom: true,
      localUsername: this.username,
      localChannel: this.currentChannel
    }
  },
  computed: {
    channelDescription() {
      const descriptions = {
        welcome: 'Say hi — no account needed.',
        general: 'Announcements and workspace updates.',
        growth: 'Outreach, experiments, and new user activity.',
        feedback: 'Bugs, ideas, and feature requests.'
      };
      return descriptions[this.currentChannel] || 'Channel description';
    }
  },
  watch: {
    username(newValue) {
      this.localUsername = newValue;
    },
    currentChannel(newValue) {
      this.localChannel = newValue;
      // When channel changes, load that channel's messages
      if (this.socket && this.isConnected) {
        this.socket.emit('join_channel', {
          channel: this.localChannel,
          username: this.localUsername
        });
      }
      // Clear messages until we get the new channel's history
      this.messages = [];
    }
  },
  mounted() {
    // Check if we're running locally (on localhost) or in production
    const isLocalhost = window.location.hostname === 'localhost' ||
                        window.location.hostname === '127.0.0.1';
    const isGitHubPages = window.location.hostname === 'nilo.chat' ||
                          window.location.hostname === 'super3.github.io';

    // Connect to the WebSocket server
    // - localhost: connect to local dev server
    // - GitHub Pages: connect to production Railway backend
    // - Railway (PR previews): connect to same origin
    let socketUrl;
    if (isLocalhost) {
      socketUrl = 'http://localhost:3000';
    } else if (isGitHubPages) {
      socketUrl = process.env.VUE_APP_SOCKET_URL;
    } else {
      socketUrl = window.location.origin;
    }

    this.socket = io(socketUrl);

    // Handle connection events
    this.socket.on('connect', () => {
      this.isConnected = true;
      this.$emit('connection-change', true);

      // Check if this is a returning user
      let isReturningUser = false;
      try { isReturningUser = localStorage.getItem('nilo_first_join') === 'true'; } catch (e) { /* storage unavailable */ }

      // Emit the username when connecting and join the current channel
      this.socket.emit('user_connected', {
        username: this.localUsername,
        channel: this.localChannel,
        isReturningUser: isReturningUser
      });
    });

    // Also scroll to bottom when component is initially mounted
    this.$nextTick(() => {
      this.scrollToBottom();
    });

    this.socket.on('disconnect', () => {
      this.isConnected = false;
      this.$emit('connection-change', false);
    });

    this.socket.on('connect_error', () => {
      this.isConnected = false;
      this.$emit('connection-change', false);
    });

    // Listen for message history when connecting
    this.socket.on('message_history', (history) => {
      this.messages = history.map(msg => {
        const parts = msg.split('|');
        const timestamp = parts[0];
        const username = parts[1];
        const message = parts.slice(2).join('|');
        return { timestamp, username, message };
      });

      // Scroll to bottom after message history is loaded
      this.$nextTick(() => {
        this.scrollToBottom();
      });
    });

    // Listen for new messages
    this.socket.on('chat_message', ({ timestamp, username, message, channel }) => {
      // Handle messages based on channel
      if (channel && channel !== this.currentChannel) {
        this.$emit('message-received', { timestamp, username, message, channel });
        return;
      }

      const messageObj = { timestamp, username, message };
      this.messages.push(messageObj);

      // Emit message received event (for notification handling)
      this.$emit('message-received', { ...messageObj, channel: this.currentChannel });

      // Scroll to bottom if user is at bottom
      this.$nextTick(() => {
        if (this.isAtBottom) {
          this.scrollToBottom();
        }
      });
    });

    // Handle username changes
    this.socket.on('username_change', (data) => {
      if (data.newUsername) {
        this.$emit('username-change', data.newUsername);
      }
    });

    // Handle channel change
    this.socket.on('join_channel', () => {
      // Server acknowledgment after joining a channel
    });
  },
  beforeUnmount() {
    // Disconnect socket when component is destroyed
    if (this.socket) {
      this.socket.disconnect();
    }
  },
  methods: {
    sendMessage() {
      if (this.newMessage.trim() === '') return;

      if (!this.isConnected) {
        return;
      }

      if (this.newMessage.length > MAX_MESSAGE_LENGTH) {
        this.messages.push({
          timestamp: new Date().toISOString(),
          username: 'System',
          message: `Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters.`
        });
        return;
      }

      // Check if this is a /nick command
      if (this.newMessage.startsWith('/nick ')) {
        const newUsername = this.newMessage.slice(6).trim();

        if (newUsername && newUsername.length > MAX_USERNAME_LENGTH) {
          this.messages.push({
            timestamp: new Date().toISOString(),
            username: 'System',
            message: `Username exceeds maximum length of ${MAX_USERNAME_LENGTH} characters.`
          });
          this.newMessage = '';
          return;
        }

        if (newUsername) {
          // Emit an event to the parent component to change the username
          this.$emit('username-change', newUsername);

          // Notify the server about the username change
          if (this.socket) {
            this.socket.emit('username_change', {
              oldUsername: this.localUsername,
              newUsername: newUsername,
              channel: this.localChannel
            });
          }

          // Add a system message about the username change
          this.messages.push({
            timestamp: new Date().toISOString(),
            username: 'System',
            message: `${this.localUsername} changed their username to ${newUsername}`
          });
        }
      } else {
        // Send regular message to server
        this.socket.emit('chat_message', {
          username: this.localUsername,
          message: this.newMessage,
          channel: this.localChannel
        });
      }

      this.newMessage = '';
    },
    formatTimestamp(timestamp) {
      try {
        const date = new Date(timestamp);
        return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
      } catch (e) {
        return timestamp;
      }
    },
    getMessageContainer() {
      return this.$refs.messageContainer;
    },
    scrollToBottom() {
      const container = this.getMessageContainer();
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    },
    checkScrollPosition() {
      const container = this.getMessageContainer();
      if (container) {
        const scrollBottom = container.scrollTop + container.clientHeight;
        const threshold = 50; // pixels from bottom to consider "at bottom"
        this.isAtBottom = scrollBottom >= (container.scrollHeight - threshold);
      }
    },
    getAvatarColor(username) {
      // Generate a consistent color based on username
      const colors = ['4F46E5', '3B82F6', '10B981', 'F59E0B', 'EF4444', '8B5CF6'];
      // Handle the case when username is undefined or null
      const name = username || 'anonymous';
      const index = Math.abs(name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % colors.length;
      return colors[index];
    },
    switchChannel(channel) {
      if (this.socket && channel !== this.localChannel) {
        // Use emit instead of directly modifying prop
        this.$emit('channel-change', channel);

        this.socket.emit('join_channel', {
          username: this.localUsername,
          channel: channel
        });

        // Update messages for the new channel
        this.messages = [];
      }
    },
    getChannelDisplayName() {
      return this.currentChannel;
    },
    getInputPlaceholder() {
      return `Message #${this.currentChannel}`;
    }
  }
}
</script>
