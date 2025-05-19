import { shallowMount } from '@vue/test-utils';
import App from '../client/src/App.vue';

// Mock the ChatLayout component
jest.mock('../client/src/components/ChatLayout.vue', () => ({
  name: 'ChatLayout',
  render: () => null
}));

describe('App.vue', () => {
  test('renders correctly', () => {
    const wrapper = shallowMount(App);
    
    // Check if component exists
    expect(wrapper.exists()).toBe(true);
    
    // Check if it has the expected div with correct styling
    const rootDiv = wrapper.find('div');
    expect(rootDiv.exists()).toBe(true);
    expect(rootDiv.classes()).toContain('h-screen');
    expect(rootDiv.classes()).toContain('overflow-hidden');
    expect(rootDiv.attributes('style')).toBe('background: rgb(237, 242, 247);');
    
    // Check if ChatLayout is included
    const chatLayout = wrapper.findComponent({ name: 'ChatLayout' });
    expect(chatLayout.exists()).toBe(true);
  });
}); 