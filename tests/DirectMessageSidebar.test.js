import { shallowMount } from '@vue/test-utils';
import DirectMessageSidebar from '../src/components/DirectMessageSidebar.vue';

describe('DirectMessageSidebar.vue', () => {
  const defaultProps = {
    username: 'testuser',
    isConnected: false
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
  
  test('displays Steve_Nilo in the direct messages list', () => {
    const wrapper = shallowMount(DirectMessageSidebar, {
      propsData: defaultProps
    });
    
    // Check if Steve_Nilo appears in the HTML
    const html = wrapper.html();
    expect(html).toContain('Steve_Nilo');
  });
}); 