import { shallowMount } from '@vue/test-utils';
import ChatLayout from '../src/components/ChatLayout.vue';

// Mock child components
jest.mock('../src/components/ChannelSidebar.vue', () => ({
  name: 'ChannelSidebar',
  template: '<div>Channel Sidebar</div>'
}));

jest.mock('../src/components/DirectMessageSidebar.vue', () => ({
  name: 'DirectMessageSidebar',
  template: '<div>Direct Message Sidebar</div>',
  props: ['username', 'isConnected']
}));

jest.mock('../src/components/ChatContent.vue', () => ({
  name: 'ChatContent',
  template: '<div>Chat Content</div>',
  props: ['username'],
  emits: ['connection-change']
}));

describe('ChatLayout.vue', () => {
  // Mock Math.random to return a predictable value
  const originalMathRandom = Math.random;
  
  beforeEach(() => {
    // Mock Math.random to return 0.5
    Math.random = jest.fn().mockReturnValue(0.5);
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
    const channelSidebar = wrapper.findComponent({ name: 'ChannelSidebar' });
    expect(channelSidebar.exists()).toBe(true);
    
    const directMessageSidebar = wrapper.findComponent({ name: 'DirectMessageSidebar' });
    expect(directMessageSidebar.exists()).toBe(true);
    
    const chatContent = wrapper.findComponent({ name: 'ChatContent' });
    expect(chatContent.exists()).toBe(true);
  });
  
  test('initializes with correct data', () => {
    const wrapper = shallowMount(ChatLayout);
    
    // With mocked Math.random returning 0.5, username should be User_500
    expect(wrapper.vm.username).toBe('User_500');
    expect(wrapper.vm.isConnected).toBe(false);
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
    const directMessageSidebar = wrapper.findComponent({ name: 'DirectMessageSidebar' });
    const chatContent = wrapper.findComponent({ name: 'ChatContent' });
    
    // Verify they exist
    expect(directMessageSidebar.exists()).toBe(true);
    expect(chatContent.exists()).toBe(true);
  });
  
  test('updateConnectionStatus method updates isConnected', () => {
    const wrapper = shallowMount(ChatLayout);
    
    // Initial state
    expect(wrapper.vm.isConnected).toBe(false);
    
    // Call the method
    wrapper.vm.updateConnectionStatus(true);
    
    // Check if the state was updated
    expect(wrapper.vm.isConnected).toBe(true);
  });
  
  test('responds to connection-change event from ChatContent', async () => {
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
}); 