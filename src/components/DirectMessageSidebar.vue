<template>
  <div class="bg-indigo-darker text-purple-lighter flex-none w-64 pb-6 hidden md:block">
    <div class="text-white mb-2 mt-3 px-4 flex justify-between">
      <div class="flex-auto">
        <h1 class="font-semibold text-xl leading-tight mb-1 truncate">nilo.chat</h1>
        <div class="flex items-center mb-6">
          <span :class="[isConnected ? 'bg-green-500' : 'border border-white', 'rounded-full block w-2 h-2 mr-2']"></span>
          <span class="text-white/50 text-sm">{{ username }}</span>
        </div>
      </div>
    </div>
    
    <!-- Channels section -->
    <div class="mb-8">
      <div class="px-4 mb-2 text-white flex items-center">
        <div @click="toggleChannels" class="cursor-pointer w-4 mr-2 flex justify-center">
          <svg v-if="showChannels" class="fill-current h-4 w-4 opacity-50" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
            <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
          </svg>
          <svg v-else class="fill-current h-4 w-4 opacity-50" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
            <path d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"/>
          </svg>
        </div>
        <div class="opacity-75 flex-1">Channels</div>
        <div>
          <svg class="fill-current h-4 w-4 opacity-50" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
            <path d="M11 9h4v2h-4v4H9v-4H5V9h4V5h2v4zm-1 11a10 10 0 1 1 0-20 10 10 0 0 1 0 20zm0-2a8 8 0 1 0 0-16 8 8 0 0 0 0 16z" />
          </svg>
        </div>
      </div>
      <div v-if="showChannels">
        <div 
          @click="switchChannel('general')" 
          class="px-4 py-1 text-white flex items-center cursor-pointer hover:bg-teal-darker"
          :class="{ 'bg-teal-dark': currentChannel === 'general' }"
        >
          <div class="w-4 mr-2 text-center">#</div>
          <span>general</span>
        </div>
        <div 
          @click="switchChannel('feedback')" 
          class="px-4 py-1 text-white flex items-center cursor-pointer hover:bg-teal-darker"
          :class="{ 'bg-teal-dark': currentChannel === 'feedback' }"
        >
          <div class="w-4 mr-2 text-center">#</div>
          <span>feedback</span>
        </div>
      </div>
    </div>
    
    <!-- Direct Messages section -->
    <div class="mb-8">
      <div class="px-4 mb-2 text-white flex items-center">
        <div @click="toggleDirectMessages" class="cursor-pointer w-4 mr-2 flex justify-center">
          <svg v-if="showDirectMessages" class="fill-current h-4 w-4 opacity-50" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
            <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
          </svg>
          <svg v-else class="fill-current h-4 w-4 opacity-50" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
            <path d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"/>
          </svg>
        </div>
        <div class="opacity-75 flex-1">Direct Messages</div>
        <div>
          <svg class="fill-current h-4 w-4 opacity-50" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
            <path d="M11 9h4v2h-4v4H9v-4H5V9h4V5h2v4zm-1 11a10 10 0 1 1 0-20 10 10 0 0 1 0 20zm0-2a8 8 0 1 0 0-16 8 8 0 0 0 0 16z" />
          </svg>
        </div>
      </div>
      <div v-if="showDirectMessages">
        <div class="px-4 flex items-center mb-2" :class="{ 'opacity-50': !isConnected }">
          <div class="w-4 mr-2 flex justify-center">
            <span :class="[isConnected ? 'bg-green-500' : 'border border-white', 'rounded-full block w-2 h-2']"></span>
          </div>
          <span class="text-white opacity-75">{{ username }} <span class="text-gray-500 text-sm">(you)</span></span>
        </div>
        <div class="px-4 flex items-center mb-2">
          <div class="w-4 mr-2 flex justify-center">
            <span class="bg-green-500 rounded-full block w-2 h-2"></span>
          </div>
          <span class="text-white opacity-75">Steve_Nilo</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'DirectMessageSidebar',
  props: {
    username: {
      type: String,
      required: true
    },
    isConnected: {
      type: Boolean,
      default: false
    },
    currentChannel: {
      type: String,
      default: 'general'
    }
  },
  data() {
    return {
      showChannels: true,
      showDirectMessages: true
    }
  },
  methods: {
    toggleChannels() {
      this.showChannels = !this.showChannels;
    },
    toggleDirectMessages() {
      this.showDirectMessages = !this.showDirectMessages;
    },
    switchChannel(channel) {
      if (channel !== this.currentChannel) {
        this.$emit('channel-change', channel);
      }
    }
  }
}
</script> 