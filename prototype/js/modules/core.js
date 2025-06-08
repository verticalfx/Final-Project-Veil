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
  },

  reset() {
    this.currentUser = null;
    this.token = null;
    this.contacts = [];
    this.activeContactId = null;
    this.sidebarMode = 'chats';
    this.isWindowFocused = false;
    this.saveToLocalStorage();
  }
};

// Make AppState available globally
window.AppState = AppState;

// Initialize AppState from localStorage
document.addEventListener('DOMContentLoaded', () => {
  AppState.loadFromLocalStorage();
});

// Add status constants
const USER_STATUS = {
    ONLINE: 'online',
    AWAY: 'away',
    OFFLINE: 'offline'
};

// Add activity tracking
let lastActivityTime = Date.now();
let activityCheckInterval = null;
const ACTIVITY_TIMEOUT = 60000; // 1 minute of inactivity = away

/**
 * Track user activity
 */
function trackActivity() {
    lastActivityTime = Date.now();
    if (window.socket && window.isWindowFocused) {
        emitUserStatus(USER_STATUS.ONLINE);
    }
}

/**
 * Check user activity status
 */
function checkActivity() {
    if (!window.isWindowFocused) return;
    
    const inactiveTime = Date.now() - lastActivityTime;
    if (inactiveTime > ACTIVITY_TIMEOUT && window.socket) {
        emitUserStatus(USER_STATUS.AWAY);
    }
}

/**
 * Emit user status update
 */
function emitUserStatus(status) {
    if (!window.socket) return;
    console.log('Emitting user status:', status);
    window.socket.emit('user_status', { status });
}

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
        updateConnectionStatus('connected');
        
        // Register user with socket
        if (window.currentUser?._id) {
            console.log('Registering user with socket server:', window.currentUser._id);
            socket.emit('registerUser');
            
            // Set initial online status based on window focus
            emitUserStatus(document.hasFocus() ? USER_STATUS.ONLINE : USER_STATUS.AWAY);
        } else {
            console.error('Cannot register user: No current user ID available');
        }
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from socket server');
        updateConnectionStatus('disconnected');
        
        // Clear activity check on disconnect
        if (activityCheckInterval) {
            clearInterval(activityCheckInterval);
            activityCheckInterval = null;
        }
    });

    socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        updateConnectionStatus('error', error.message);
        showToast('Connection error. Please check your internet connection.', 'error');
    });

    // Handle user status updates
    socket.on('user_status', (data) => {
        console.log('User status update:', data);
        const contact = window.AppState.getContact(data.userId);
        if (contact) {
            contact.online = data.status === USER_STATUS.ONLINE;
            contact.away = data.status === USER_STATUS.AWAY;
            contact.lastSeen = data.lastSeen;
            
            // Update UI
            window.AppState.saveToLocalStorage();
            if (typeof window.refreshContactsUI === 'function') {
                window.refreshContactsUI();
            }
            if (typeof window.refreshChatsUI === 'function') {
                window.refreshChatsUI('core.js:user_status');
            }
        }
    });

    // Handle other socket events...
    // ... existing socket event handlers ...
}

/**
 * Update the connection status indicator
 */
