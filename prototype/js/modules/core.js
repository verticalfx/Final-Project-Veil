/**
 * core.js - Core functionality and global state
 */

// Global states
let phoneNumber = '';
let usernameVal = '';
let bioVal = '';
let pfpVal = '';
let token = null;
let currentUser = null;
let phoneNotRegistered = false;
let socket = null;

// The user's known contacts (plus ephemeral messages from them)
let contacts = [];
let activeContactId = null;

// For toggling "Chats" / "Contacts"
let sidebarMode = 'chats';

// If we want to handle "online" detection
let isWindowFocused = false;

// Live contact search with debounce
let searchTimeout = null;

// Add contactsState to core.js
export const contactsState = {
    contacts: [],
    activeContactId: null
};

// Create a centralized state management object
const AppState = {
  // User information
  currentUser: null,
  token: null,
  
  // Contacts and messages (reference the contactsState)
  contacts: contactsState.contacts,
  activeContactId: contactsState.activeContactId,
  
  // UI state
  sidebarMode: 'chats',
  isWindowFocused: false,
  
  // Helper methods
  getActiveContact() {
    if (!this.activeContactId) return null;
    return this.contacts.find(c => c._id === this.activeContactId);
  },
  
  addContact(contact) {
    // Check if contact already exists
    const existingIndex = this.contacts.findIndex(c => c._id === contact._id);
    if (existingIndex >= 0) {
        // Update existing contact
        this.contacts[existingIndex] = {
            ...this.contacts[existingIndex],
            ...contact,
            // Preserve messages if they exist
            messages: this.contacts[existingIndex].messages || contact.messages || [],
            // If this is a proper add contact action, remove the isNotInContacts flag
            isNotInContacts: false
        };
    } else {
        // Add new contact
        this.contacts.push({
            ...contact,
            messages: contact.messages || []
        });
    }
    
    // Save to localStorage
    this.saveToLocalStorage();
  },
  
  addMessage(contactId, message) {
    const contact = this.contacts.find(c => c._id === contactId);
    if (!contact) {
      console.error('Cannot add message: Contact not found', contactId);
      return false;
    }
    
    // Initialize messages array if it doesn't exist
    if (!contact.messages) {
      contact.messages = [];
    }
    
    // Check if message already exists
    const existingIndex = contact.messages.findIndex(m => m._id === message._id);
    if (existingIndex >= 0) {
      // Update existing message
      contact.messages[existingIndex] = {
        ...contact.messages[existingIndex],
        ...message
      };
    } else {
      // Add new message
      contact.messages.push(message);
    }
    
    // Update last message info
    contact.lastMessage = message.text;
    contact.lastMessageTime = message.time;
    
    // Update unread count if not active contact
    if (this.activeContactId !== contactId && message.from !== this.currentUser?._id) {
      contact.unreadCount = (contact.unreadCount || 0) + 1;
    }
    
    // Save to localStorage
    this.saveToLocalStorage();
    return true;
  },
  
  setActiveContact(contactId) {
    this.activeContactId = contactId;
    
    // Reset unread count for this contact
    if (contactId) {
      const contact = this.contacts.find(c => c._id === contactId);
      if (contact) {
        contact.unreadCount = 0;
      }
    }
  },
  
  saveToLocalStorage() {
    try {
        sessionStorage.setItem('appState', JSON.stringify({
            contacts: this.contacts,
            activeContactId: this.activeContactId,
            sidebarMode: this.sidebarMode
        }));
    } catch (error) {
        console.error('Error saving state to sessionStorage:', error);
    }
  },
  
  loadFromLocalStorage() {
    try {
        // Try to load from sessionStorage first
        let savedState = sessionStorage.getItem('appState');
        
        // If not found in sessionStorage, try localStorage (for backward compatibility)
        if (!savedState) {
            savedState = localStorage.getItem('appState');
            // If found in localStorage, migrate it to sessionStorage
            if (savedState) {
                sessionStorage.setItem('appState', savedState);
                // Clear from localStorage
                localStorage.removeItem('appState');
            }
        }
        
        if (savedState) {
            const parsedState = JSON.parse(savedState);
            
            // Update state with saved values
            if (parsedState.contacts) this.contacts = parsedState.contacts;
            if (parsedState.activeContactId) this.activeContactId = parsedState.activeContactId;
            if (parsedState.sidebarMode) this.sidebarMode = parsedState.sidebarMode;
        }
    } catch (error) {
        console.error('Error loading state from storage:', error);
    }
  },
  
  getMessages(contactId) {
    const contact = this.contacts.find(c => c._id === contactId);
    if (!contact) {
      console.error('Cannot get messages: Contact not found', contactId);
      return [];
    }
    
    return contact.messages || [];
  },

  getContact(contactId) {
    return this.contacts.find(c => c._id === contactId);
  },

  // Add a new method to update a contact
  updateContact(contact) {
    const existingIndex = this.contacts.findIndex(c => c._id === contact._id);
    if (existingIndex >= 0) {
        this.contacts[existingIndex] = {
            ...this.contacts[existingIndex],
            ...contact,
            // Preserve messages
            messages: this.contacts[existingIndex].messages
        };
        this.saveToLocalStorage();
        return true;
    }
    return false;
  },

  /**
   * Update status field for a message in a conversation
   */
  updateMessageStatus(contactId, messageId, newStatus) {
    const contact = this.contacts.find(c => c._id === contactId);
    if (!contact || !contact.messages) return false;
    const msg = contact.messages.find(m => m._id === messageId);
    if (!msg) return false;
    msg.status = newStatus;
    this.saveToLocalStorage();
    return true;
  }
};

