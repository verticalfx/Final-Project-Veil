const { expect } = require('chai');
const { authenticateTestUser, createSocketClient, wait } = require('./helpers');

describe('Socket.IO API', function() {
  this.timeout(30000);
  
  let userA, userB, socketA, socketB;
  
  before(async function() {
    // Authenticate two test users
    userA = await authenticateTestUser('+44777000001');
    userB = await authenticateTestUser('+44777000002');
  });
  
  afterEach(function() {
    // Clean up sockets after each test
    if (socketA) {
      socketA.disconnect();
      socketA = null;
    }
    if (socketB) {
      socketB.disconnect();
      socketB = null;
    }
  });
  
  describe('Connection and Authentication', function() {
    it('should connect with valid auth token', function(done) {
      socketA = createSocketClient(userA.token);
      
      socketA.on('connect', () => {
        expect(socketA.connected).to.be.true;
        done();
      });
      
      socketA.on('connect_error', (err) => {
        done(new Error(`Connection failed: ${err.message}`));
      });
    });
    
    it('should reject connection with invalid auth token', function(done) {
      const invalidSocket = createSocketClient('invalid-token');
      
      invalidSocket.on('connect', () => {
        invalidSocket.disconnect();
        done(new Error('Should not connect with invalid token'));
      });
      
      invalidSocket.on('connect_error', (err) => {
        expect(err.message).to.include('Authentication error');
        invalidSocket.disconnect();
        done();
      });
    });
  });
  
  describe('User Status', function() {
    it('should broadcast online status when a user connects', function(done) {
      // First connect user A
      socketA = createSocketClient(userA.token);
      
      socketA.on('connect', () => {
        // Register user A
        socketA.emit('registerUser');
        
        // Now connect user B and listen for user_status events
        socketB = createSocketClient(userB.token);
        
        socketB.on('connect', () => {
          socketB.emit('registerUser');
          
          // User B should receive user A's status
          socketB.on('user_status', (statusData) => {
            if (statusData.userId === userA.user._id) {
              expect(statusData.status).to.equal('online');
              done();
            }
          });
        });
      });
    });
    
    it('should broadcast offline status when a user disconnects', function(done) {
      // First connect both users
      socketA = createSocketClient(userA.token);
      socketB = createSocketClient(userB.token);
      
      let bothConnected = false;
      
      socketA.on('connect', () => {
        socketA.emit('registerUser');
        if (bothConnected) checkAndDisconnect();
        else bothConnected = true;
      });
      
      socketB.on('connect', () => {
        socketB.emit('registerUser');
        if (bothConnected) checkAndDisconnect();
        else bothConnected = true;
      });
      
      function checkAndDisconnect() {
        // Give sockets time to register
        setTimeout(() => {
          // Listen for offline status
          socketB.on('user_status', (statusData) => {
            if (statusData.userId === userA.user._id && statusData.status === 'offline') {
              done();
            }
          });
          
          // Disconnect user A
          socketA.disconnect();
          socketA = null;
        }, 500);
      }
    });
    
    it('should allow manual status updates', function(done) {
      // Connect both users
      socketA = createSocketClient(userA.token);
      socketB = createSocketClient(userB.token);
      
      let bothConnected = false;
      
      socketA.on('connect', () => {
        socketA.emit('registerUser');
        if (bothConnected) setUserStatus();
        else bothConnected = true;
      });
      
      socketB.on('connect', () => {
        socketB.emit('registerUser');
        if (bothConnected) setUserStatus();
        else bothConnected = true;
      });
      
      function setUserStatus() {
        // Wait for registration
        setTimeout(() => {
          // Listen for manual status update
          socketB.on('user_status', (statusData) => {
            if (statusData.userId === userA.user._id && statusData.status === 'offline') {
              done();
            }
          });
          
          // User A manually sets status to offline while still connected
          socketA.emit('userStatus', { online: false });
        }, 500);
      }
    });
  });
  
  describe('Messaging', function() {
    it('should relay messages between connected users', function(done) {
      socketA = createSocketClient(userA.token);
      socketB = createSocketClient(userB.token);
      
      const testMessageId = 'test-message-' + Date.now();
      const testContent = 'test-message-content';
      
      socketA.on('connect', () => {
        socketA.emit('registerUser');
      });
      
      socketB.on('connect', () => {
        socketB.emit('registerUser');
        
        // Listen for incoming messages
        socketB.on('ephemeral_message', (message) => {
          if (message.messageId === testMessageId) {
            expect(message.ciphertext).to.equal(testContent);
            expect(message.fromUserId).to.equal(userA.user._id);
            expect(message.toUserId).to.equal(userB.user._id);
            done();
          }
        });
      });
      
      // Wait for both to connect and register
      setTimeout(() => {
        // Send message from A to B
        socketA.emit('ephemeral_message', {
          messageId: testMessageId,
          toUserId: userB.user._id,
          nonceHex: '00',
          blockHash: '00',
          iv: '00',
          authTag: '00',
          ciphertext: testContent,
          time: new Date().toISOString()
        });
      }, 1000);
    });
    
    it('should store messages for offline users', function(done) {
      // Connect only user A
      socketA = createSocketClient(userA.token);
      
      const testMessageId = 'offline-message-' + Date.now();
      const testContent = 'offline-message-content';
      
      socketA.on('connect', () => {
        socketA.emit('registerUser');
        
        // Listen for storage confirmation
        socketA.on('message_stored', (confirmation) => {
          if (confirmation.messageId === testMessageId) {
            expect(confirmation.toUserId).to.equal(userB.user._id);
            
            // Now connect user B to confirm they receive the stored message
            socketB = createSocketClient(userB.token);
            
            socketB.on('connect', () => {
              socketB.on('ephemeral_message', (message) => {
                if (message.messageId === testMessageId) {
                  expect(message.ciphertext).to.equal(testContent);
                  done();
                }
              });
            });
          }
        });
        
        // Wait for registration
        setTimeout(() => {
          // Send message to offline user B
          socketA.emit('ephemeral_message', {
            messageId: testMessageId,
            toUserId: userB.user._id,
            nonceHex: '00',
            blockHash: '00',
            iv: '00',
            authTag: '00',
            ciphertext: testContent,
            time: new Date().toISOString()
          });
        }, 500);
      });
    });
    
    it('should handle read receipts', function(done) {
      socketA = createSocketClient(userA.token);
      socketB = createSocketClient(userB.token);
      
      const testMessageId = 'read-message-' + Date.now();
      
      socketA.on('connect', () => {
        socketA.emit('registerUser');
        
        // Listen for read receipt
        socketA.on('message_read', (receipt) => {
          if (receipt.messageId === testMessageId) {
            expect(receipt.fromUserId).to.equal(userB.user._id);
            done();
          }
        });
      });
      
      socketB.on('connect', () => {
        socketB.emit('registerUser');
        
        // Listen for message to mark as read
        socketB.on('ephemeral_message', (message) => {
          if (message.messageId === testMessageId) {
            // Send read receipt
            socketB.emit('message_read', {
              messageId: testMessageId,
              fromUserId: userB.user._id,
              toUserId: userA.user._id
            });
          }
        });
      });
      
      // Wait for both to connect and register
      setTimeout(() => {
        // Send message from A to B
        socketA.emit('ephemeral_message', {
          messageId: testMessageId,
          toUserId: userB.user._id,
          nonceHex: '00',
          blockHash: '00',
          iv: '00',
          authTag: '00',
          ciphertext: 'test-read-receipt',
          time: new Date().toISOString()
        });
      }, 1000);
    });
  });
}); 