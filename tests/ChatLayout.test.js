import { shallowMount } from '@vue/test-utils';
import ChatLayout from '../src/components/ChatLayout.vue';

// Mock child components
jest.mock('../src/components/ServerSidebar.vue', () => ({
  name: 'ServerSidebar',
  template: '<div>Channel Sidebar</div>'
}));

jest.mock('../src/components/MainSidebar.vue', () => ({
  name: 'MainSidebar',
  template: '<div>Main Sidebar</div>',
  props: ['username', 'isConnected', 'steveUnreadCount']
}));

jest.mock('../src/components/ChatContent.vue', () => ({
  name: 'ChatContent',
  template: '<div>Chat Content</div>',
  props: ['username'],
  emits: ['connection-change', 'username-change'],
  methods: {
    receiveGreetingFromSteve: jest.fn()
  }
}));

describe('ChatLayout.vue', () => {
  // Mock Math.random to return a predictable value
  const originalMathRandom = Math.random;
  // Mock localStorage
  const localStorageMock = (() => {
    let store = {};
    return {
      getItem: jest.fn(key => store[key] || null),
      setItem: jest.fn((key, value) => {
        store[key] = value.toString();
      }),
      clear: jest.fn(() => {
        store = {};
      })
    };
  })();

  beforeEach(() => {
    // Mock Math.random to return 0.5
    Math.random = jest.fn().mockReturnValue(0.5);
    // Setup localStorage mock
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock
    });
    // Clear localStorage before each test
    localStorageMock.clear();
    // Clear any window.Clerk mock
    delete window.Clerk;
  });

  afterEach(() => {
    // Restore original Math.random
    Math.random = originalMathRandom;
  });

  test('renders correctly with child components', () => {
    const wrapper = shallowMount(ChatLayout);

    // Check if component exists
    expect(wrapper.exists()).toBe(true);

    // Check if it has the expected root div with correct classes
    const rootDiv = wrapper.find('div');
    expect(rootDiv.exists()).toBe(true);
    expect(rootDiv.classes()).toContain('font-sans');
    expect(rootDiv.classes()).toContain('antialiased');
    expect(rootDiv.classes()).toContain('h-screen');
    expect(rootDiv.classes()).toContain('flex');
    expect(rootDiv.classes()).toContain('w-full');

    // Check if all child components exist
    const serverSidebar = wrapper.findComponent({ name: 'ServerSidebar' });
    expect(serverSidebar.exists()).toBe(true);

    const mainSidebar = wrapper.findComponent({ name: 'MainSidebar' });
    expect(mainSidebar.exists()).toBe(true);

    const chatContent = wrapper.findComponent({ name: 'ChatContent' });
    expect(chatContent.exists()).toBe(true);
  });

  test('initializes with random username when none in localStorage', () => {
    const wrapper = shallowMount(ChatLayout);

    // Verify localStorage was checked
    expect(localStorageMock.getItem).toHaveBeenCalledWith('nilo_username');

    // With mocked Math.random returning 0.5, username should be User_500
    expect(wrapper.vm.username).toBe('User_500');
    expect(wrapper.vm.isConnected).toBe(false);
  });

  test('initializes with username from localStorage if available', () => {
    // Set username in localStorage
    localStorageMock.setItem('nilo_username', 'SavedUser123');

    const wrapper = shallowMount(ChatLayout);

    // Verify localStorage was checked
    expect(localStorageMock.getItem).toHaveBeenCalledWith('nilo_username');

    // Username should be loaded from localStorage
    expect(wrapper.vm.username).toBe('SavedUser123');
  });

  test('passes data as props to child components', () => {
    const wrapper = shallowMount(ChatLayout, {
      data() {
        return {
          username: 'testuser',
          isConnected: false
        };
      }
    });

    // Verify component has the expected data
    expect(wrapper.vm.username).toBe('testuser');
    expect(wrapper.vm.isConnected).toBe(false);

    // Find the child components
    const mainSidebar = wrapper.findComponent({ name: 'MainSidebar' });
    const chatContent = wrapper.findComponent({ name: 'ChatContent' });

    // Verify they exist
    expect(mainSidebar.exists()).toBe(true);
    expect(chatContent.exists()).toBe(true);
  });

  test('responds to connection-change event from ChatContent', async () => {
    // Create wrapper with non-first-time user to avoid greeting logic
    localStorageMock.getItem.mockImplementation(key => {
      if (key === 'nilo_first_join') return 'true';
      return null;
    });

    const wrapper = shallowMount(ChatLayout);

    // Initial state
    expect(wrapper.vm.isConnected).toBe(false);

    // Find ChatContent and trigger the event
    const chatContent = wrapper.findComponent({ name: 'ChatContent' });
    chatContent.vm.$emit('connection-change', true);

    // Wait for Vue to process the event
    await wrapper.vm.$nextTick();

    // Check if the state was updated
    expect(wrapper.vm.isConnected).toBe(true);
  });

  test('responds to username-change event from ChatContent', async () => {
    const wrapper = shallowMount(ChatLayout);

    // Initial username (with mocked Math.random)
    expect(wrapper.vm.username).toBe('User_500');

    // Find ChatContent and trigger the event
    const chatContent = wrapper.findComponent({ name: 'ChatContent' });
    chatContent.vm.$emit('username-change', 'NewUsername');

    // Wait for Vue to process the event
    await wrapper.vm.$nextTick();

    // Check if the username was updated
    expect(wrapper.vm.username).toBe('NewUsername');

    // Check if username was saved to localStorage
    expect(localStorageMock.setItem).toHaveBeenCalledWith('nilo_username', 'NewUsername');
  });

  test('initializes with correct data properties', () => {
    const wrapper = shallowMount(ChatLayout);

    // Should have default values
    expect(wrapper.vm.username).toBeTruthy();
    expect(wrapper.vm.isConnected).toBe(false);
    expect(wrapper.vm.currentChannel).toBeTruthy();
    expect(wrapper.vm.channelUnreadCounts).toBeDefined();
    expect(wrapper.vm.isSignedIn).toBe(false);
  });

  test('initializes with isFirstJoin as true for first-time users', () => {
    // Mock localStorage for first-time user
    jest.spyOn(window.localStorage, 'getItem').mockImplementation((key) => {
      if (key === 'nilo_first_join') {
        return null; // First time user
      }
      return null;
    });

    const wrapper = shallowMount(ChatLayout);

    // First-time user should have isFirstJoin set to true
    expect(wrapper.vm.isFirstJoin).toBe(true);
  });

  test('initializes with isFirstJoin as false for returning users', () => {
    // Mock localStorage for returning user
    jest.spyOn(window.localStorage, 'getItem').mockImplementation((key) => {
      if (key === 'nilo_first_join') {
        return 'true'; // Returning user
      }
      return null;
    });

    const wrapper = shallowMount(ChatLayout);

    // Returning user should have isFirstJoin set to false
    expect(wrapper.vm.isFirstJoin).toBe(false);
  });

  test('changeChannel updates currentChannel and resets unread count', () => {
    const wrapper = shallowMount(ChatLayout);

    // Setup initial state
    wrapper.vm.channelUnreadCounts = {
      general: 0,
      feedback: 5
    };

    // Change to the feedback channel
    wrapper.vm.changeChannel('feedback');

    // Channel should be updated
    expect(wrapper.vm.currentChannel).toBe('feedback');
    // Unread count should be reset
    expect(wrapper.vm.channelUnreadCounts.feedback).toBe(0);
  });

  test('handleConnectionStatusChange updates isConnected', () => {
    const wrapper = shallowMount(ChatLayout);

    // Call the method with true
    wrapper.vm.handleConnectionStatusChange(true);

    // Should update isConnected
    expect(wrapper.vm.isConnected).toBe(true);

    // Call the method with false
    wrapper.vm.handleConnectionStatusChange(false);

    // Should update isConnected
    expect(wrapper.vm.isConnected).toBe(false);
  });

  test('handleUsernameChange updates username', () => {
    const wrapper = shallowMount(ChatLayout);

    // Call the method
    wrapper.vm.handleUsernameChange('NewUsername');

    // Should update username
    expect(wrapper.vm.username).toBe('NewUsername');
  });

  test('handleMessageReceived increments unread count for messages in other channels', () => {
    const wrapper = shallowMount(ChatLayout);

    // Set current channel to general
    wrapper.vm.currentChannel = 'general';

    // Setup initial state
    wrapper.vm.channelUnreadCounts = {
      general: 0,
      feedback: 0
    };

    // Simulate receiving a message from the feedback channel
    wrapper.vm.handleMessageReceived({
      username: 'user',
      message: 'Hello',
      channel: 'feedback'
    });

    // Should increment the unread count for feedback
    expect(wrapper.vm.channelUnreadCounts.feedback).toBe(1);

    // But not for the current channel
    expect(wrapper.vm.channelUnreadCounts.general).toBe(0);
  });

  // Clerk integration tests
  test('initClerk does nothing when window.Clerk is not available', async () => {
    delete window.Clerk;
    const wrapper = shallowMount(ChatLayout);

    await wrapper.vm.initClerk();

    expect(wrapper.vm.isSignedIn).toBe(false);
  });

  test('initClerk sets isSignedIn and username when Clerk user exists', async () => {
    window.Clerk = {
      load: jest.fn().mockResolvedValue(undefined),
      addListener: jest.fn(),
      user: {
        username: 'clerkuser',
        firstName: 'Test',
        emailAddresses: [{ emailAddress: 'test@example.com' }]
      }
    };

    const wrapper = shallowMount(ChatLayout);
    await wrapper.vm.initClerk();

    expect(window.Clerk.load).toHaveBeenCalled();
    expect(wrapper.vm.isSignedIn).toBe(true);
    expect(wrapper.vm.username).toBe('clerkuser');
    expect(window.Clerk.addListener).toHaveBeenCalled();
  });

  test('initClerk uses firstName when username is not available', async () => {
    window.Clerk = {
      load: jest.fn().mockResolvedValue(undefined),
      addListener: jest.fn(),
      user: {
        username: null,
        firstName: 'TestFirst',
        emailAddresses: [{ emailAddress: 'test@example.com' }]
      }
    };

    const wrapper = shallowMount(ChatLayout);
    await wrapper.vm.initClerk();

    expect(wrapper.vm.isSignedIn).toBe(true);
    expect(wrapper.vm.username).toBe('TestFirst');
  });

  test('initClerk uses email when username and firstName are not available', async () => {
    window.Clerk = {
      load: jest.fn().mockResolvedValue(undefined),
      addListener: jest.fn(),
      user: {
        username: null,
        firstName: null,
        emailAddresses: [{ emailAddress: 'test@example.com' }]
      }
    };

    const wrapper = shallowMount(ChatLayout);
    await wrapper.vm.initClerk();

    expect(wrapper.vm.isSignedIn).toBe(true);
    expect(wrapper.vm.username).toBe('test@example.com');
  });

  test('initClerk does not change username when Clerk user has no name info', async () => {
    window.Clerk = {
      load: jest.fn().mockResolvedValue(undefined),
      addListener: jest.fn(),
      user: {
        username: null,
        firstName: null,
        emailAddresses: []
      }
    };

    const wrapper = shallowMount(ChatLayout);
    const originalUsername = wrapper.vm.username;
    await wrapper.vm.initClerk();

    expect(wrapper.vm.isSignedIn).toBe(true);
    expect(wrapper.vm.username).toBe(originalUsername);
  });

  test('initClerk handles Clerk not having a user (not signed in)', async () => {
    window.Clerk = {
      load: jest.fn().mockResolvedValue(undefined),
      addListener: jest.fn(),
      user: null
    };

    const wrapper = shallowMount(ChatLayout);
    await wrapper.vm.initClerk();

    expect(wrapper.vm.isSignedIn).toBe(false);
  });

  test('Clerk listener resets state when user signs out', async () => {
    let listenerCallback;
    window.Clerk = {
      load: jest.fn().mockResolvedValue(undefined),
      addListener: jest.fn((cb) => { listenerCallback = cb; }),
      user: {
        username: 'clerkuser',
        firstName: 'Test',
        emailAddresses: [{ emailAddress: 'test@example.com' }]
      }
    };

    const wrapper = shallowMount(ChatLayout);
    await wrapper.vm.initClerk();

    expect(wrapper.vm.isSignedIn).toBe(true);

    // Simulate Clerk sign-out: user becomes null
    window.Clerk.user = null;
    listenerCallback();

    expect(wrapper.vm.isSignedIn).toBe(false);
  });

  test('Clerk listener does not reset state when user is still signed in', async () => {
    let listenerCallback;
    window.Clerk = {
      load: jest.fn().mockResolvedValue(undefined),
      addListener: jest.fn((cb) => { listenerCallback = cb; }),
      user: {
        username: 'clerkuser',
        firstName: 'Test',
        emailAddresses: [{ emailAddress: 'test@example.com' }]
      }
    };

    const wrapper = shallowMount(ChatLayout);
    await wrapper.vm.initClerk();

    // Listener fires but user still exists
    listenerCallback();

    expect(wrapper.vm.isSignedIn).toBe(true);
    expect(wrapper.vm.username).toBe('clerkuser');
  });

  test('initClerk handles Clerk.load() rejection gracefully', async () => {
    window.Clerk = {
      load: jest.fn().mockRejectedValue(new Error('Network error'))
    };

    const wrapper = shallowMount(ChatLayout);
    await wrapper.vm.initClerk();

    expect(wrapper.vm.isSignedIn).toBe(false);
  });

  test('handleSignIn does nothing when window.Clerk is not available', async () => {
    delete window.Clerk;
    const wrapper = shallowMount(ChatLayout);

    await wrapper.vm.handleSignIn();

    expect(wrapper.vm.isSignedIn).toBe(false);
  });

  test('handleSignIn opens Clerk sign-in and updates state when user signs in', async () => {
    window.Clerk = {
      loaded: true,
      load: jest.fn().mockResolvedValue(undefined),
      openSignIn: jest.fn().mockResolvedValue(undefined),
      user: null
    };

    const wrapper = shallowMount(ChatLayout);

    // After openSignIn, simulate user being set
    window.Clerk.openSignIn.mockImplementation(async () => {
      window.Clerk.user = {
        username: 'newuser',
        firstName: 'New',
        emailAddresses: [{ emailAddress: 'new@example.com' }]
      };
    });

    await wrapper.vm.handleSignIn();

    expect(window.Clerk.openSignIn).toHaveBeenCalledWith({
      fallbackRedirectUrl: window.location.href
    });
    expect(wrapper.vm.isSignedIn).toBe(true);
    expect(wrapper.vm.username).toBe('newuser');
  });

  test('handleSignIn loads Clerk if not already loaded', async () => {
    window.Clerk = {
      loaded: false,
      load: jest.fn().mockResolvedValue(undefined),
      openSignIn: jest.fn().mockResolvedValue(undefined),
      user: null
    };

    const wrapper = shallowMount(ChatLayout);
    await wrapper.vm.handleSignIn();

    expect(window.Clerk.load).toHaveBeenCalled();
    expect(window.Clerk.openSignIn).toHaveBeenCalled();
  });

  test('handleSignIn does not update state when user cancels sign-in', async () => {
    window.Clerk = {
      loaded: true,
      load: jest.fn().mockResolvedValue(undefined),
      openSignIn: jest.fn().mockResolvedValue(undefined),
      user: null
    };

    const wrapper = shallowMount(ChatLayout);
    await wrapper.vm.handleSignIn();

    expect(wrapper.vm.isSignedIn).toBe(false);
  });

  test('handleSignIn handles errors gracefully', async () => {
    window.Clerk = {
      loaded: true,
      load: jest.fn().mockResolvedValue(undefined),
      openSignIn: jest.fn().mockRejectedValue(new Error('Sign-in error'))
    };

    const wrapper = shallowMount(ChatLayout);
    await wrapper.vm.handleSignIn();

    expect(wrapper.vm.isSignedIn).toBe(false);
  });

  test('handleSignIn uses firstName when username not available', async () => {
    window.Clerk = {
      loaded: true,
      load: jest.fn().mockResolvedValue(undefined),
      openSignIn: jest.fn().mockImplementation(async () => {
        window.Clerk.user = {
          username: null,
          firstName: 'Jane',
          emailAddresses: [{ emailAddress: 'jane@example.com' }]
        };
      }),
      user: null
    };

    const wrapper = shallowMount(ChatLayout);
    await wrapper.vm.handleSignIn();

    expect(wrapper.vm.isSignedIn).toBe(true);
    expect(wrapper.vm.username).toBe('Jane');
  });

  // mountClerkUserButton tests
  test('mountClerkUserButton does nothing when window.Clerk is not available', () => {
    delete window.Clerk;
    const wrapper = shallowMount(ChatLayout);
    const el = document.createElement('div');

    wrapper.vm.mountClerkUserButton(el);

    // Should not throw
    expect(wrapper.vm.isSignedIn).toBe(false);
  });

  test('mountClerkUserButton does nothing when element is null', () => {
    window.Clerk = {
      mountUserButton: jest.fn()
    };
    const wrapper = shallowMount(ChatLayout);

    wrapper.vm.mountClerkUserButton(null);

    expect(window.Clerk.mountUserButton).not.toHaveBeenCalled();
  });

  test('mountClerkUserButton mounts Clerk UserButton on element', () => {
    window.Clerk = {
      mountUserButton: jest.fn()
    };
    const wrapper = shallowMount(ChatLayout);
    const el = document.createElement('div');

    wrapper.vm.mountClerkUserButton(el);

    expect(window.Clerk.mountUserButton).toHaveBeenCalledWith(el, {
      afterSignOutUrl: window.location.href,
      appearance: {
        elements: {
          userButtonBox: 'w-12 h-12',
          userButtonTrigger: 'w-12 h-12',
          userButtonAvatarBox: 'w-12 h-12 rounded-lg',
          avatarBox: 'w-12 h-12 rounded-lg'
        }
      }
    });
  });

  test('mountClerkUserButton handles errors gracefully', () => {
    window.Clerk = {
      mountUserButton: jest.fn(() => { throw new Error('Mount error'); })
    };
    const wrapper = shallowMount(ChatLayout);
    const el = document.createElement('div');

    wrapper.vm.mountClerkUserButton(el);

    // Should not throw
    expect(window.Clerk.mountUserButton).toHaveBeenCalled();
  });
});
