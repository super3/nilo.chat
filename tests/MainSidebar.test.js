import { shallowMount } from '@vue/test-utils';
import MainSidebar from '../src/components/MainSidebar.vue';

describe('MainSidebar.vue', () => {
  // Add a test to check that the component renders correctly
  test('renders correctly', () => {
    const wrapper = shallowMount(MainSidebar, {
      propsData: {
        username: 'testuser',
        isConnected: true,
        currentChannel: 'general',
        channelUnreadCounts: {
          general: 0,
          feedback: 0,
          'slack-feed': 0,
          dm_self: 0
        }
      }
    });
    
    expect(wrapper.exists()).toBe(true);
    
    // Check that the component's name matches
    expect(wrapper.vm.$options.name).toBe('MainSidebar');
    
    // Check that the header displays the username
    expect(wrapper.find('.text-white\\/50').text()).toBe('testuser');
    
    // Check that the channels section exists
    expect(wrapper.text()).toContain('Channels');
    
    // Check that the direct messages section exists
    expect(wrapper.text()).toContain('Direct Messages');
  });
  
  // Test connection status indicator
  test('shows correct connection status indicator', () => {
    // Test disconnected state
    const disconnectedWrapper = shallowMount(MainSidebar, {
      propsData: {
        username: 'testuser',
        isConnected: false,
        currentChannel: 'general'
      }
    });
    
    // Test connected state
    const connectedWrapper = shallowMount(MainSidebar, {
      propsData: {
        username: 'testuser',
        isConnected: true,
        currentChannel: 'general'
      }
    });
    
    // Check for different class states
    expect(disconnectedWrapper.find('.w-2.h-2.mr-2').classes()).toContain('border');
    expect(connectedWrapper.find('.w-2.h-2.mr-2').classes()).toContain('bg-green-500');
  });
}) 