// Make AppState available globally
window.AppState = AppState;

// Initialize AppState from localStorage
document.addEventListener('DOMContentLoaded', () => {
  AppState.loadFromLocalStorage();
});

/**
 * Initialize socket connection
 */
function initSocket() {
  if (socket) {
    console.log('Socket already initialized');
    return;
  }

  // Get auth token
  const token = window.apiUtils.getAuthToken();
  if (!token) {
    console.error('Cannot initialize socket: No auth token available');
    return;
  }

  console.log('Initializing socket connection with auth token...');
  
  // Connect to socket server with auth token
  socket = io('http://localhost:4000', {
    auth: {
      token: token
    },
    transports: ['websocket'],
    upgrade: false,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
  });

  // Set up event handlers
  socket.on('connect', () => {
    console.log('Connected to socket server with socket ID:', socket.id);
    showToast('Connected to server', 'success');
    document.getElementById('connectionStatus').innerHTML = '<span class="text-green-500">●</span> Online';
    
    // Register user with socket
    if (window.currentUser?._id) {
      console.log('Registering user with socket server:', window.currentUser._id);
      // The server now auto-registers users on connection, but we'll still emit this for redundancy
      socket.emit('registerUser');
      
      // Also set online status
      socket.emit('userStatus', { online: true });
    } else {
      console.error('Cannot register user: No current user ID available');
    }
  });

  socket.on('disconnect', () => {
    console.log('Disconnected from socket server');
    document.getElementById('connectionStatus').innerHTML = '<span class="text-red-500">●</span> Offline';
  });

  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error);
    document.getElementById('connectionStatus').innerHTML = '<span class="text-red-500">●</span> Offline';
    showToast('Connection error. Please check your internet connection.', 'error');
  });

  // Handle incoming messages
  socket.on('ephemeral_message', async (data) => {
    console.log('Received encrypted message:', data);
    try {
      // Verify message integrity
      if (!data.blockHash || !data.nonceHex || !data.iv || !data.authTag || !data.ciphertext) {
        console.error('Message missing components:', {
          hasBlockHash: !!data.blockHash,
          hasNonceHex: !!data.nonceHex,
          hasIv: !!data.iv,
          hasAuthTag: !!data.authTag,
          hasCiphertext: !!data.ciphertext
        });
        throw new Error('Received message is missing encryption components');
      }

      console.log('Message integrity verified, processing message...');
      
      // Check if handleIncomingEphemeral is available
      if (typeof window.handleIncomingEphemeral !== 'function') {
        console.error('handleIncomingEphemeral function not available');
        // Try to dynamically import it
        try {
          const messagingModule = await import('./messaging.js');
          if (typeof messagingModule.handleIncomingEphemeral === 'function') {
            console.log('Successfully imported handleIncomingEphemeral');
            
            // Also check if fetchUserById is available
            if (typeof window.fetchUserById !== 'function' && typeof messagingModule.fetchUserById === 'function') {
              console.log('Exposing fetchUserById to window');
              window.fetchUserById = messagingModule.fetchUserById;
            }
            
            await messagingModule.handleIncomingEphemeral(data);
          } else {
            throw new Error('handleIncomingEphemeral not found in messaging module');
          }
        } catch (importError) {
          console.error('Error importing messaging module:', importError);
          throw importError;
        }
      } else {
        // Make sure fetchUserById is available
        if (typeof window.fetchUserById !== 'function') {
          console.error('fetchUserById function not available, trying to import it');
          try {
            const messagingModule = await import('./messaging.js');
            if (typeof messagingModule.fetchUserById === 'function') {
              console.log('Successfully imported fetchUserById');
              window.fetchUserById = messagingModule.fetchUserById;
            }
          } catch (importError) {
            console.error('Error importing fetchUserById:', importError);
          }
        }
        
        // Handle the encrypted message
        await window.handleIncomingEphemeral(data);
      }
      
      console.log('Message processed successfully');
    } catch (error) {
      console.error('Error processing encrypted message:', error);
      showToast('Error processing encrypted message', 'error');
    }
  });

  // Handle user status updates
  socket.on('user_status', (data) => {
    console.log('User status update:', data);
    const contact = window.AppState.getContact(data.userId);
    if (contact) {
      contact.online = data.status === 'online';
      contact.lastSeen = data.lastSeen;
      // Persist and refresh UI
      window.AppState.saveToLocalStorage();
      if (typeof window.refreshContactsUI === 'function') window.refreshContactsUI();
      if (typeof window.refreshChatsUI === 'function') window.refreshChatsUI('core.js:user_status');
    }
  });

  // Handle read receipts
  socket.on('message_read', (data) => {
    console.log('Message read receipt:', data);
    const { messageId, fromUserId } = data;
    const contact = contacts.find(c => c._id === fromUserId);
    if (contact) {
      const message = contact.messages.find(m => m._id === messageId);
      if (message) {
        message.status = 'read';
        refreshChatsUI('core.js:358 (message_read)');
      }
    }
  });

  // Make socket available globally
  window.socket = socket;
}