function updateConnectionStatus(status, message) {
    const statusElement = document.getElementById('connectionStatus');
    if (!statusElement) return;

    const statusDot = statusElement.querySelector('span:first-child');
    const statusText = statusElement.querySelector('.connection-text');
    
    switch (status) {
        case 'connected':
            statusDot.className = 'text-green-500';
            statusText.textContent = message || 'Connected';
            statusElement.className = 'text-sm px-3 py-1 rounded-full bg-green-900 bg-opacity-20';
            break;
        case 'disconnected':
            statusDot.className = 'text-red-500';
            statusText.textContent = message || 'Disconnected';
            statusElement.className = 'text-sm px-3 py-1 rounded-full bg-red-900 bg-opacity-20';
            break;
        case 'connecting':
            statusDot.className = 'text-yellow-500';
            statusText.textContent = message || 'Connecting...';
            statusElement.className = 'text-sm px-3 py-1 rounded-full bg-yellow-900 bg-opacity-20';
            break;
        default:
            statusDot.className = 'text-gray-500';
            statusText.textContent = message || 'Unknown';
            statusElement.className = 'text-sm px-3 py-1 rounded-full bg-dark-tertiary';
    }
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
    
    // Setup activity tracking
    document.addEventListener('mousemove', trackActivity);
    document.addEventListener('keydown', trackActivity);
    document.addEventListener('click', trackActivity);
    document.addEventListener('scroll', trackActivity);
    
    // Start activity check interval
    activityCheckInterval = setInterval(checkActivity, 10000); // Check every 10 seconds
    
    // Set initial window focus state
    window.isWindowFocused = document.hasFocus();
    
    // Setup window focus/blur events for online status
    window.addEventListener('focus', () => {
        console.log('Window focused');
        window.isWindowFocused = true;
        if (socket) {
            emitUserStatus(USER_STATUS.ONLINE);
        }
    });
    
    window.addEventListener('blur', () => {
        console.log('Window blurred');
        window.isWindowFocused = false;
        if (socket) {
            emitUserStatus(USER_STATUS.AWAY);
        }
    });

    // Handle page visibility changes
    document.addEventListener('visibilitychange', () => {
        console.log('Visibility changed:', document.visibilityState);
        if (document.visibilityState === 'visible') {
            window.isWindowFocused = true;
            if (socket) {
                emitUserStatus(USER_STATUS.ONLINE);
            }
        } else {
            window.isWindowFocused = false;
            if (socket) {
                emitUserStatus(USER_STATUS.AWAY);
            }
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
  USER_STATUS,
  trackActivity,
  emitUserStatus,
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

/**
 * Handle logout
 */
window.handleLogout = async function() {
    try {
        // Clear all app state
        window.AppState.reset();
        window.currentUser = null;
        window.contacts = [];
        window.activeContactId = null;
        window.authState = {
            phoneNumber: '',
            username: '',
            bio: '',
            phoneNotRegistered: false,
            requestToken: null
        };

        // Clear local storage and session storage
        localStorage.clear();
        sessionStorage.clear();

        // Disconnect socket if it exists
        if (window.socket) {
            window.socket.disconnect();
            window.socket = null;
        }

        // Reset UI elements
        const chatScreen = document.getElementById('chatScreen');
        const onboardingContainer = document.getElementById('onboardingContainer');
        const stepPhone = document.getElementById('stepPhone');
        const stepOTP = document.getElementById('stepOTP');
        const stepName = document.getElementById('stepName');
        const stepBio = document.getElementById('stepBio');

        // Hide chat screen
        if (chatScreen) chatScreen.classList.add('hidden');

        // Show onboarding container
        if (onboardingContainer) {
            onboardingContainer.classList.remove('hidden');
        }

        // Reset all steps to hidden first
        [stepOTP, stepName, stepBio].forEach(step => {
            if (step) step.classList.add('hidden');
        });

        // Show phone step last to ensure proper display
        if (stepPhone) {
            stepPhone.classList.remove('hidden');
            // Clear and reset phone input
            const phoneInput = document.getElementById('phoneInput');
            if (phoneInput) {
                phoneInput.value = '';
                // Focus the input after a short delay to ensure UI is ready
                setTimeout(() => phoneInput.focus(), 100);
            }
        }

        // Reset all OTP inputs
        const otpInputs = document.querySelectorAll('.otp-input');
        otpInputs.forEach(input => {
            input.value = '';
            input.classList.remove('border-purple-primary');
        });
        const otpHiddenInput = document.getElementById('otpInput');
        if (otpHiddenInput) otpHiddenInput.value = '';

        // Reset country select to default
        const countrySelect = document.getElementById('countrySelect');
        if (countrySelect) {
            const defaultCountry = window.phoneCountryList?.find(c => c.code === 'GB');
            if (defaultCountry) {
                countrySelect.value = defaultCountry.dialCode;
            }
        }

        // Clear any error messages
        const errorElements = document.querySelectorAll('.text-red-400, .text-red-500');
        errorElements.forEach(el => el.textContent = '');

        // Reset progress indicator
        const progressSteps = document.querySelectorAll('.progress-step');
        if (progressSteps.length) {
            progressSteps.forEach(step => {
                step.classList.remove('active', 'completed');
            });
            // Set first step as active
            progressSteps[0].classList.add('active');
        }

        // Reset any modals that might be open
        const modals = document.querySelectorAll('.modal-bg');
        modals.forEach(modal => {
            modal.classList.add('hidden');
            modal.classList.remove('active');
        });

        // Clear any search inputs
        const searchInputs = document.querySelectorAll('input[type="search"], input[type="text"]');
        searchInputs.forEach(input => {
            input.value = '';
        });

        // Show success toast
        window.Toast.fire({
            icon: 'success',
            title: 'Logged out successfully'
        });

        // Force a page reload to ensure clean state
        setTimeout(() => {
            window.location.reload();
        }, 1000);

    } catch (error) {
        console.error('Error during logout:', error);
        window.Toast.fire({
            icon: 'error',
            title: 'Error logging out'
        });
    }
}; 



