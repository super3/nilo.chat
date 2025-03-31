import { mount, flushPromises } from '@vue/test-utils';
import ChatLayout from '../src/components/ChatLayout.vue';

// Helper function to create a mock socket
const createMockSocket = () => {
  return {
    on: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
  };
};

// Mock child components for better control
jest.mock('../src/components/ChannelSidebar.vue', () => ({
  name: 'ChannelSidebar',
  template: '<div class="channel-sidebar"><slot></slot></div>',
  props: ['currentChannel', 'channelUnreadCounts'],
}));

jest.mock('../src/components/DirectMessageSidebar.vue', () => ({
  name: 'DirectMessageSidebar',
  template: '<div class="dm-sidebar"><slot></slot></div>',
  props: ['username', 'isConnected', 'currentChannel', 'steveUnreadCount', 'channelUnreadCounts'],
}));

jest.mock('../src/components/ChatContent.vue', () => ({
  name: 'ChatContent',
  template: '<div class="chat-content"><slot></slot></div>',
  props: ['username', 'currentChannel'],
  methods: {
    switchChannel: jest.fn(),
  },
}));

describe('Unread Notifications Feature', () => {
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
  
  test('unread count increments when receiving message in another channel', async () => {
    // Create wrapper with mocked socket
    const wrapper = mount(ChatLayout);
    
    // Set initial channel to 'general'
    wrapper.vm.currentChannel = 'general';
    
    // Initial unread counts should be 0
    expect(wrapper.vm.channelUnreadCounts.feedback).toBe(0);
    
    // Simulate receiving a message in the 'feedback' channel
    wrapper.vm.handleMessageReceived({
      timestamp: new Date().toISOString(),
      username: 'otheruser',
      message: 'Hello in feedback channel',
      channel: 'feedback'
    });
    
    // The unread count for feedback should increment
    expect(wrapper.vm.channelUnreadCounts.feedback).toBe(1);
    
    // Simulate receiving another message
    wrapper.vm.handleMessageReceived({
      timestamp: new Date().toISOString(),
      username: 'otheruser',
      message: 'Another message in feedback',
      channel: 'feedback'
    });
    
    // The unread count should increment again
    expect(wrapper.vm.channelUnreadCounts.feedback).toBe(2);
    
    // Simulate receiving a message in the current channel
    wrapper.vm.handleMessageReceived({
      timestamp: new Date().toISOString(),
      username: 'otheruser',
      message: 'Hello in general channel',
      channel: 'general'
    });
    
    // The unread count for the current channel should remain 0
    expect(wrapper.vm.channelUnreadCounts.general).toBe(0);
  });
  
  test('unread count resets when switching to channel', async () => {
    // Create wrapper
    const wrapper = mount(ChatLayout);
    
    // Set initial channel to 'general'
    wrapper.vm.currentChannel = 'general';
    
    // Set some unread counts
    wrapper.vm.channelUnreadCounts.feedback = 3;
    
    // Verify initial state
    expect(wrapper.vm.channelUnreadCounts.feedback).toBe(3);
    
    // Switch to the feedback channel
    wrapper.vm.changeChannel('feedback');
    
    // Wait for Vue to update
    await wrapper.vm.$nextTick();
    
    // The unread count for feedback should be reset
    expect(wrapper.vm.channelUnreadCounts.feedback).toBe(0);
    
    // The current channel should be updated
    expect(wrapper.vm.currentChannel).toBe('feedback');
  });
  
  test('DM unread counts increment correctly', async () => {
    // Create wrapper
    const wrapper = mount(ChatLayout);
    
    // Set initial channel to 'general'
    wrapper.vm.currentChannel = 'general';
    
    // Initial steve unread count should be 0 (returning user)
    expect(wrapper.vm.steveUnreadCount).toBe(0);
    
    // Simulate receiving a message from steve
    wrapper.vm.handleMessageReceived({
      timestamp: new Date().toISOString(),
      username: 'steve',
      message: 'Hello!',
      channel: 'dm_steve'
    });
    
    // The steve unread count should increment
    expect(wrapper.vm.steveUnreadCount).toBe(1);
    
    // The dm_steve channel unread count should also increment
    expect(wrapper.vm.channelUnreadCounts.dm_steve).toBe(1);
    
    // Switch to the steve DM channel
    wrapper.vm.changeChannel('dm_steve');
    
    // Wait for Vue to update
    await wrapper.vm.$nextTick();
    
    // Both unread counts should be reset
    expect(wrapper.vm.steveUnreadCount).toBe(0);
    expect(wrapper.vm.channelUnreadCounts.dm_steve).toBe(0);
  });
  
  test('unread notifications appear in the UI', async () => {
    // This test would normally check if the UI actually shows the notification badges
    // but since we're using mocked components, we'll just verify the props are passed correctly
    
    const wrapper = mount(ChatLayout);
    
    // Set initial channel to 'general'
    wrapper.vm.currentChannel = 'general';
    
    // Set some unread counts
    wrapper.vm.channelUnreadCounts.feedback = 3;
    wrapper.vm.channelUnreadCounts.dm_steve = 2;
    wrapper.vm.steveUnreadCount = 2;
    
    // Wait for Vue to update
    await wrapper.vm.$nextTick();
    
    // Check that the ChannelSidebar receives the correct channelUnreadCounts prop
    const channelSidebar = wrapper.findComponent({ name: 'ChannelSidebar' });
    expect(channelSidebar.props('channelUnreadCounts')).toEqual({
      general: 0,
      feedback: 3,
      dm_self: 0,
      dm_steve: 2
    });
    
    // Check that the DirectMessageSidebar receives the correct props
    const dmSidebar = wrapper.findComponent({ name: 'DirectMessageSidebar' });
    expect(dmSidebar.props('channelUnreadCounts')).toEqual({
      general: 0,
      feedback: 3,
      dm_self: 0,
      dm_steve: 2
    });
    expect(dmSidebar.props('steveUnreadCount')).toBe(2);
  });
}); 