/**
 * Initialize the application
 */
function initApp() {
  // Check if user is logged in
  const token = window.apiUtils.getAuthToken();
  if (!token) {
    console.log('User not logged in, skipping socket initialization');
    return;
  }
  
  // Get user data from localStorage
  const userData = window.apiUtils.getUserData();
  if (!userData) {
    console.log('No user data found, skipping initialization');
    return;
  }
  
  // Set current user in AppState
  AppState.currentUser = userData;
  AppState.token = token;
  
  // Also set in window for backward compatibility
  window.currentUser = userData;
  window.token = token;
  
  // Initialize socket connection
  console.log('Connecting socket with userId:', userData._id);
  initSocket();
  
  // Fetch contacts
  if (typeof window.fetchContacts === 'function') {
    window.fetchContacts('initApp');
  }
  
  // Fetch offline messages
  if (typeof window.fetchOfflineEphemeralMessages === 'function') {
    window.fetchOfflineEphemeralMessages();
  }
  
  // Setup UI event handlers (only once)
  setupMessageInput();
  setupModalCloseOnOutsideClick();
  
  // Setup window focus/blur events for online status
  window.addEventListener('focus', () => {
    AppState.isWindowFocused = true;
    if (socket) {
      socket.emit('userStatus', { online: true });
    }
  });
  
  window.addEventListener('blur', () => {
    AppState.isWindowFocused = false;
    if (socket) {
      socket.emit('userStatus', { online: false });
    }
  });
}

