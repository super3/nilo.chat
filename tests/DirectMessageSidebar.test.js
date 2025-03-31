import { shallowMount } from '@vue/test-utils';
import DirectMessageSidebar from '../src/components/DirectMessageSidebar.vue';

describe('DirectMessageSidebar.vue', () => {
  const defaultProps = {
    username: 'testuser',
    isConnected: false,
    steveUnreadCount: 0
  };

  test('renders correctly with required props', () => {
    const wrapper = shallowMount(DirectMessageSidebar, {
      propsData: defaultProps
    });
    
    // Check if component exists
    expect(wrapper.exists()).toBe(true);
    
    // Check if the root div has the expected classes
    const rootDiv = wrapper.find('div');
    expect(rootDiv.exists()).toBe(true);
    expect(rootDiv.classes()).toContain('bg-indigo-darker');
    expect(rootDiv.classes()).toContain('text-purple-lighter');
    
    // Check heading text
    const heading = wrapper.find('h1');
    expect(heading.exists()).toBe(true);
    expect(heading.text()).toBe('nilo.chat');
    
    // Check username is displayed somewhere in the component
    const html = wrapper.html();
    expect(html).toContain('testuser');
    
    // Check that we have at least one connection status indicator
    const indicators = wrapper.findAll('.rounded-full.block.w-2.h-2.mr-2');
    expect(indicators.length).toBeGreaterThan(0);
  });
  
  test('renders different elements based on isConnected prop', () => {
    // Test with isConnected = false
    const disconnectedWrapper = shallowMount(DirectMessageSidebar, {
      propsData: {
        ...defaultProps,
        isConnected: false
      }
    });
    
    // Test with isConnected = true
    const connectedWrapper = shallowMount(DirectMessageSidebar, {
      propsData: {
        ...defaultProps,
        isConnected: true
      }
    });
    
    // The HTML should be different when isConnected changes
    expect(disconnectedWrapper.html()).not.toEqual(connectedWrapper.html());
  });
  
  test('handles component props correctly', () => {
    const wrapper = shallowMount(DirectMessageSidebar, {
      propsData: defaultProps
    });
    
    // Check that props were passed correctly
    expect(wrapper.props().username).toBe('testuser');
    expect(wrapper.props().isConnected).toBe(false);
  });
  
  test('displays steve in the direct messages list', () => {
    const wrapper = shallowMount(DirectMessageSidebar, {
      propsData: defaultProps
    });
    
    // Check if steve appears in the HTML
    const html = wrapper.html();
    expect(html).toContain('steve');
  });
  
  test('toggleChannels method toggles showChannels state', async () => {
    const wrapper = shallowMount(DirectMessageSidebar, {
      propsData: defaultProps
    });
    
    // Initial state should be true
    expect(wrapper.vm.showChannels).toBe(true);
    
    // Call the toggle method
    await wrapper.vm.toggleChannels();
    
    // State should be toggled
    expect(wrapper.vm.showChannels).toBe(false);
    
    // Call again to toggle back
    await wrapper.vm.toggleChannels();
    
    // State should be toggled back
    expect(wrapper.vm.showChannels).toBe(true);
  });
  
  test('toggleDirectMessages method toggles showDirectMessages state', async () => {
    const wrapper = shallowMount(DirectMessageSidebar, {
      propsData: defaultProps
    });
    
    // Initial state should be true
    expect(wrapper.vm.showDirectMessages).toBe(true);
    
    // Call the toggle method
    await wrapper.vm.toggleDirectMessages();
    
    // State should be toggled
    expect(wrapper.vm.showDirectMessages).toBe(false);
    
    // Call again to toggle back
    await wrapper.vm.toggleDirectMessages();
    
    // State should be toggled back
    expect(wrapper.vm.showDirectMessages).toBe(true);
  });
  
  test('renders only the selected channel when showChannels is false', async () => {
    const wrapper = shallowMount(DirectMessageSidebar, {
      propsData: {
        ...defaultProps,
        currentChannel: 'general'
      }
    });
    
    // Initially, both channels should be visible
    expect(wrapper.html()).toContain('<span>general</span>');
    expect(wrapper.html()).toContain('<span>feedback</span>');
    
    // Toggle showChannels to false
    await wrapper.setData({ showChannels: false });
    
    // Now only the selected channel (general) should be visible
    expect(wrapper.html()).toContain('<span>general</span>');
    expect(wrapper.html()).not.toContain('<span>feedback</span>');
    
    // Change the selected channel to 'feedback'
    await wrapper.setProps({ currentChannel: 'feedback' });
    
    // Now only feedback should be visible
    expect(wrapper.html()).not.toContain('<span>general</span>');
    expect(wrapper.html()).toContain('<span>feedback</span>');
  });
  
  test('does not render direct messages when showDirectMessages is false', async () => {
    const wrapper = shallowMount(DirectMessageSidebar, {
      propsData: defaultProps
    });
    
    // Initially, we should see the "steve" text in the component
    expect(wrapper.html()).toContain('steve');
    
    // Toggle showDirectMessages to false
    await wrapper.setData({ showDirectMessages: false });
    
    // Now we shouldn't see the "steve" text
    expect(wrapper.html()).not.toContain('steve');
  });
  
  test('renders only selected channel and no direct messages when both toggles are false', async () => {
    const wrapper = shallowMount(DirectMessageSidebar, {
      propsData: {
        ...defaultProps,
        currentChannel: 'general'
      }
    });
    
    // Set both toggles to false
    await wrapper.setData({ 
      showChannels: false,
      showDirectMessages: false 
    });
    
    // Should only show the selected channel (general)
    expect(wrapper.html()).toContain('<span>general</span>');
    expect(wrapper.html()).not.toContain('<span>feedback</span>');
    
    // Should not show steve
    expect(wrapper.html()).not.toContain('steve');
  });
  
  test('connection status indicator changes with isConnected prop', async () => {
    // Test with disconnected state
    const disconnectedWrapper = shallowMount(DirectMessageSidebar, {
      propsData: {
        ...defaultProps,
        isConnected: false
      }
    });
    
    // Should have a border class for disconnected
    const disconnectedIndicator = disconnectedWrapper.find('.rounded-full.block.w-2.h-2.mr-2');
    expect(disconnectedIndicator.classes()).toContain('border');
    expect(disconnectedIndicator.classes()).toContain('border-white');
    
    // Test with connected state
    const connectedWrapper = shallowMount(DirectMessageSidebar, {
      propsData: {
        ...defaultProps,
        isConnected: true
      }
    });
    
    // Should have bg-green-500 class for connected
    const connectedIndicator = connectedWrapper.find('.rounded-full.block.w-2.h-2.mr-2');
    expect(connectedIndicator.classes()).toContain('bg-green-500');
  });
  
  test('click events on toggle indicators and section titles work correctly', async () => {
    const wrapper = shallowMount(DirectMessageSidebar, {
      propsData: defaultProps
    });
    
    // Verify initial state
    expect(wrapper.vm.showChannels).toBe(true);
    expect(wrapper.vm.showDirectMessages).toBe(true);
    
    // Find and click the channels toggle icon
    const channelsToggle = wrapper.find('div.cursor-pointer.w-4.mr-2.flex.justify-center');
    await channelsToggle.trigger('click');
    
    // Verify the state changed
    expect(wrapper.vm.showChannels).toBe(false);
    
    // Click on the Channels title text to toggle it back
    const channelsTitle = wrapper.findAll('div.opacity-75.flex-1.cursor-pointer').at(0);
    await channelsTitle.trigger('click');
    
    // Verify the state changed back
    expect(wrapper.vm.showChannels).toBe(true);
    
    // Find the direct messages title and click it
    const dmTitle = wrapper.findAll('div.opacity-75.flex-1.cursor-pointer').at(1);
    await dmTitle.trigger('click');
    
    // Verify the state changed
    expect(wrapper.vm.showDirectMessages).toBe(false);
    
    // Find and click the direct messages toggle icon (second toggle in the component) to toggle it back
    const dmToggles = wrapper.findAll('div.cursor-pointer.w-4.mr-2.flex.justify-center');
    expect(dmToggles.length).toBeGreaterThan(1);
    
    await dmToggles[1].trigger('click');
    
    // Verify the state changed back
    expect(wrapper.vm.showDirectMessages).toBe(true);
  });
  
  test('renders all icon states correctly', async () => {
    const wrapper = shallowMount(DirectMessageSidebar, {
      propsData: defaultProps
    });
    
    // Initially both showChannels and showDirectMessages are true
    // Should show the down arrow icons
    let downArrows = wrapper.findAll('svg path[d^="M9.293 12.95l.707.707L15.657"]');
    expect(downArrows.length).toBe(2);
    
    // Set showChannels to false, should show right arrow for channels
    await wrapper.setData({ showChannels: false });
    let rightArrow = wrapper.find('svg path[d^="M7.293 14.707a1 1 0 010-1.414L10.586"]');
    expect(rightArrow.exists()).toBe(true);
    
    // Set showDirectMessages to false too
    await wrapper.setData({ showDirectMessages: false });
    let rightArrows = wrapper.findAll('svg path[d^="M7.293 14.707a1 1 0 010-1.414L10.586"]');
    expect(rightArrows.length).toBe(2);
  });
  
  test('switchChannel method emits channel-change event', async () => {
    const wrapper = shallowMount(DirectMessageSidebar, {
      propsData: {
        ...defaultProps,
        currentChannel: 'general'
      }
    });
    
    // Call the method with a different channel
    wrapper.vm.switchChannel('feedback');
    
    // Check that the event was emitted with the correct value
    expect(wrapper.emitted('channel-change')).toBeTruthy();
    expect(wrapper.emitted('channel-change')[0]).toEqual(['feedback']);
  });
  
  test('switchChannel method does not emit for same channel', async () => {
    const wrapper = shallowMount(DirectMessageSidebar, {
      propsData: {
        ...defaultProps,
        currentChannel: 'feedback'
      }
    });
    
    // Call the method with the same channel
    wrapper.vm.switchChannel('feedback');
    
    // Should not emit anything
    expect(wrapper.emitted('channel-change')).toBeFalsy();
  });
  
  test('channel selection highlights the active channel', async () => {
    const wrapper = shallowMount(DirectMessageSidebar, {
      propsData: {
        ...defaultProps,
        currentChannel: 'general'
      }
    });
    
    // Find the channel items
    const channelItems = wrapper.findAll('.px-4.py-1.text-white.flex.items-center.cursor-pointer');
    expect(channelItems.length).toBeGreaterThanOrEqual(2);
    
    // The first one (general) should have the active class
    expect(channelItems[0].classes()).toContain('bg-teal-dark');
    
    // The second one (feedback) should not have the active class
    expect(channelItems[1].classes()).not.toContain('bg-teal-dark');
    
    // Change the current channel
    await wrapper.setProps({ currentChannel: 'feedback' });
    
    // Now the second one should have the active class
    expect(channelItems[1].classes()).toContain('bg-teal-dark');
    
    // And the first one should not
    expect(channelItems[0].classes()).not.toContain('bg-teal-dark');
  });
  
  test('channel items trigger switchChannel when clicked', async () => {
    const wrapper = shallowMount(DirectMessageSidebar, {
      propsData: {
        ...defaultProps,
        currentChannel: 'general'
      }
    });
    
    // Spy on the switchChannel method
    const switchChannelSpy = jest.spyOn(wrapper.vm, 'switchChannel');
    
    // Find the channel items
    const channelItems = wrapper.findAll('.px-4.py-1.text-white.flex.items-center.cursor-pointer');
    expect(channelItems.length).toBeGreaterThanOrEqual(2);
    
    // Click the second channel (feedback)
    await channelItems[1].trigger('click');
    
    // Check if switchChannel was called with 'feedback'
    expect(switchChannelSpy).toHaveBeenCalledWith('feedback');
    
    // Restore the spy
    switchChannelSpy.mockRestore();
  });
  
  test('displays notification badge when steveUnreadCount is greater than 0', async () => {
    // First render with steveUnreadCount = 0
    const wrapper = shallowMount(DirectMessageSidebar, {
      propsData: defaultProps
    });
    
    // Should not show notification badge
    expect(wrapper.find('.bg-red-500').exists()).toBe(false);
    
    // Update the prop to show unread messages
    await wrapper.setProps({ steveUnreadCount: 1 });
    
    // Should now show the notification badge
    expect(wrapper.find('.bg-red-500').exists()).toBe(true);
    expect(wrapper.find('.bg-red-500').text()).toBe('1');
    
    // Update to a different count
    await wrapper.setProps({ steveUnreadCount: 3 });
    
    // Badge should update
    expect(wrapper.find('.bg-red-500').text()).toBe('3');
  });
  
  test('steve direct message item triggers channel change event when clicked', async () => {
    const wrapper = shallowMount(DirectMessageSidebar, {
      propsData: defaultProps
    });
    
    // Spy on the switchChannel method
    const switchChannelSpy = jest.spyOn(wrapper.vm, 'switchChannel');
    
    // Find all DM items
    const dmItems = wrapper.findAll('.px-4.py-1.flex.items-center.mb-2.cursor-pointer');
    
    // Find the specific item containing "steve"
    let steveItem = null;
    for (let i = 0; i < dmItems.length; i++) {
      if (dmItems.at(i).text().includes('steve')) {
        steveItem = dmItems.at(i);
        break;
      }
    }
    
    expect(steveItem).not.toBeNull();
    
    // Click on steve's DM
    await steveItem.trigger('click');
    
    // Check if switchChannel was called with 'dm_steve'
    expect(switchChannelSpy).toHaveBeenCalledWith('dm_steve');
    
    // Verify the event was emitted
    expect(wrapper.emitted('channel-change')).toBeTruthy();
    expect(wrapper.emitted('channel-change')[0]).toEqual(['dm_steve']);
    
    // Restore the spy
    switchChannelSpy.mockRestore();
  });
  
  test('highlights active dm_steve channel correctly', async () => {
    const wrapper = shallowMount(DirectMessageSidebar, {
      propsData: {
        ...defaultProps,
        currentChannel: 'dm_steve'
      }
    });
    
    // Find all DM items
    const dmItems = wrapper.findAll('.px-4.py-1.flex.items-center.mb-2.cursor-pointer');
    
    // Find the specific item containing "steve"
    let steveItem = null;
    for (let i = 0; i < dmItems.length; i++) {
      if (dmItems.at(i).text().includes('steve')) {
        steveItem = dmItems.at(i);
        break;
      }
    }
    
    expect(steveItem).not.toBeNull();
    
    // Check if it has the active class
    expect(steveItem.classes()).toContain('bg-teal-dark');
    
    // Change to different channel
    await wrapper.setProps({ currentChannel: 'general' });
    
    // Now it should not have the active class
    expect(steveItem.classes()).not.toContain('bg-teal-dark');
  });
  
  test('user direct message item triggers channel change event when clicked', async () => {
    const wrapper = shallowMount(DirectMessageSidebar, {
      propsData: defaultProps
    });
    
    // Spy on the switchChannel method
    const switchChannelSpy = jest.spyOn(wrapper.vm, 'switchChannel');
    
    // Find the user's own DM item (first in the list)
    const userItems = wrapper.findAll('.px-4.py-1.flex.items-center.mb-2.cursor-pointer');
    const userItem = userItems.at(0);
    expect(userItem.exists()).toBe(true);
    expect(userItem.html()).toContain('testuser');
    
    // Click on the user's DM
    await userItem.trigger('click');
    
    // Check if switchChannel was called with 'dm_self'
    expect(switchChannelSpy).toHaveBeenCalledWith('dm_self');
    
    // Verify the event was emitted
    expect(wrapper.emitted('channel-change')).toBeTruthy();
    expect(wrapper.emitted('channel-change')[0]).toEqual(['dm_self']);
    
    // Restore the spy
    switchChannelSpy.mockRestore();
  });
  
  test('highlights active dm_self channel correctly', async () => {
    const wrapper = shallowMount(DirectMessageSidebar, {
      propsData: {
        ...defaultProps,
        currentChannel: 'dm_self'
      }
    });
    
    // Find the user's own DM item
    const userItems = wrapper.findAll('.px-4.py-1.flex.items-center.mb-2.cursor-pointer');
    const userItem = userItems.at(0);
    expect(userItem.exists()).toBe(true);
    
    // Check if it has the active class
    expect(userItem.classes()).toContain('bg-teal-dark');
    
    // Change to different channel
    await wrapper.setProps({ currentChannel: 'general' });
    
    // Now it should not have the active class
    expect(userItem.classes()).not.toContain('bg-teal-dark');
  });
}); 