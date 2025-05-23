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
      isFirstJoin: isFirstJoin,
      channelUnreadCounts: {
        general: 0,
        feedback: 0,
        'slack-feed': 0
      }
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
    },
    changeUsername(newUsername) {
      this.username = newUsername;
      // Save username to localStorage
      localStorage.setItem('nilo_username', newUsername);
    },
    changeChannel(channel) {
      this.currentChannel = channel;
      localStorage.setItem('nilo_chat_last_channel', channel);
      
      // Reset unread count when switching to a channel
      this.channelUnreadCounts[channel] = 0;
    },
    handleUsernameChange(newUsername) {
      this.username = newUsername;
    },
    handleConnectionStatusChange(status) {
      this.isConnected = status;
    },
    handleMessageReceived(message) {
      console.log(`ChatLayout received message:`, message);
      
      // If the message has an explicit channel property
      if (message.channel) {
        console.log(`Message has channel: ${message.channel}, current channel: ${this.currentChannel}`);
        // Increment unread count if the message is for a channel that's not currently viewed
        if (message.channel !== this.currentChannel) {
          console.log(`Incrementing unread count for channel ${message.channel}`);
          this.channelUnreadCounts[message.channel]++;
          console.log(`New unread counts:`, this.channelUnreadCounts);
        }
      }
    }
  }
}
</script> 