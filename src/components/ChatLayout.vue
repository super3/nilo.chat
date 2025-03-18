<template>
  <div class="font-sans antialiased h-screen flex w-full">
    <!-- Sidebar / channel list -->
    <ChannelSidebar />
    <DirectMessageSidebar :username="username" />
    <!-- Chat content -->
    <ChatContent :username="username" />
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
    return {
      username: 'User_' + Math.floor(Math.random() * 1000)
    }
  }
}
</script> 