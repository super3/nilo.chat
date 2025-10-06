<template>
  <div class="bg-indigo-darkest text-purple-lighter flex-none w-24 p-6 hidden md:block">
    <div class="cursor-pointer mb-4 relative" @click="switchChannel('general')">
      <div class="bg-indigo-lighter opacity-25 h-12 w-12 flex items-center justify-center text-black text-2xl font-semibold rounded-lg mb-1 overflow-hidden">
        N
      </div>
      <div class="text-center text-white opacity-50 text-sm">&#8984;1</div>
      <div v-if="getUnreadCount('general') > 0" class="absolute -top-1 -right-1">
        <span class="bg-red-600 text-white text-xs rounded-full py-1 px-2 font-bold">
          {{ getUnreadCount('general') }}
        </span>
      </div>
    </div>
    
    <a href="https://github.com/super3/nilo.chat" target="_blank" class="cursor-pointer block">
      <div class="bg-white opacity-25 h-12 w-12 flex items-center justify-center text-black text-2xl font-semibold rounded-lg mb-1 overflow-hidden hover:opacity-30 transition-opacity">
        <svg class="fill-current h-10 w-10 block" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
          <path d="M16 10c0 .553-.048 1-.601 1H11v4.399c0 .552-.447.601-1 .601-.553 0-1-.049-1-.601V11H4.601C4.049 11 4 10.553 4 10c0-.553.049-1 .601-1H9V4.601C9 4.048 9.447 4 10 4c.553 0 1 .048 1 .601V9h4.399c.553 0 .601.447.601 1z"/>
        </svg>
      </div>
    </a>
  </div>
</template>

<script>
export default {
  name: 'ServerSidebar',
  props: {
    currentChannel: {
      type: String,
      default: 'general'
    },
    channelUnreadCounts: {
      type: Object,
      default: () => ({
        general: 0,
        feedback: 0
      })
    }
  },
  methods: {
    switchChannel(channel) {
      if (channel !== this.currentChannel) {
        this.$emit('channel-change', channel);
      }
    },
    getUnreadCount(channel) {
      return this.channelUnreadCounts[channel] || 0;
    }
  }
}
</script> 