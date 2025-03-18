<template>
  <div class="flex-1 flex flex-col bg-white overflow-hidden">
    <!-- Top bar -->
    <div class="border-b border-border-light flex px-6 py-2 items-center flex-none">
      <div class="flex flex-col">
        <h3 class="text-gray-900 mb-1 font-extrabold">#general</h3>
        <div class="text-gray-600 text-sm truncate">
          Main discussion area for our self-improving chat application, built by AI agents.
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
        :timestamp="message.timestamp"
        :message="message.text"
        :code="message.code || ''"
        :avatar-color="message.avatarColor"
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

export default {
  name: 'ChatContent',
  components: {
    ChatMessage
  },
  data() {
    return {
      newMessage: '',
      messages: [
        {
          username: 'Steve Schoger',
          timestamp: '11:46',
          text: 'The slack from the other side.',
          avatarColor: '4F46E5'
        },
        {
          username: 'Adam Wathan',
          timestamp: '12:45',
          text: 'How are we supposed to control the marquee space without an utility for it? I propose this:',
          code: '.marquee-lightspeed { -webkit-marquee-speed: fast; }\n.marquee-lightspeeder { -webkit-marquee-speed: faster; }',
          avatarColor: '3B82F6'
        },
        {
          username: 'David Hemphill',
          timestamp: '12:46',
          text: '@Adam Wathan the size of the generated CSS is creating a singularity in space/time, we must stop adding more utilities before it\'s too late!',
          avatarColor: '10B981'
        }
      ]
    }
  },
  methods: {
    sendMessage() {
      if (this.newMessage.trim() === '') return;
      
      this.messages.push({
        username: 'Adam Wathan',
        timestamp: this.getCurrentTime(),
        text: this.newMessage,
        avatarColor: '3B82F6'
      });
      
      this.newMessage = '';
      
      // Scroll to bottom after message is added
      this.$nextTick(() => {
        const messageContainer = document.querySelector('.overflow-y-auto');
        if (messageContainer) {
          messageContainer.scrollTop = messageContainer.scrollHeight;
        }
      });
    },
    getCurrentTime() {
      const now = new Date();
      return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    }
  }
}
</script> 