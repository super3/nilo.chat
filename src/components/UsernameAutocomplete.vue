<template>
  <div
    v-if="visible && filteredUsers.length > 0"
    class="absolute bottom-full left-0 w-full bg-white rounded-lg shadow-lg mb-2 max-h-52 overflow-y-auto z-10 border border-gray-200"
  >
    <div class="autocomplete-header px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
      Members matching @{{ query || '…' }}
    </div>
    <div
      v-for="(user, index) in filteredUsers"
      :key="user"
      class="autocomplete-item flex items-center px-3 py-2 cursor-pointer"
      :class="{
        'bg-indigo-500 text-white': index === selectedIndex,
        'hover:bg-gray-100 text-gray-800': index !== selectedIndex
      }"
      @mousedown.prevent="selectUser(user)"
    >
      <div
        class="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold mr-3 flex-shrink-0"
        :style="{ backgroundColor: '#' + getAvatarColor(user) }"
      >
        {{ user.charAt(0).toUpperCase() }}
      </div>
      <span class="text-sm font-medium">{{ user }}</span>
    </div>
  </div>
</template>

<script>
export default {
  name: 'UsernameAutocomplete',
  props: {
    users: {
      type: Array,
      default: () => []
    },
    query: {
      type: String,
      default: ''
    },
    visible: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      selectedIndex: 0
    }
  },
  computed: {
    filteredUsers() {
      if (!this.query) return this.users;
      const lowerQuery = this.query.toLowerCase();
      return this.users.filter(user => user.toLowerCase().startsWith(lowerQuery));
    }
  },
  watch: {
    query() {
      this.selectedIndex = 0;
    },
    visible() {
      this.selectedIndex = 0;
    }
  },
  methods: {
    moveUp() {
      if (this.selectedIndex > 0) {
        this.selectedIndex--;
      }
    },
    moveDown() {
      if (this.selectedIndex < this.filteredUsers.length - 1) {
        this.selectedIndex++;
      }
    },
    confirmSelection() {
      if (this.filteredUsers.length > 0) {
        this.selectUser(this.filteredUsers[this.selectedIndex]);
      }
    },
    selectUser(user) {
      this.$emit('select', user);
    },
    getAvatarColor(username) {
      const colors = ['4F46E5', '3B82F6', '10B981', 'F59E0B', 'EF4444', '8B5CF6'];
      const name = username || 'anonymous';
      const index = Math.abs(name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % colors.length;
      return colors[index];
    }
  }
}
</script>