/**
 * Setup modal close on outside click
 */
function setupModalCloseOnOutsideClick() {
  const modals = [
    { bg: document.getElementById('addContactModal'), content: document.querySelector('#addContactModal .modal-content') },
    { bg: document.getElementById('profileModal'), content: document.querySelector('#profileModal > div') },
    { bg: document.getElementById('encryptionInfoModal'), content: document.querySelector('#encryptionInfoModal .modal-content') },
    { bg: document.getElementById('messageInfoModal'), content: document.querySelector('#messageInfoModal .modal-content') },
    { bg: document.getElementById('contactProfileModal'), content: document.querySelector('#contactProfileModal .modal-content') }
  ];

  modals.forEach(modal => {
    if (modal.bg && modal.content) {
      modal.bg.addEventListener('click', (e) => {
        if (e.target === modal.bg) {
          // If clicking the background (not the content), close the modal
          if (modal.bg.id === 'addContactModal') closeAddContactModal();
          else if (modal.bg.id === 'profileModal') closeProfileModal();
          else if (modal.bg.id === 'encryptionInfoModal') closeEncryptionInfo();
          else if (modal.bg.id === 'messageInfoModal') closeMessageInfo();
          else if (modal.bg.id === 'contactProfileModal') window.closeContactProfileModal();
        }
      });
    }
  });
}

/**
 * Setup message input handling
 */
function setupMessageInput() {
    console.log('Setting up message input handlers...');
    
    // Get message input elements
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.querySelector('#chatAreaBox button');
    
    if (!messageInput || !sendButton) {
        console.error('Message input elements not found:', {
            messageInput: !!messageInput,
            sendButton: !!sendButton
        });
        return;
    }
    
    console.log('Message input elements found, setting up event handlers');
    
    // Remove any existing event listeners to prevent duplicates
    const newMessageInput = messageInput.cloneNode(true);
    const newSendButton = sendButton.cloneNode(true);
    
    if (messageInput.parentNode) {
        messageInput.parentNode.replaceChild(newMessageInput, messageInput);
    }
    
    if (sendButton.parentNode) {
        sendButton.parentNode.replaceChild(newSendButton, sendButton);
    }
    
    // Set up event listeners on the new elements
    newSendButton.addEventListener('click', function(e) {
        e.preventDefault();
        console.log('Send button clicked');
        window.sendMessage();
    });
    
    newMessageInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            console.log('Enter key pressed');
            window.sendMessage();
        }
    });
    
    console.log('Message input handlers set up successfully');
}

/**
 * Helper function to generate UUID
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Show toast notifications with styling
 */
function showToast(message, type = 'info') {
  const toast = Swal.mixin({
    toast: true,
    position: 'bottom-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    didOpen: (toast) => {
      toast.addEventListener('mouseenter', Swal.stopTimer)
      toast.addEventListener('mouseleave', Swal.resumeTimer)
    },
    customClass: {
      popup: `toast toast-${type}`
    }
  });

  toast.fire({
    icon: type,
    title: message
  });
}

/**
 * Close profile modal
 */
function closeProfileModal() {
  const modal = document.getElementById('profileModal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

// Initialize when document is loaded
document.addEventListener('DOMContentLoaded', initApp);

// Export functions and variables
export {
  phoneNumber,
  usernameVal,
  bioVal,
  pfpVal,
  token,
  currentUser,
  phoneNotRegistered,
  socket,
  contacts,
  activeContactId,
  sidebarMode,
  isWindowFocused,
  searchTimeout,
  showToast,
  generateUUID,
  setupMessageInput,
  setupModalCloseOnOutsideClick,
  closeProfileModal,
  initSocket,
  initApp
}; 



