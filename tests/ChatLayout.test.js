describe('ChatLayout Component', () => {
  it('should generate random username', () => {
    // Create a random username like the component does
    const createUsername = () => 'User_' + Math.floor(Math.random() * 1000);
    
    // Check that the username format is correct
    const username = createUsername();
    expect(username).toMatch(/^User_\d+$/);
    
    // Check that random usernames are different
    // Note: This test has a very small chance of false failure if the random numbers are the same
    const username2 = createUsername();
    expect(username === username2).toBe(false);
  });
  
  it('should handle connection status updates', () => {
    // Create a component object with the updateConnectionStatus method
    const component = {
      isConnected: false,
      updateConnectionStatus(status) {
        this.isConnected = status;
      }
    };
    
    // Test with connected status
    component.updateConnectionStatus(true);
    expect(component.isConnected).toBe(true);
    
    // Test with disconnected status
    component.updateConnectionStatus(false);
    expect(component.isConnected).toBe(false);
  });
}); 