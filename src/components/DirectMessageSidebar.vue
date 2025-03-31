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
      <div class="px-4 mb-1 text-white flex items-center">
        <div @click="toggleChannels" class="cursor-pointer w-4 mr-2 flex justify-center">
          <svg v-if="showChannels" class="fill-current h-4 w-4 opacity-50" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
            <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
          </svg>
          <svg v-else class="fill-current h-4 w-4 opacity-50" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
            <path d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"/>
          </svg>
        </div>
        <div @click="toggleChannels" class="opacity-75 flex-1 cursor-pointer">Channels</div>
        <div>
          <svg class="fill-current h-4 w-4 opacity-50" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
            <path d="M11 9h4v2h-4v4H9v-4H5V9h4V5h2v4zm-1 11a10 10 0 1 1 0-20 10 10 0 0 1 0 20zm0-2a8 8 0 1 0 0-16 8 8 0 0 0 0 16z" />
          </svg>
        </div>
      </div>
      <!-- Show all channels when showChannels is true -->
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
      <!-- Show only selected channel when showChannels is false -->
      <div v-else>
        <div 
          v-if="currentChannel === 'general'"
          @click="switchChannel('general')" 
          class="px-4 py-1 text-white flex items-center cursor-pointer hover:bg-teal-darker bg-teal-dark"
        >
          <div class="w-4 mr-2 text-center">#</div>
          <span>general</span>
        </div>
        <div 
          v-if="currentChannel === 'feedback'"
          @click="switchChannel('feedback')" 
          class="px-4 py-1 text-white flex items-center cursor-pointer hover:bg-teal-darker bg-teal-dark"
        >
          <div class="w-4 mr-2 text-center">#</div>
          <span>feedback</span>
        </div>
      </div>
    </div>
    
    <!-- Direct Messages section -->
    <div class="mb-8">
      <div class="px-4 mb-1 text-white flex items-center">
        <div @click="toggleDirectMessages" class="cursor-pointer w-4 mr-2 flex justify-center">
          <svg v-if="showDirectMessages" class="fill-current h-4 w-4 opacity-50" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
            <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
          </svg>
          <svg v-else class="fill-current h-4 w-4 opacity-50" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
            <path d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"/>
          </svg>
        </div>
        <div @click="toggleDirectMessages" class="opacity-75 flex-1 cursor-pointer">Direct Messages</div>
        <div>
          <svg class="fill-current h-4 w-4 opacity-50" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
            <path d="M11 9h4v2h-4v4H9v-4H5V9h4V5h2v4zm-1 11a10 10 0 1 1 0-20 10 10 0 0 1 0 20zm0-2a8 8 0 1 0 0-16 8 8 0 0 0 0 16z" />
          </svg>
        </div>
      </div>
      <!-- Show all DMs when expanded -->
      <div v-if="showDirectMessages">
        <div class="px-4 py-1 flex items-center cursor-pointer hover:bg-teal-darker"
             :class="{ 'bg-teal-dark': currentChannel === 'dm_self' }"
             @click="switchChannel('dm_self')"
             data-testid="dm-self">
          <div class="w-4 mr-2 flex justify-center">
            <span :class="[isConnected ? 'bg-green-500' : 'border border-white', 'rounded-full block w-2 h-2']"></span>
          </div>
          <span class="text-white opacity-75">{{ username }} 
            <span :class="[currentChannel === 'dm_self' ? 'text-white text-opacity-80' : 'text-gray-500', 'text-sm']">(you)</span>
          </span>
        </div>
        <div class="px-4 py-1 flex items-center cursor-pointer hover:bg-teal-darker" 
             :class="{ 'bg-teal-dark': currentChannel === 'dm_steve' }"
             @click="switchChannel('dm_steve')"
             data-testid="dm-steve">
          <div class="w-4 mr-2 flex justify-center">
            <span class="bg-green-500 rounded-full block w-2 h-2"></span>
          </div>
          <span class="text-white opacity-75">steve</span>
          <div v-if="steveUnreadCount > 0" class="ml-auto">
            <span class="bg-red-500 text-white text-xs rounded-full py-1 px-2 font-semibold">
              {{ steveUnreadCount }}
            </span>
          </div>
        </div>
      </div>
      <!-- Since DMs don't have a 'selected' concept, we won't show any when collapsed -->
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
    },
    steveUnreadCount: {
      type: Number,
      default: 0
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