<template>
  <div v-if="visible && filteredUsers.length > 0" class="absolute bottom-full left-0 w-full bg-white border border-gray-300 rounded-lg shadow-lg mb-1 max-h-40 overflow-y-auto z-10">
    <div
      v-for="(user, index) in filteredUsers"
      :key="user"
      class="px-4 py-2 cursor-pointer text-sm"
      :class="{ 'bg-blue-100 text-blue-800': index === selectedIndex, 'hover:bg-gray-100': index !== selectedIndex }"
      @mousedown.prevent="selectUser(user)"
    >
      @{{ user }}
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
    }
  }
}
</script>
