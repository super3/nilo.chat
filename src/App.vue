<template>
  <div class="h-screen overflow-hidden" style="background: #edf2f7;">
    <ChatLayout />
  </div>
</template>

<script>
import ChatLayout from './components/ChatLayout.vue'

export default {
  name: 'App',
  components: {
    ChatLayout
  }
}
</script>

<style>
@tailwind base;
@tailwind components;
@tailwind utilities;
</style> 