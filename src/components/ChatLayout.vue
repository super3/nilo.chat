<template>
  <div class="font-sans antialiased h-screen flex w-full">
    <!-- Sidebar / channel list -->
    <ServerSidebar 
      :current-channel="currentChannel"
      :channel-unread-counts="channelUnreadCounts"
      @channel-change="changeChannel"
    />
    <MainSidebar 
      :username="username" 
      :is-connected="isConnected"
      :current-channel="currentChannel"
      :channel-unread-counts="channelUnreadCounts"
      @channel-change="changeChannel"
    />
    <!-- Chat content -->
    <ChatContent 
      :username="username" 
      :current-channel="currentChannel"
      @connection-change="handleConnectionStatusChange"
      @username-change="handleUsernameChange" 
      @channel-change="changeChannel"
      @message-received="handleMessageReceived"
      ref="chatContent"
    />
  </div>
</template>

<script>
import ServerSidebar from './ServerSidebar.vue'
import MainSidebar from './MainSidebar.vue'
import ChatContent from './ChatContent.vue'

export default {
  name: 'ChatLayout',
  components: {
    ServerSidebar,
    MainSidebar,
    ChatContent
  },
  data() {
    // Get username from localStorage or generate a random one
    let username;
    try {
      username = localStorage.getItem('nilo_username');
    } catch (e) {
      username = null;
    }
    if (!username) {
      username = 'User_' + Math.floor(Math.random() * 1000);
      try { localStorage.setItem('nilo_username', username); } catch (e) { /* storage unavailable */ }
    }
    // Get current channel from localStorage or default to general
    let savedChannel;
    try {
      savedChannel = localStorage.getItem('nilo_channel') || 'general';
    } catch (e) {
      savedChannel = 'general';
    }
    // Check if this is the first time joining
    let isFirstJoin;
    try {
      isFirstJoin = localStorage.getItem('nilo_first_join') !== 'true';
    } catch (e) {
      isFirstJoin = true;
    }

    // Set the flag for future sessions
    if (isFirstJoin) {
      try { localStorage.setItem('nilo_first_join', 'true'); } catch (e) { /* storage unavailable */ }
    }

    return {
      username: username,
      isConnected: false,
      currentChannel: savedChannel,
      isFirstJoin: isFirstJoin,
      channelUnreadCounts: {
        welcome: 0,
        general: 0,
        growth: 0,
        feedback: 0
      }
    }
  },
  methods: {
    changeChannel(channel) {
      this.currentChannel = channel;
      try { localStorage.setItem('nilo_channel', channel); } catch (e) { /* storage unavailable */ }

      // Reset unread count when switching to a channel
      this.channelUnreadCounts[channel] = 0;
    },
    handleUsernameChange(newUsername) {
      this.username = newUsername;
      try { localStorage.setItem('nilo_username', newUsername); } catch (e) { /* storage unavailable */ }
    },
    handleConnectionStatusChange(status) {
      this.isConnected = status;
    },
    handleMessageReceived(message) {
      if (message.channel && message.channel !== this.currentChannel) {
        this.channelUnreadCounts[message.channel]++;
      }
    }
  }
}
</script> 