<template>
  <div class="font-sans antialiased h-screen flex w-full">
    <!-- Sidebar / channel list -->
    <ChannelSidebar />
    <DirectMessageSidebar 
      :username="username" 
      :is-connected="isConnected" 
    />
    <!-- Chat content -->
    <ChatContent 
      :username="username" 
      @connection-change="updateConnectionStatus"
      @username-change="changeUsername" 
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
    return {
      username: savedUsername || 'User_' + Math.floor(Math.random() * 1000),
      isConnected: false
    }
  },
  methods: {
    updateConnectionStatus(status) {
      this.isConnected = status;
    },
    changeUsername(newUsername) {
      this.username = newUsername;
      // Save username to localStorage
      localStorage.setItem('nilo_username', newUsername);
    }
  }
}
</script> 