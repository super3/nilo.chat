import { shallowMount } from '@vue/test-utils';
import ChatMessage from '../client/src/components/ChatMessage.vue';

describe('ChatMessage.vue', () => {
  const defaultProps = {
    username: 'testuser',
    timestamp: '12:34 PM',
    message: 'Hello world!'
  };

  test('renders correctly with required props', () => {
    const wrapper = shallowMount(ChatMessage, {
      propsData: defaultProps
    });
    
    // Check if component exists
    expect(wrapper.exists()).toBe(true);
    
    // Check if username is displayed
    expect(wrapper.find('.font-bold').text()).toBe('testuser');
    
    // Check if timestamp is displayed
    expect(wrapper.find('.text-gray-500').text()).toBe('12:34 PM');
    
    // Check if message is displayed
    expect(wrapper.find('.text-black').text()).toBe('Hello world!');
    
    // Verify avatar is rendered with correct URL
    const avatar = wrapper.find('img');
    expect(avatar.exists()).toBe(true);
    expect(avatar.attributes('src')).toBe('https://ui-avatars.com/api/?name=testuser&background=4F46E5&color=fff');
  });
  
  test('renders with custom avatar color', () => {
    const wrapper = shallowMount(ChatMessage, {
      propsData: {
        ...defaultProps,
        avatarColor: 'FF0000'
      }
    });
    
    // Verify avatar color is applied correctly
    const avatar = wrapper.find('img');
    expect(avatar.attributes('src')).toBe('https://ui-avatars.com/api/?name=testuser&background=FF0000&color=fff');
  });
  
  test('renders message without code block when code is empty', () => {
    const wrapper = shallowMount(ChatMessage, {
      propsData: defaultProps
    });
    
    // Verify no code block is rendered
    const codeBlock = wrapper.find('.bg-gray-100');
    expect(codeBlock.exists()).toBe(false);
    
    // Check computed property
    expect(wrapper.vm.hasCode).toBe(false);
  });
  
  test('renders message with code block when code is provided', () => {
    const wrapper = shallowMount(ChatMessage, {
      propsData: {
        ...defaultProps,
        code: 'console.log("test");'
      }
    });
    
    // Verify code block is rendered
    const codeBlock = wrapper.find('.bg-gray-100');
    expect(codeBlock.exists()).toBe(true);
    expect(codeBlock.text()).toBe('console.log("test");');
    
    // Check computed property
    expect(wrapper.vm.hasCode).toBe(true);
  });
  
  test('encodes username in avatar URL', () => {
    const wrapper = shallowMount(ChatMessage, {
      propsData: {
        ...defaultProps,
        username: 'user with spaces'
      }
    });
    
    // Verify URL encoding
    const avatar = wrapper.find('img');
    expect(avatar.attributes('src')).toBe('https://ui-avatars.com/api/?name=user%20with%20spaces&background=4F46E5&color=fff');
  });
}); 