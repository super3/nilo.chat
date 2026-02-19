<template>
  <div class="font-sans antialiased h-screen flex w-full">
    <!-- Sidebar / channel list -->
    <ServerSidebar
      :current-channel="currentChannel"
      :channel-unread-counts="channelUnreadCounts"
      :is-signed-in="isSignedIn"
      :profile-image-url="profileImageUrl"
      :username="username"
      @channel-change="changeChannel"
      @sign-in="handleSignIn"
      @mount-user-button="mountClerkUserButton"
    />
    <MainSidebar
      :username="username"
      :is-connected="isConnected"
      :is-signed-in="isSignedIn"
      :current-channel="currentChannel"
      :channel-unread-counts="channelUnreadCounts"
      @channel-change="changeChannel"
      @sign-in="handleSignIn"
    />
    <!-- Chat content -->
    <ChatContent
      :username="username"
      :current-channel="currentChannel"
      :is-signed-in="isSignedIn"
      :profile-image-url="profileImageUrl"
      @connection-change="handleConnectionStatusChange"
      @username-change="handleUsernameChange"
      @channel-change="changeChannel"
      @message-received="handleMessageReceived"
      ref="chatContent"
    />
  </div>
</template>

<script>
import ServerSidebar from './ServerSidebar.vue'
import MainSidebar from './MainSidebar.vue'
import ChatContent from './ChatContent.vue'

