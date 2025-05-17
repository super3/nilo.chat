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

  test('toggle functions change visibility flags', async () => {
    const wrapper = shallowMount(MainSidebar, {
      propsData: {
        username: 'testuser',
        isConnected: true,
        currentChannel: 'general'
      }
    });

    expect(wrapper.vm.showChannels).toBe(true);
    wrapper.vm.toggleChannels();
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.showChannels).toBe(false);

    expect(wrapper.vm.showDirectMessages).toBe(true);
    wrapper.vm.toggleDirectMessages();
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.showDirectMessages).toBe(false);
  });

  test('collapsed channels show only active channel', async () => {
    const wrapper = shallowMount(MainSidebar, {
      propsData: {
        username: 'testuser',
        isConnected: true,
        currentChannel: 'feedback'
      }
    });
    wrapper.vm.showChannels = false;
    await wrapper.vm.$nextTick();
    const channelItems = wrapper.findAll('.bg-teal-dark');
    expect(channelItems).toHaveLength(1);
    expect(channelItems.at(0).text()).toContain('feedback');
  });

  test('collapsed direct messages show only active DM', async () => {
    const wrapper = shallowMount(MainSidebar, {
      propsData: {
        username: 'testuser',
        isConnected: true,
        currentChannel: 'dm_self'
      }
    });
    wrapper.vm.showDirectMessages = false;
    await wrapper.vm.$nextTick();
    const dmCollapsed = wrapper.find('[data-testid="dm-self-collapsed"]');
    expect(dmCollapsed.exists()).toBe(true);
    expect(dmCollapsed.text()).toContain('testuser');
  });

  test('switchChannel emits event only when channel changes', () => {
    const wrapper = shallowMount(MainSidebar, {
      propsData: {
        username: 'testuser',
        isConnected: true,
        currentChannel: 'general'
      }
    });

    wrapper.vm.switchChannel('general');
    expect(wrapper.emitted('channel-change')).toBeUndefined();

    wrapper.vm.switchChannel('feedback');
    expect(wrapper.emitted('channel-change')[0]).toEqual(['feedback']);
  });

  test('getUnreadCount returns values and logs output', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const wrapper = shallowMount(MainSidebar, {
      propsData: {
        username: 'testuser',
        isConnected: true,
        currentChannel: 'general',
        channelUnreadCounts: {
          general: 2
        }
      }
    });

    expect(wrapper.vm.getUnreadCount('general')).toBe(2);
    expect(wrapper.vm.getUnreadCount('missing')).toBe(0);
    expect(logSpy).toHaveBeenCalledWith('Getting unread count for general: 2');
    expect(logSpy).toHaveBeenCalledWith('Getting unread count for missing: 0');
    logSpy.mockRestore();
  });
})

