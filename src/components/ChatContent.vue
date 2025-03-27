<template>
  <div class="flex-1 flex flex-col bg-white overflow-hidden">
    <!-- Top bar -->
    <div class="border-b border-border-light flex px-6 py-2 items-center flex-none">
      <div class="flex flex-col">
        <h3 class="text-gray-900 mb-1 font-extrabold">#general</h3>
        <div class="text-gray-600 text-sm truncate">
          Main discussion area for our self-improving chat application.
        </div>
      </div>
      <div class="ml-auto hidden md:block">
        <div class="relative">
          <input type="search" placeholder="Search" class="appearance-none border border-gray-300 rounded-lg pl-8 pr-4 py-2">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center justify-center">
            <svg class="fill-current text-gray-500 h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
              <path d="M12.9 14.32a8 8 0 1 1 1.41-1.41l5.35 5.33-1.42 1.42-5.33-5.34zM8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12z" />
            </svg>
          </div>
        </div>
      </div>
    </div>
    <!-- Chat messages -->
    <div class="px-6 py-4 flex-1 overflow-y-auto">
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
          placeholder="Message #general" 
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

export default {
  name: 'ChatContent',
  components: {
    ChatMessage
  },
  props: {
    username: {
      type: String,
      required: true
    }
  },
  data() {
    return {
      newMessage: '',
      messages: [],
      socket: null,
      isConnected: false
    }
  },
  mounted() {
    // Check if we're running locally (on localhost) or in production
    const isLocalhost = window.location.hostname === 'localhost' || 
                        window.location.hostname === '127.0.0.1';
    
    // Connect to the WebSocket server
    const socketUrl = isLocalhost 
      ? 'http://localhost:3000' 
      : 'https://api.nilo.chat';
    
    console.log(`Connecting to Socket.IO server at: ${socketUrl}`);
    this.socket = io(socketUrl);
    
    // Handle connection events
    this.socket.on('connect', () => {
      this.isConnected = true;
      this.$emit('connection-change', true);
      
      // Emit the username when connecting
      this.socket.emit('user_connected', {
        username: this.username
      });
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
        const [timestamp, username, message] = msg.split('|');
        return { timestamp, username, message };
      });
    });
    
    // Listen for new messages
    this.socket.on('chat_message', (data) => {
      this.messages.push(data);
      
      // Scroll to bottom after message is added
      this.$nextTick(() => {
        const messageContainer = document.querySelector('.overflow-y-auto');
        if (messageContainer) {
          messageContainer.scrollTop = messageContainer.scrollHeight;
        }
      });
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
        // Optionally, you could add a notification here that the message can't be sent
        return;
      }
      
      // Send message to server
      this.socket.emit('chat_message', {
        username: this.username,
        message: this.newMessage
      });
      
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
    getAvatarColor(username) {
      // Generate a consistent color based on username
      const colors = ['4F46E5', '3B82F6', '10B981', 'F59E0B', 'EF4444', '8B5CF6'];
      // Handle the case when username is undefined or null
      const name = username || 'anonymous';
      const index = Math.abs(name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % colors.length;
      return colors[index];
    }
  }
}
</script> 