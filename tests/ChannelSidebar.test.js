import { shallowMount } from '@vue/test-utils';
import ChannelSidebar from '../src/components/ChannelSidebar.vue';

describe('ChannelSidebar.vue', () => {
  test('renders correctly', () => {
    const wrapper = shallowMount(ChannelSidebar);
    
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
}); 