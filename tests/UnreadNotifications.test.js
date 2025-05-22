import { mount, flushPromises } from '@vue/test-utils';
import ChatLayout from '../src/components/ChatLayout.vue';
import ServerSidebar from '../src/components/ServerSidebar.vue';
import MainSidebar from '../src/components/MainSidebar.vue';

// Helper function to create a mock socket
const createMockSocket = () => {
  return {
    on: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
  };
};

// Mock child components for better control
jest.mock('../src/components/ServerSidebar.vue', () => ({
  name: 'ServerSidebar',
  template: '<div class="channel-sidebar"><slot></slot></div>',
  props: ['currentChannel', 'channelUnreadCounts'],
}));

jest.mock('../src/components/MainSidebar.vue', () => ({
  name: 'MainSidebar',
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
  beforeEach(() => {
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn().mockReturnValue(null),
        setItem: jest.fn()
      },
      writable: true
    });
  });
  
  test('channel unread counts increment correctly', () => {
    const wrapper = mount(ChatLayout);
    
    // Set current channel to general
    wrapper.vm.currentChannel = 'general';
    
    // Setup initial state with 0 unread messages
    wrapper.vm.channelUnreadCounts = {
      general: 0,
      feedback: 0
    };
    
    // Simulate receiving a message from the feedback channel
    wrapper.vm.handleMessageReceived({
      username: 'otheruser',
      message: 'Hello in feedback channel',
      channel: 'feedback'
    });
    
    // Another message in feedback
    wrapper.vm.handleMessageReceived({
      username: 'otheruser',
      message: 'Another message in feedback',
      channel: 'feedback'
    });
    
    // Should increment the unread count for feedback
    expect(wrapper.vm.channelUnreadCounts.feedback).toBe(2);
    
    // Receive a message in current channel
    wrapper.vm.handleMessageReceived({
      username: 'otheruser',
      message: 'Hello in general channel',
      channel: 'general'
    });
    
    // Current channel unread count should remain zero
    expect(wrapper.vm.channelUnreadCounts.general).toBe(0);
  });
  
  test('switching channels resets unread count', () => {
    const wrapper = mount(ChatLayout);
    
    // Set current channel to general
    wrapper.vm.currentChannel = 'general';
    
    // Setup initial state with some unread messages
    wrapper.vm.channelUnreadCounts = {
      general: 0,
      feedback: 5,
      'slack-feed': 2
    };
    
    // Change to feedback channel
    wrapper.vm.changeChannel('feedback');
    
    // Unread count for feedback should be reset
    expect(wrapper.vm.channelUnreadCounts.feedback).toBe(0);
    
    // Other unread counts should not change
    expect(wrapper.vm.channelUnreadCounts['slack-feed']).toBe(2);
  });
  
  test('unread notifications appear in the UI', async () => {
    // Use mount instead of shallowMount to render child components
    const wrapper = mount(ChatLayout);
    
    // Access channel sidebar component
    const serverSidebar = wrapper.findComponent(ServerSidebar);
    
    // Access DM sidebar component
    const mainSidebar = wrapper.findComponent(MainSidebar);
    
    // Set unread counts
    wrapper.vm.channelUnreadCounts = {
      general: 3,
      feedback: 2
    };
    
    // Pass the updated unread counts to children
    await wrapper.vm.$nextTick();
    
    // Verify they received the correct props
    expect(serverSidebar.props('channelUnreadCounts')).toEqual({
      general: 3,
      feedback: 2
    });
    expect(mainSidebar.props('channelUnreadCounts')).toEqual({
      general: 3,
      feedback: 2
    });
  });
}); 