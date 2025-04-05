<template>
  <div class="h-screen overflow-hidden" style="background: #edf2f7;">
    <ChatLayout />
  </div>
</template>

<script>
import ChatLayout from './components/ChatLayout.vue'
import './assets/styles/main.css'

export default {
  name: 'App',
  components: {
    ChatLayout
  }
}
</script>

<style>
/* Remove default outline and set subtle border color on focus */
input:focus {
  outline: none;
  border-color: #b8bcc4; 
}

/* Set subtle border color for message input container when focused */
.flex.rounded-lg.border-2:has(input:focus) {
  border-color: #b8bcc4;
}
</style>