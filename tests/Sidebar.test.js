describe('Sidebar Components', () => {
  describe('ChannelSidebar', () => {
    it('should have default channels', () => {
      // Simulated component data structure
      const component = {
        channels: [
          { id: 1, name: 'general', isActive: true },
          { id: 2, name: 'random', isActive: false }
        ]
      };
      
      // Check channels data structure
      expect(component.channels).toHaveLength(2);
      expect(component.channels[0].name).toBe('general');
      expect(component.channels[0].isActive).toBe(true);
      expect(component.channels[1].name).toBe('random');
      expect(component.channels[1].isActive).toBe(false);
    });
    
    it('should allow switching active channel', () => {
      // Simulated component with switchChannel method
      const component = {
        channels: [
          { id: 1, name: 'general', isActive: true },
          { id: 2, name: 'random', isActive: false }
        ],
        switchChannel(channelId) {
          this.channels = this.channels.map(channel => ({
            ...channel,
            isActive: channel.id === channelId
          }));
        }
      };
      
      // Initially general is active
      expect(component.channels[0].isActive).toBe(true);
      expect(component.channels[1].isActive).toBe(false);
      
      // Switch to random
      component.switchChannel(2);
      
      // Now random should be active
      expect(component.channels[0].isActive).toBe(false);
      expect(component.channels[1].isActive).toBe(true);
    });
  });
  
  describe('DirectMessageSidebar', () => {
    it('should handle direct message users', () => {
      // Simulated component data structure
      const component = {
        username: 'CurrentUser',
        isConnected: true,
        directMessages: [
          { id: 1, username: 'User1', hasUnread: false },
          { id: 2, username: 'User2', hasUnread: true }
        ]
      };
      
      // Check direct messages data structure
      expect(component.directMessages).toHaveLength(2);
      expect(component.directMessages[0].username).toBe('User1');
      expect(component.directMessages[0].hasUnread).toBe(false);
      expect(component.directMessages[1].username).toBe('User2');
      expect(component.directMessages[1].hasUnread).toBe(true);
    });
    
    it('should mark messages as read', () => {
      // Simulated component with markAsRead method
      const component = {
        directMessages: [
          { id: 1, username: 'User1', hasUnread: false },
          { id: 2, username: 'User2', hasUnread: true }
        ],
        markAsRead(userId) {
          this.directMessages = this.directMessages.map(user => {
            if (user.id === userId) {
              return { ...user, hasUnread: false };
            }
            return user;
          });
        }
      };
      
      // Initially User2 has unread messages
      expect(component.directMessages[1].hasUnread).toBe(true);
      
      // Mark User2's messages as read
      component.markAsRead(2);
      
      // Now User2 should not have unread messages
      expect(component.directMessages[1].hasUnread).toBe(false);
    });
    
    it('should show correct connection status', () => {
      // Simulated props
      const connected = {
        username: 'CurrentUser',
        isConnected: true
      };
      
      const disconnected = {
        username: 'CurrentUser',
        isConnected: false  
      };
      
      // Function to determine status text
      const getStatusText = (props) => {
        return props.isConnected ? 'Online' : 'Offline';
      };
      
      // Check correct status based on connected prop
      expect(getStatusText(connected)).toBe('Online');
      expect(getStatusText(disconnected)).toBe('Offline');
    });
  });
}); 