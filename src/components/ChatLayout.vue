<template>
  <div class="font-sans antialiased h-screen flex w-full">
    <!-- Sidebar / channel list -->
    <ChannelSidebar 
      :current-channel="currentChannel"
      :channel-unread-counts="channelUnreadCounts"
      @channel-change="changeChannel"
    />
    <DirectMessageSidebar 
      :username="username" 
      :is-connected="isConnected"
      :current-channel="currentChannel"
      :steve-unread-count="steveUnreadCount"
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
      isFirstJoin: isFirstJoin,
      channelUnreadCounts: {
        general: 0,
        feedback: 0,
        dm_self: 0,
        dm_steve: isFirstJoin ? 1 : 0
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
      localStorage.setItem('nilo_chat_last_channel', channel);
      
      // Reset unread count when switching to a channel
      this.channelUnreadCounts[channel] = 0;
      
      // Also reset steve's unread count when switching to dm_steve
      if (channel === 'dm_steve') {
        this.steveUnreadCount = 0;
      }
    },
    handleUsernameChange(newUsername) {
      this.username = newUsername;
    },
    handleConnectionStatusChange(status) {
      this.isConnected = status;
    },
    handleMessageReceived(message) {
      console.log(`ChatLayout received message:`, message);
      
      // If this is a message from steve and the current channel is not dm_steve
      if (message.username === 'steve' && this.currentChannel !== 'dm_steve') {
        console.log(`Incrementing steve unread count`);
        this.steveUnreadCount++;
      }
      
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
    },
    clearSteveUnreadCount() {
      this.steveUnreadCount = 0;
      this.channelUnreadCounts['dm_steve'] = 0;
    }
  }
}
</script> 