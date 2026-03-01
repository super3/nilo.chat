import { shallowMount } from '@vue/test-utils';
import ChatMessage from '../src/components/ChatMessage.vue';

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
  
  test('uses profileImageUrl for avatar when provided', () => {
    const wrapper = shallowMount(ChatMessage, {
      propsData: {
        ...defaultProps,
        profileImageUrl: 'https://img.clerk.com/user123.jpg'
      }
    });

    const avatar = wrapper.find('img');
    expect(avatar.attributes('src')).toBe('https://img.clerk.com/user123.jpg');
  });

  test('falls back to generated avatar when profileImageUrl is empty', () => {
    const wrapper = shallowMount(ChatMessage, {
      propsData: {
        ...defaultProps,
        profileImageUrl: ''
      }
    });

    const avatar = wrapper.find('img');
    expect(avatar.attributes('src')).toBe('https://ui-avatars.com/api/?name=testuser&background=4F46E5&color=fff');
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

  test('renders URLs as clickable links', () => {
    const wrapper = shallowMount(ChatMessage, {
      propsData: {
        ...defaultProps,
        message: 'check https://example.com for details'
      }
    });

    const link = wrapper.find('.text-black a');
    expect(link.exists()).toBe(true);
    expect(link.attributes('href')).toBe('https://example.com');
    expect(link.attributes('target')).toBe('_blank');
    expect(link.attributes('rel')).toBe('noopener noreferrer');
    expect(link.text()).toBe('https://example.com');
  });

  test('renders URLs as clickable links in messages with code blocks', () => {
    const wrapper = shallowMount(ChatMessage, {
      propsData: {
        ...defaultProps,
        message: 'see https://docs.example.com',
        code: 'const x = 1;'
      }
    });

    const link = wrapper.find('.text-black a');
    expect(link.exists()).toBe(true);
    expect(link.attributes('href')).toBe('https://docs.example.com');
  });

  test('escapes HTML in messages to prevent XSS', () => {
    const wrapper = shallowMount(ChatMessage, {
      propsData: {
        ...defaultProps,
        message: '<script>alert("xss")</script>'
      }
    });

    const messageEl = wrapper.find('.text-black');
    expect(messageEl.html()).not.toContain('<script>');
    expect(messageEl.text()).toContain('<script>alert("xss")</script>');
  });

  test('linkedMessage computed property returns linkified text', () => {
    const wrapper = shallowMount(ChatMessage, {
      propsData: {
        ...defaultProps,
        message: 'visit https://example.com'
      }
    });

    expect(wrapper.vm.linkedMessage).toBe(
      'visit <a href="https://example.com" target="_blank" rel="noopener noreferrer">https://example.com</a>'
    );
  });
}); 