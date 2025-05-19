import { mount, flushPromises } from '@vue/test-utils';
import ChatLayout from '../client/src/components/ChatLayout.vue';

// Mock child components for better control
jest.mock('../client/src/components/ServerSidebar.vue', () => ({
  name: 'ServerSidebar',
  template: '<div class="channel-sidebar" data-testid="channel-sidebar"><slot></slot></div>',
  props: ['currentChannel', 'channelUnreadCounts'],
}));

jest.mock('../client/src/components/MainSidebar.vue', () => ({
  name: 'MainSidebar',
  template: '<div class="dm-sidebar" data-testid="dm-sidebar"><slot></slot></div>',
  props: ['username', 'isConnected', 'currentChannel', 'steveUnreadCount', 'channelUnreadCounts'],
}));

jest.mock('../client/src/components/ChatContent.vue', () => ({
  name: 'ChatContent',
  template: '<div class="chat-content" data-testid="chat-content"><slot></slot></div>',
  props: ['username', 'currentChannel'],
  methods: {
    switchChannel: jest.fn(),
  },
}));

describe('Channel Notifications', () => {
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
    // Setup localStorage mock
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock
    });
    // Clear localStorage before each test
    localStorageMock.clear();
    
    // Set up localStorage for a returning user
    localStorageMock.setItem('nilo_first_join', 'true');
    localStorageMock.setItem('nilo_username', 'testuser');
    localStorageMock.setItem('nilo_channel', 'general');
  });
  
  test('switching between general and feedback updates unread counts correctly', async () => {
    // Create wrapper
    const wrapper = mount(ChatLayout);
    
    // Set initial channel to 'general'
    wrapper.vm.currentChannel = 'general';
    
    // Verify initial state
    expect(wrapper.vm.channelUnreadCounts.general).toBe(0);
    expect(wrapper.vm.channelUnreadCounts.feedback).toBe(0);
    
    // Simulate receiving a message in the 'feedback' channel while in 'general'
    wrapper.vm.handleMessageReceived({
      timestamp: new Date().toISOString(),
      username: 'otheruser',
      message: 'New feedback message',
      channel: 'feedback'
    });
    
    // The unread count for feedback should increment, general should remain 0
    expect(wrapper.vm.channelUnreadCounts.feedback).toBe(1);
    expect(wrapper.vm.channelUnreadCounts.general).toBe(0);
    
    // Switch to feedback channel
    wrapper.vm.changeChannel('feedback');
    await wrapper.vm.$nextTick();
    
    // Feedback unread count should be reset, channel should be updated
    expect(wrapper.vm.channelUnreadCounts.feedback).toBe(0);
    expect(wrapper.vm.currentChannel).toBe('feedback');
    
    // Simulate receiving a message in 'general' channel while in 'feedback'
    wrapper.vm.handleMessageReceived({
      timestamp: new Date().toISOString(),
      username: 'otheruser',
      message: 'New general message',
      channel: 'general'
    });
    
    // The unread count for general should increment, feedback should remain 0
    expect(wrapper.vm.channelUnreadCounts.general).toBe(1);
    expect(wrapper.vm.channelUnreadCounts.feedback).toBe(0);
    
    // Switch back to general channel
    wrapper.vm.changeChannel('general');
    await wrapper.vm.$nextTick();
    
    // General unread count should be reset
    expect(wrapper.vm.channelUnreadCounts.general).toBe(0);
    expect(wrapper.vm.currentChannel).toBe('general');
  });
  
  test('multiple unread messages are counted correctly in each channel', async () => {
    // Create wrapper
    const wrapper = mount(ChatLayout);
    
    // Set initial channel to 'general'
    wrapper.vm.currentChannel = 'general';
    
    // Simulate receiving multiple messages in the 'feedback' channel
    for (let i = 0; i < 5; i++) {
      wrapper.vm.handleMessageReceived({
        timestamp: new Date().toISOString(),
        username: 'user' + i,
        message: `Feedback message ${i}`,
        channel: 'feedback'
      });
    }
    
    // The unread count for feedback should be 5
    expect(wrapper.vm.channelUnreadCounts.feedback).toBe(5);
    
    // Switch to feedback channel to reset count
    wrapper.vm.changeChannel('feedback');
    await wrapper.vm.$nextTick();
    
    // Unread count should be reset
    expect(wrapper.vm.channelUnreadCounts.feedback).toBe(0);
    
    // Simulate receiving multiple messages in the 'general' channel while in 'feedback'
    for (let i = 0; i < 3; i++) {
      wrapper.vm.handleMessageReceived({
        timestamp: new Date().toISOString(),
        username: 'user' + i,
        message: `General message ${i}`,
        channel: 'general'
      });
    }
    
    // The unread count for general should be 3
    expect(wrapper.vm.channelUnreadCounts.general).toBe(3);
  });
  
  test('messages without channel property default to current channel', async () => {
    // Create wrapper
    const wrapper = mount(ChatLayout);
    
    // Set initial channel to 'general'
    wrapper.vm.currentChannel = 'general';
    
    // Simulate receiving a message without channel property
    wrapper.vm.handleMessageReceived({
      timestamp: new Date().toISOString(),
      username: 'otheruser',
      message: 'Message with no channel specified'
      // No channel property
    });
    
    // No unread counts should change because message is assumed to be for current channel
    expect(wrapper.vm.channelUnreadCounts.general).toBe(0);
    expect(wrapper.vm.channelUnreadCounts.feedback).toBe(0);
    
    // Switch to feedback channel
    wrapper.vm.changeChannel('feedback');
    await wrapper.vm.$nextTick();
    
    // Simulate receiving message without channel property while in feedback
    wrapper.vm.handleMessageReceived({
      timestamp: new Date().toISOString(),
      username: 'otheruser',
      message: 'Another message with no channel'
      // No channel property
    });
    
    // No unread counts should change
    expect(wrapper.vm.channelUnreadCounts.general).toBe(0);
    expect(wrapper.vm.channelUnreadCounts.feedback).toBe(0);
  });
  
  test('component props are updated correctly when channel unread counts change', async () => {
    // Create wrapper
    const wrapper = mount(ChatLayout);
    
    // Set initial channel to 'general'
    wrapper.vm.currentChannel = 'general';
    
    // Simulate receiving messages in both channels
    wrapper.vm.handleMessageReceived({
      timestamp: new Date().toISOString(),
      username: 'otheruser',
      message: 'Message in feedback channel',
      channel: 'feedback'
    });
    
    wrapper.vm.handleMessageReceived({
      timestamp: new Date().toISOString(),
      username: 'otheruser',
      message: 'Another message in feedback',
      channel: 'feedback'
    });
    
    // Wait for Vue to update
    await wrapper.vm.$nextTick();
    
    // Check that the ServerSidebar received the updated counts
    const serverSidebar = wrapper.findComponent({ name: 'ServerSidebar' });
    expect(serverSidebar.props('channelUnreadCounts').feedback).toBe(2);
    
    // Check that the MainSidebar also received the updated counts
    const dmSidebar = wrapper.findComponent({ name: 'MainSidebar' });
    expect(dmSidebar.props('channelUnreadCounts').feedback).toBe(2);
    
    // Switch to feedback channel
    wrapper.vm.changeChannel('feedback');
    await wrapper.vm.$nextTick();
    
    // Simulate message in general channel
    wrapper.vm.handleMessageReceived({
      timestamp: new Date().toISOString(),
      username: 'otheruser',
      message: 'Message in general channel',
      channel: 'general'
    });
    
    // Wait for Vue to update
    await wrapper.vm.$nextTick();
    
    // Check that both components received the updated counts
    expect(serverSidebar.props('channelUnreadCounts').general).toBe(1);
    expect(dmSidebar.props('channelUnreadCounts').general).toBe(1);
  });
}); 