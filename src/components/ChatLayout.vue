<template>
  <div class="font-sans antialiased h-screen flex w-full">
    <!-- Sidebar / channel list -->
    <ChannelSidebar />
    <DirectMessageSidebar 
      :username="username" 
      :is-connected="isConnected"
      :current-channel="currentChannel"
      :steve-unread-count="steveUnreadCount"
      @channel-change="changeChannel"
    />
    <!-- Chat content -->
    <ChatContent 
      :username="username" 
      :current-channel="currentChannel"
      @connection-change="updateConnectionStatus"
      @username-change="changeUsername" 
      @channel-change="changeChannel"
      @message-received="handleMessageReceived"
      @steve-message-read="clearSteveUnreadCount"
      ref="chatContent"
    />
  </div>
</template>

<script>
import ChannelSidebar from './ChannelSidebar.vue'
import DirectMessageSidebar from './DirectMessageSidebar.vue'
import ChatContent from './ChatContent.vue'

export default {
  name: 'ChatLayout',
  components: {
    ChannelSidebar,
    DirectMessageSidebar,
    ChatContent
  },
  data() {
    // Get username from localStorage or generate a random one
    const savedUsername = localStorage.getItem('nilo_username');
    // Get current channel from localStorage or default to general
    const savedChannel = localStorage.getItem('nilo_channel') || 'general';
    // Check if this is the first time joining
    const isFirstJoin = localStorage.getItem('nilo_first_join') !== 'true';
    
    // Set the flag for future sessions
    if (isFirstJoin) {
      localStorage.setItem('nilo_first_join', 'true');
    }
    
    return {
      username: savedUsername || 'User_' + Math.floor(Math.random() * 1000),
      isConnected: false,
      currentChannel: savedChannel,
      steveUnreadCount: isFirstJoin ? 1 : 0,
      isFirstJoin: isFirstJoin
    }
  },
  mounted() {
    if (this.isFirstJoin) {
      // Mark that the user has joined before
      localStorage.setItem('nilo_first_join', 'true');
    }
  },
  methods: {
    updateConnectionStatus(status) {
      this.isConnected = status;
      
      // Server will handle sending steve's greeting message
      // No need to call it here anymore
    },
    changeUsername(newUsername) {
      this.username = newUsername;
      // Save username to localStorage
      localStorage.setItem('nilo_username', newUsername);
    },
    changeChannel(channel) {
      this.currentChannel = channel;
      // Save channel to localStorage
      localStorage.setItem('nilo_channel', channel);
    },
    handleMessageReceived(message) {
      // Increment unread count if message is from steve
      if (message.username === 'steve') {
        this.steveUnreadCount++;
      }
    },
    clearSteveUnreadCount() {
      this.steveUnreadCount = 0;
    }
  }
}
</script> 