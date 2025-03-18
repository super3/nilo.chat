<template>
  <div class="flex items-start mb-4 text-sm">
    <img :src="avatarUrl" class="w-10 h-10 rounded mr-3">
    <div class="flex-1 overflow-hidden">
      <div>
        <span class="font-bold">{{ username }}</span>
        <span class="text-gray-500 text-xs">{{ timestamp }}</span>
      </div>
      <p class="text-black leading-normal" v-if="!hasCode">{{ message }}</p>
      <template v-else>
        <p class="text-black leading-normal">{{ message }}</p>
        <div class="bg-gray-100 border border-gray-200 text-gray-800 text-sm font-mono rounded p-3 mt-2 whitespace-pre overflow-scroll">{{ code }}</div>
      </template>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ChatMessage',
  props: {
    username: {
      type: String,
      required: true
    },
    timestamp: {
      type: String,
      required: true
    },
    message: {
      type: String,
      required: true
    },
    code: {
      type: String,
      default: ''
    },
    avatarColor: {
      type: String,
      default: '4F46E5'
    }
  },
  computed: {
    hasCode() {
      return this.code !== '';
    },
    avatarUrl() {
      return `https://ui-avatars.com/api/?name=${encodeURIComponent(this.username)}&background=${this.avatarColor}&color=fff`;
    }
  }
}
</script> 