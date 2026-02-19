import { shallowMount } from '@vue/test-utils';
import ServerSidebar from '../src/components/ServerSidebar.vue';

describe('ServerSidebar.vue', () => {
  test('renders correctly', () => {
    const wrapper = shallowMount(ServerSidebar);
    
    // Check if component exists
    expect(wrapper.exists()).toBe(true);
    
    // Check if it has the expected root div with correct classes
    const rootDiv = wrapper.find('div');
    expect(rootDiv.exists()).toBe(true);
    expect(rootDiv.classes()).toContain('bg-indigo-darkest');
    expect(rootDiv.classes()).toContain('text-purple-lighter');
    expect(rootDiv.classes()).toContain('flex-none');
    expect(rootDiv.classes()).toContain('w-24');
    
    // Check logo area
    const logoDiv = wrapper.find('.cursor-pointer.mb-4');
    expect(logoDiv.exists()).toBe(true);
    
    const logoContent = logoDiv.find('.bg-indigo-lighter');
    expect(logoContent.exists()).toBe(true);
    expect(logoContent.text()).toBe('N');
    
    // Check GitHub link
    const githubLink = wrapper.find('a[href="https://github.com/super3/nilo.chat"]');
    expect(githubLink.exists()).toBe(true);
    expect(githubLink.attributes('target')).toBe('_blank');
    
    // Check SVG icon is present
    const svgIcon = githubLink.find('svg');
    expect(svgIcon.exists()).toBe(true);
  });

  test('shows unread badge only when there are unread messages', () => {
    const wrapper = shallowMount(ServerSidebar, {
      propsData: {
        channelUnreadCounts: { general: 2 }
      }
    });

    const badge = wrapper.find('span.bg-red-600');
    expect(badge.exists()).toBe(true);
    expect(badge.text()).toBe('2');

    wrapper.setProps({ channelUnreadCounts: { general: 0 } });

    return wrapper.vm.$nextTick().then(() => {
      expect(wrapper.find('span.bg-red-600').exists()).toBe(false);
    });
  });

  test('switchChannel emits event only for different channels', () => {
    const wrapper = shallowMount(ServerSidebar, {
      propsData: { currentChannel: 'general' }
    });

    wrapper.vm.switchChannel('feedback');
    expect(wrapper.emitted('channel-change')).toEqual([['feedback']]);

    wrapper.vm.switchChannel('general');
    expect(wrapper.emitted('channel-change').length).toBe(1);
  });

  test('clicking logo switches channel when not current', async () => {
    const wrapper = shallowMount(ServerSidebar, {
      propsData: { currentChannel: 'feedback' }
    });

    await wrapper.find('.cursor-pointer.mb-4').trigger('click');

    expect(wrapper.emitted('channel-change')).toEqual([['general']]);
  });

  test('getUnreadCount returns 0 when channel missing', () => {
    const wrapper = shallowMount(ServerSidebar, {
      propsData: {
        channelUnreadCounts: { general: 1 }
      }
    });

    expect(wrapper.vm.getUnreadCount('general')).toBe(1);
    expect(wrapper.vm.getUnreadCount('feedback')).toBe(0);
  });

  test('shows join button when not signed in', () => {
    const wrapper = shallowMount(ServerSidebar, {
      propsData: { isSignedIn: false }
    });

    expect(wrapper.find('[data-testid="join-button"]').isVisible()).toBe(true);
    expect(wrapper.find('[data-testid="profile-button"]').isVisible()).toBe(false);
  });

  test('shows profile area when signed in', () => {
    const wrapper = shallowMount(ServerSidebar, {
      propsData: { isSignedIn: true, username: 'testuser' }
    });

    expect(wrapper.find('[data-testid="join-button"]').isVisible()).toBe(false);
    expect(wrapper.find('[data-testid="profile-button"]').isVisible()).toBe(true);
  });

  test('join button emits sign-in event when clicked', async () => {
    const wrapper = shallowMount(ServerSidebar, {
      propsData: { isSignedIn: false }
    });

    await wrapper.find('[data-testid="join-button"]').trigger('click');
    expect(wrapper.emitted('sign-in')).toBeTruthy();
    expect(wrapper.emitted('sign-in')).toHaveLength(1);
  });

  test('emits mount-user-button when isSignedIn becomes true', async () => {
    const wrapper = shallowMount(ServerSidebar, {
      propsData: { isSignedIn: false, username: 'testuser' }
    });

    await wrapper.setProps({ isSignedIn: true });
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted('mount-user-button')).toBeTruthy();
    expect(wrapper.emitted('mount-user-button')).toHaveLength(1);
  });

  test('isSignedIn defaults to false', () => {
    const wrapper = shallowMount(ServerSidebar);
    expect(wrapper.vm.isSignedIn).toBe(false);
    expect(wrapper.find('[data-testid="join-button"]').exists()).toBe(true);
  });

  test('does not emit mount-user-button when isSignedIn becomes false', async () => {
    const wrapper = shallowMount(ServerSidebar, {
      propsData: { isSignedIn: true, username: 'testuser' }
    });

    await wrapper.setProps({ isSignedIn: false });
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted('mount-user-button')).toBeFalsy();
  });
});