export default {
  name: 'ChatLayout',
  components: {
    ServerSidebar,
    MainSidebar,
    ChatContent
  },
  data() {
    // Get username from localStorage or generate a random one
    let username;
    try {
      username = localStorage.getItem('nilo_username');
    } catch (e) {
      username = null;
    }
    if (!username) {
      username = 'User_' + Math.floor(Math.random() * 1000);
      try { localStorage.setItem('nilo_username', username); } catch (e) { /* storage unavailable */ }
    }
    // Get current channel from localStorage or default to general
    let savedChannel;
    try {
      savedChannel = localStorage.getItem('nilo_channel') || 'general';
    } catch (e) {
      savedChannel = 'general';
    }
    // Check if this is the first time joining
    let isFirstJoin;
    try {
      isFirstJoin = localStorage.getItem('nilo_first_join') !== 'true';
    } catch (e) {
      isFirstJoin = true;
    }

    // Set the flag for future sessions
    if (isFirstJoin) {
      try { localStorage.setItem('nilo_first_join', 'true'); } catch (e) { /* storage unavailable */ }
    }

    // Read cached auth state to prevent UI flash on refresh
    let cachedSignedIn = false;
    let cachedProfileImage = '';
    try {
      cachedSignedIn = localStorage.getItem('nilo_signed_in') === 'true';
      cachedProfileImage = localStorage.getItem('nilo_profile_image') || '';
    } catch (e) { /* storage unavailable */ }

    return {
      username: username,
      isConnected: false,
      currentChannel: savedChannel,
      isFirstJoin: isFirstJoin,
      isSignedIn: cachedSignedIn,
      profileImageUrl: cachedProfileImage,
      channelUnreadCounts: {
        welcome: 0,
        general: 0,
        growth: 0,
        feedback: 0
      }
    }
  },
  mounted() {
    this.initClerk();
  },
  beforeUnmount() {
    if (this._clerkPoll) {
      clearInterval(this._clerkPoll);
    }
  },
  methods: {
    waitForClerk(timeout = 5000) {
      return new Promise((resolve) => {
        if (window.Clerk) {
          resolve(window.Clerk);
          return;
        }
        const interval = 50;
        let elapsed = 0;
        const poll = setInterval(() => {
          elapsed += interval;
          if (window.Clerk) {
            clearInterval(poll);
            resolve(window.Clerk);
          } else if (elapsed >= timeout) {
            clearInterval(poll);
            resolve(null);
          }
        }, interval);
      });
    },
    async initClerk() {
      try {
        const clerk = await this.waitForClerk();
        if (!clerk) {
          return;
        }
        await clerk.load();

        if (clerk.user) {
          this.isSignedIn = true;
          this.profileImageUrl = clerk.user.imageUrl || '';
          try {
            localStorage.setItem('nilo_signed_in', 'true');
            localStorage.setItem('nilo_profile_image', clerk.user.imageUrl || '');
          } catch (e) { /* storage unavailable */ }
          const clerkName = clerk.user.username ||
            clerk.user.firstName ||
            clerk.user.emailAddresses[0]?.emailAddress;
          if (clerkName) {
            this.handleUsernameChange(clerkName);
          }
          // Re-mount Clerk user button now that Clerk is loaded
          // (needed when isSignedIn was cached — the early mount attempt
          // from ServerSidebar's mounted() hook fails before Clerk loads)
          if (this._clerkButtonEl) {
            this.mountClerkUserButton(this._clerkButtonEl);
          }
        } else if (this.isSignedIn) {
          // Cached state said signed in, but Clerk says not — reset
          this.isSignedIn = false;
          this.profileImageUrl = '';
          try {
            localStorage.setItem('nilo_signed_in', 'false');
            localStorage.setItem('nilo_profile_image', '');
          } catch (e) { /* storage unavailable */ }
          const anonName = 'User_' + Math.floor(Math.random() * 1000);
          this.handleUsernameChange(anonName);
        }

        this._clerkPoll = setInterval(() => {
          if (!window.Clerk.user && this.isSignedIn) {
            this.isSignedIn = false;
            this.profileImageUrl = '';
            try {
              localStorage.setItem('nilo_signed_in', 'false');
              localStorage.setItem('nilo_profile_image', '');
            } catch (e) { /* storage unavailable */ }
            const anonName = 'User_' + Math.floor(Math.random() * 1000);
            this.handleUsernameChange(anonName);
          }
        }, 1000);
      } catch (e) {
        // Clerk failed to load, continue as anonymous
      }
    },
    async handleSignIn() {
      try {
        const clerk = await this.waitForClerk();
        if (!clerk) {
          return;
        }
        if (!clerk.loaded) {
          await clerk.load();
        }
        await clerk.openSignIn({
          fallbackRedirectUrl: window.location.href
        });

        if (clerk.user) {
          this.isSignedIn = true;
          this.profileImageUrl = clerk.user.imageUrl || '';
          try {
            localStorage.setItem('nilo_signed_in', 'true');
            localStorage.setItem('nilo_profile_image', clerk.user.imageUrl || '');
          } catch (e) { /* storage unavailable */ }
          const clerkName = clerk.user.username ||
            clerk.user.firstName ||
            clerk.user.emailAddresses[0]?.emailAddress;
          if (clerkName) {
            this.handleUsernameChange(clerkName);
          }
        }
      } catch (e) {
        // Sign-in failed or was cancelled
      }
    },
    mountClerkUserButton(el) {
      this._clerkButtonEl = el;
      try {
        if (!window.Clerk || !el) {
          return;
        }
        window.Clerk.mountUserButton(el, {
          afterSignOutUrl: window.location.href,
          appearance: {
            elements: {
              rootBox: { width: '48px', height: '48px' },
              userButtonBox: { width: '48px', height: '48px' },
              userButtonTrigger: { width: '48px', height: '48px', borderRadius: '0.5rem' },
              userButtonAvatarBox: { width: '48px', height: '48px', borderRadius: '0.5rem', overflow: 'hidden' },
              avatarBox: { width: '48px', height: '48px', borderRadius: '0.5rem', overflow: 'hidden' },
              avatarImage: { width: '100%', height: '100%', objectFit: 'cover' },
              userButtonOuterIdentifier: { display: 'none' }
            }
          }
        });
      } catch (e) {
        // Clerk UserButton mount failed
      }
    },
    changeChannel(channel) {
      this.currentChannel = channel;
      try { localStorage.setItem('nilo_channel', channel); } catch (e) { /* storage unavailable */ }

      // Reset unread count when switching to a channel
      this.channelUnreadCounts[channel] = 0;
    },
    handleUsernameChange(newUsername) {
      this.username = newUsername;
      try { localStorage.setItem('nilo_username', newUsername); } catch (e) { /* storage unavailable */ }
    },
    handleConnectionStatusChange(status) {
      this.isConnected = status;
    },
    handleMessageReceived(message) {
      if (message.channel && message.channel !== this.currentChannel) {
        this.channelUnreadCounts[message.channel]++;
      }
    }
  }
}
</script> 