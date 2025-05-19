import { createApp } from 'vue';

// Mock Vue's createApp function
jest.mock('vue', () => ({
  createApp: jest.fn(() => ({
    mount: jest.fn()
  }))
}));

// Mock the App component
jest.mock('../client/src/App.vue', () => ({
  name: 'App'
}));

describe('main.js', () => {
  let originalDocument;
  
  beforeEach(() => {
    // Create a mock element for #app
    originalDocument = global.document;
    global.document = {
      ...originalDocument,
      getElementById: jest.fn(id => {
        if (id === 'app') {
          return document.createElement('div');
        }
        return null;
      })
    };
    
    // Clear all mocks before each test
    jest.clearAllMocks();
  });
  
  afterEach(() => {
    // Restore the original document
    global.document = originalDocument;
    
    // Clear any cached modules between tests
    jest.resetModules();
  });
  
  test('initializes Vue app and mounts it to #app', () => {
    // Import the main.js file which executes the code
    require('../client/src/main.js');
    
    // Assert createApp was called with the App component
    expect(createApp).toHaveBeenCalled();
    
    // Assert mount was called with #app
    const mockApp = createApp.mock.results[0].value;
    expect(mockApp.mount).toHaveBeenCalledWith('#app');
  });
}); 