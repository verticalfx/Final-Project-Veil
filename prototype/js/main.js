/**
 * main.js - Main application entry point
 * 
 * This file imports and initializes all modules for the application.
 */

// Import modules
import {
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
    closeProfileModal
} from './modules/core.js';

import {
    startPhoneLogin,
    verifyOtp,
    submitUsername,
    submitBio,
    showStep,
    hideStep,
    handleLogout,
    logout,
    registerUser,
    continueFromName,
    continueFromBio,
    skipBio
} from './modules/auth.js';

import {
    deriveEphemeralKey,
    encryptAESGCM,
    decryptAESGCM,
    getEOSBlockHash,
    ephemeralEncrypt,
    ephemeralDecrypt
} from './modules/crypto.js';

import {
    sendMessage,
    sendEphemeralMessage,
    handleIncomingEphemeral,
    fetchOfflineEphemeralMessages,
    ackEphemeralMessage,
    markMessagesAsRead,
    showMessageDetails,
    closeMessageInfo,
    showEncryptionInfo,
    closeEncryptionInfo,
    initializeMessageInput,
} from './modules/messaging.js';

import {
    fetchContacts,
    fetchUserById,
    refreshContactsUI,
    refreshChatsUI,
    selectContact,
    viewContactProfile,
    clearChat,
    removeContact,
    removeContactViaBackend,
    openAddContactModal,
    closeAddContactModal,
    searchAndAddContact,
    addContactById,
    toggleSidebarMode,
    searchContacts,
    openContactProfileModal,
    closeContactProfileModal
} from './modules/contacts.js';

// Import contactsState from contacts.js
import { contactsState } from './modules/contacts.js';

// Import renderChatMessages from shared.js
import { renderChatMessages } from './modules/shared.js';

// Make shared functions available globally
window.renderChatMessages = renderChatMessages;

// Add a flag to prevent duplicate socket connections
let isConnectingSocket = false;

/**
 * Connect to the socket server
 */
function connectSocket(caller = 'unknown') {
    console.log('connectSocket called from:', caller);
    console.log('Call stack:', new Error().stack);
    
    // Check if already connecting or connected
    if (isConnectingSocket || (window.socket && window.socket.connected)) {
        console.log('Socket already connecting or connected, skipping duplicate call');
        return;
    }
    
    isConnectingSocket = true;
    
    try {
        if (!window.currentUser || !window.currentUser._id) {
            console.error('Cannot connect socket: No current user');
            return;
        }

        // Get the authentication token
        const token = window.apiUtils.getAuthToken();
        if (!token) {
            console.error('Cannot connect socket: No auth token');
            return;
        }

        console.log('Connecting socket with userId:', window.currentUser._id);

        // Show connecting status
        updateConnectionStatus('connecting');

        // Connect to socket server with auth token
        window.socket = io('http://localhost:4000', {
            query: {
                userId: window.currentUser._id
            },
            auth: {
                token: token
            }
        });

        // Socket event handlers
        window.socket.on('connect', () => {
            console.log('Socket connected');
            showToast('Connected to server', 'success');
            updateConnectionStatus('connected');
            isConnectingSocket = false;
        });

        window.socket.on('disconnect', () => {
            console.log('Socket disconnected');
            updateConnectionStatus('disconnected');
        });

        window.socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
            showToast('Connection error: ' + error.message, 'error');
            updateConnectionStatus('error', error.message);
            isConnectingSocket = false;
        });

        window.socket.on('ephemeral_message', async (data) => {
            console.log('Received ephemeral message:', data);
            await handleIncomingEphemeral(data);
        });

        window.socket.on('user_status', (data) => {
            console.log('User status update:', data);

            // Find the contact and update their status
            const contact = contacts.find(c => c._id === data.userId);
            if (contact) {
                contact.online = data.status === 'online';
                contact.away = data.status === 'away';
                contact.lastSeen = data.lastSeen;
                refreshContactsUI();
                refreshChatsUI('main.js:152 (user_status event)');
            }
        });

        // Handle window focus/blur for online status
        window.addEventListener('focus', () => {
            window.isWindowFocused = true;
            if (window.socket && window.socket.connected) {
                window.emitUserStatus('online');
            }
        });

        window.addEventListener('blur', () => {
            window.isWindowFocused = false;
            if (window.socket && window.socket.connected) {
                window.emitUserStatus('away');
            }
        });

        // Initial status
        if (window.socket && window.socket.connected) {
            window.socket.emit('user_status', { status: 'online' });
        }
    } catch (err) {
        console.error('Error connecting socket:', err);
        isConnectingSocket = false;
    }
}

/**
 * Update the connection status indicator
 * @param {string} status - The connection status (connected, disconnected, connecting)
 * @param {string} message - Optional message to display
 */
function updateConnectionStatus(status, message) {
    const statusElement = document.getElementById('connectionStatus');
    if (!statusElement) return;
    
    const statusDot = statusElement.querySelector('span:first-child');
    const statusText = statusElement.querySelector('.connection-text') || statusElement.childNodes[1];
    
    switch (status) {
        case 'connected':
            statusDot.className = 'text-green-500';
            statusText.textContent = message || 'Connected';
            statusElement.classList.remove('bg-red-900', 'bg-yellow-900', 'bg-dark-tertiary');
            statusElement.classList.add('bg-green-900', 'bg-opacity-20');
            break;
        case 'disconnected':
            statusDot.className = 'text-red-500';
            statusText.textContent = message || 'Disconnected';
            statusElement.classList.remove('bg-green-900', 'bg-yellow-900', 'bg-dark-tertiary');
            statusElement.classList.add('bg-red-900', 'bg-opacity-20');
            break;
        case 'connecting':
            statusDot.className = 'text-yellow-500';
            statusText.textContent = message || 'Connecting...';
            statusElement.classList.remove('bg-green-900', 'bg-red-900', 'bg-dark-tertiary');
            statusElement.classList.add('bg-yellow-900', 'bg-opacity-20');
            break;
        default:
            statusDot.className = 'text-gray-500';
            statusText.textContent = message || 'Unknown';
            statusElement.classList.remove('bg-green-900', 'bg-red-900', 'bg-yellow-900');
            statusElement.classList.add('bg-dark-tertiary');
    }
}

/**
 * Initialize the app state
 */
function initializeAppState() {
    // Load app state from sessionStorage
    window.AppState.loadFromLocalStorage();
    
    // Clear the active contact ID to ensure we start at the dashboard
    window.AppState.activeContactId = null;
    
    // Check if we have a token using our utility function
    const token = window.apiUtils.getAuthToken();
    if (token) {
        window.AppState.token = token;
        
        // Try to get user from sessionStorage using our utility function
        const user = window.apiUtils.getCurrentUser();
        if (user) {
            window.AppState.currentUser = user;
            window.currentUser = user;
            console.log('Restored user session from sessionStorage:', user);
            
            // Don't automatically set active contact
            // Just fetch contacts and messages
            window.fetchContacts = fetchContacts;
            window.fetchContacts('initializeAppState');
            window.fetchOfflineEphemeralMessages = fetchOfflineEphemeralMessages;
            window.fetchOfflineEphemeralMessages();
            window.connectSocket();
        }
    }
}

/**
 * Initialize the application when the DOM is loaded
 */
document.addEventListener('DOMContentLoaded', () => {
    // Add these lines at the beginning of the DOMContentLoaded event handler
    window.CONTACTS_API_URL = 'http://localhost:4000/contacts';
    window.USERS_API_URL = 'http://localhost:4000/users';

    // Initialize app state
    initializeAppState();

    // Initialize UI
    initializeUI();

    // Setup event listeners for onboarding
    const phoneSubmitBtn = document.getElementById('phoneSubmitBtn');
    if (phoneSubmitBtn) {
        phoneSubmitBtn.addEventListener('click', startPhoneLogin);
    }

    const verifyOtpBtn = document.getElementById('verifyButton');
    if (verifyOtpBtn) {
        verifyOtpBtn.addEventListener('click', verifyOtp);
    }

    const usernameSubmitBtn = document.getElementById('usernameSubmitBtn');
    if (usernameSubmitBtn) {
        usernameSubmitBtn.addEventListener('click', submitUsername);
    }

    const bioSubmitBtn = document.getElementById('bioSubmitBtn');
    if (bioSubmitBtn) {
        bioSubmitBtn.addEventListener('click', submitBio);
    }

    const skipBioBtn = document.getElementById('skipBioBtn');
    if (skipBioBtn) {
        skipBioBtn.addEventListener('click', skipBio);
    }

    // Setup event listeners for chat UI
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }

    const addContactBtn = document.getElementById('addContactBtn');
    if (addContactBtn) {
        addContactBtn.addEventListener('click', openAddContactModal);
    }

    const closeAddContactBtn = document.getElementById('closeAddContactBtn');
    if (closeAddContactBtn) {
        closeAddContactBtn.addEventListener('click', closeAddContactModal);
    }

    const searchContactBtn = document.getElementById('searchContactBtn');
    if (searchContactBtn) {
        searchContactBtn.addEventListener('click', searchAndAddContact);
    }

    const chatsTab = document.getElementById('chatsTab');
    if (chatsTab) {
        chatsTab.addEventListener('click', () => toggleSidebarMode('chats'));
    }

    const contactsTab = document.getElementById('contactsTab');
    if (contactsTab) {
        contactsTab.addEventListener('click', () => toggleSidebarMode('contacts'));
    }

    const contactSearchInput = document.getElementById('contactSearchInput');
    if (contactSearchInput) {
        contactSearchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                searchContacts(e.target.value);
            }, 300);
        });
    }

    const sendBtn = document.getElementById('sendMessageBtn');

    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
    }

    const msgInput = document.getElementById('msgInput');
    if (msgInput) {
        msgInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }

    const backButton = document.getElementById('backButton');
    if (backButton) {
        backButton.addEventListener('click', () => {
            window.activeContactId = null;
            refreshChatsUI('main.js:152 (backButton click)');
            document.getElementById('chatContainer').classList.add('hidden');
            document.getElementById('sidebarContainer').classList.remove('hidden');
        });
    }

    // Setup OTP input handling
    setupOtpInputs();

    // Setup modal close on outside click
    setupModalCloseOnOutsideClick();

    // Setup message input
    //setupMessageInput();

    // Set up logout button
    const logoutButton = document.querySelector('a[onclick="logout()"]');
    if (logoutButton) {
        logoutButton.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Logout button clicked');
            if (typeof window.logout === 'function') {
                window.logout();
            } else {
                console.error('Logout function not found');
                // Fallback logout
                localStorage.clear();
                window.location.reload();
            }
        });
    }

    // Initialize message input
    if (typeof window.initializeMessageInput === 'function') {
        window.initializeMessageInput();
    }
});

/**
 * Initialize the UI components
 */
function initializeUI() {
    // Check if user is already logged in
    const token = window.apiUtils?.getAuthToken();
    const currentUser = window.currentUser;

    if (token && currentUser) {
        // User is logged in, show chat screen
        document.getElementById('onboardingContainer').classList.add('hidden');
        document.getElementById('chatScreen').classList.remove('hidden');

        // Update user display
        if (typeof window.updateUserDisplay === 'function') {
            window.updateUserDisplay(currentUser);
        } else {
            const userDisplay = document.getElementById('userDisplay');
            if (userDisplay) {
                userDisplay.textContent = currentUser.username || 'User';
                userDisplay.classList.remove('hidden');
            }
        }

        // Initialize app functions
        try {
            window.fetchContacts('initializeUI');
            window.fetchOfflineEphemeralMessages();
            window.connectSocket();
            window.refreshContactsUI();
            window.refreshChatsUI('main.js:152 (initializeUI)');
        } catch (err) {
            console.error('Error initializing app functions:', err);
        }
    } else {
        // User is not logged in, show onboarding
        document.getElementById('onboardingContainer').classList.remove('hidden');
        document.getElementById('chatScreen').classList.add('hidden');
    }

    // Initialize connection status
    updateConnectionStatus('disconnected');
    
    // Initialize user menu toggle
    initUserMenuToggle();
}

/**
 * Initialize the user menu toggle
 */
function initUserMenuToggle() {
    const userMenuButton = document.getElementById('userMenuButton');
    const userMenu = document.getElementById('userMenu');
    
    if (userMenuButton && userMenu) {
        userMenuButton.addEventListener('click', toggleUserMenu);
        
        // Close menu when clicking outside
        document.addEventListener('click', (event) => {
            if (!userMenuButton.contains(event.target) && !userMenu.contains(event.target)) {
                userMenu.classList.add('hidden');
                userMenu.classList.remove('show');
            }
        });
    }
}

/**
 * Toggle the user menu
 */
function toggleUserMenu() {
    const userMenu = document.getElementById('userMenu');
    if (userMenu) {
        userMenu.classList.toggle('hidden');
        userMenu.classList.toggle('show');
    }
}

/**
 * Setup OTP input handling
 */
function setupOtpInputs() {
    const otpInputs = document.querySelectorAll('.otp-input');
    const hiddenOtpInput = document.getElementById('otpInput');

    otpInputs.forEach((input, index) => {
        // Focus next input on keyup
        input.addEventListener('keyup', (e) => {
            // Skip if not a number key
            if (e.key < '0' || e.key > '9') return;

            // Update the hidden input
            updateHiddenOtpInput();

            // Focus next input
            if (index < otpInputs.length - 1) {
                otpInputs[index + 1].focus();
            }
        });

        // Handle backspace
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace') {
                // If input is empty and not the first input, focus previous
                if (input.value === '' && index > 0) {
                    otpInputs[index - 1].focus();
                }
            }
        });

        // Handle paste
        input.addEventListener('paste', (e) => {
            e.preventDefault();
            const pasteData = e.clipboardData.getData('text');
            const digits = pasteData.replace(/\D/g, '').split('');

            // Fill inputs with pasted digits
            otpInputs.forEach((input, i) => {
                if (i < digits.length) {
                    input.value = digits[i];
                }
            });

            // Update hidden input
            updateHiddenOtpInput();
        });
    });

    function updateHiddenOtpInput() {
        let otp = '';
        otpInputs.forEach(input => {
            otp += input.value;
        });
        hiddenOtpInput.value = otp;
    }
}

// Expose functions to global scope for HTML event handlers
window.startPhoneLogin = startPhoneLogin;
window.verifyOtp = verifyOtp;
window.submitUsername = submitUsername;
window.submitBio = submitBio;
window.skipBio = skipBio;
window.logout = logout;
window.openAddContactModal = openAddContactModal;
window.closeAddContactModal = closeAddContactModal;
window.searchAndAddContact = searchAndAddContact;
window.toggleSidebarMode = toggleSidebarMode;
window.sendMessage = sendMessage;
window.selectContact = selectContact;
window.showMessageDetails = showMessageDetails;
window.closeMessageInfo = closeMessageInfo;
window.showEncryptionInfo = showEncryptionInfo;
window.closeEncryptionInfo = closeEncryptionInfo;
window.connectSocket = connectSocket;
window.closeProfileModal = closeProfileModal;
window.continueFromName = continueFromName;
window.continueFromBio = continueFromBio;
window.refreshContactsUI = refreshContactsUI;
window.refreshChatsUI = refreshChatsUI;

// Additional functions needed for HTML onclick handlers
window.goBackToPhone = function () {
    // Clear any error messages
    const phoneError = document.getElementById('phoneError');
    const otpError = document.getElementById('otpError');
    
    if (phoneError) phoneError.textContent = '';
    if (otpError) otpError.textContent = '';
    
    // Clear OTP inputs
    const otpInputs = document.querySelectorAll('.otp-input');
    const otpHiddenInput = document.getElementById('otpInput');
    
    if (otpInputs.length) {
        otpInputs.forEach(input => {
            input.value = '';
            input.classList.remove('border-purple-primary');
        });
    }
    
    if (otpHiddenInput) otpHiddenInput.value = '';
    
    // Handle both naming conventions for steps
    const stepOTP = document.getElementById('stepOTP');
    const stepPhone = document.getElementById('stepPhone');
    const otpStep = document.getElementById('otpStep');
    const phoneStep = document.getElementById('phoneStep');
    
    // Hide OTP step and show phone step using both naming conventions
    if (stepOTP) stepOTP.classList.add('hidden');
    if (stepPhone) stepPhone.classList.remove('hidden');
    if (otpStep) otpStep.classList.add('hidden');
    if (phoneStep) phoneStep.classList.remove('hidden');
    
    console.log('Going back to phone step');
};

window.goBackToName = function () {
    hideStep('bioStep');
    showStep('usernameStep');
};

window.goBackToContacts = function () {
    // Set activeContactId to null in both window and AppState
    window.activeContactId = null;
    window.AppState.activeContactId = null;
    
    // Refresh UI
    refreshChatsUI('main.js:152 (goBackToContacts)');
    
    // Hide chat container
    const chatContainer = document.getElementById('chatContainer');
    if (chatContainer) {
        chatContainer.classList.add('hidden');
    }
    
    // Show sidebar (correct ID is 'sidebar', not 'sidebarContainer')
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.classList.remove('hidden');
    }
};

window.fillDemoOtp = function () {
    const otpInputs = document.querySelectorAll('.otp-input');
    const demoOtp = '111111'; // Updated to 6-digit OTP

    otpInputs.forEach((input, i) => {
        if (i < demoOtp.length) {
            input.value = demoOtp[i];
        }
    });

    // Update hidden input
    const hiddenOtpInput = document.getElementById('otpInput');
    hiddenOtpInput.value = demoOtp;
};

window.resendOtp = async function () {
    const otpError = document.getElementById('otpError');
    if (otpError) otpError.textContent = '';
    
    // Get the request token from authState in the auth module
    const requestToken = window.authState?.requestToken;
    
    if (!requestToken) {
        if (otpError) otpError.textContent = 'Session expired. Please go back and try again.';
        return;
    }
    
    try {
        // Use the /resend endpoint with the request token in the header
        const res = await fetch('http://localhost:4000/auth/resend', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-otp-request-token': requestToken
            },
            body: JSON.stringify({ 
                phoneNumber: window.authState.phoneNumber 
            })
        });
        
        // Check for a new token in the response headers
        const newRequestToken = res.headers.get('x-otp-request-token');
        if (newRequestToken && window.authState) {
            window.authState.requestToken = newRequestToken;
            console.log('Updated request token from headers:', window.authState.requestToken);
        }
        
        const data = await res.json();
        
        if (data.error) {
            if (otpError) otpError.textContent = data.error;
            return;
        }
        
        // Show success message
        showToast('OTP resent to your phone', 'success');
    } catch (err) {
        console.error('Error resending OTP:', err);
        if (otpError) otpError.textContent = 'Network error. Please try again.';
    }
};

window.clearContactSearch = function () {
    // Handle contact list search
    const contactSearchInput = document.getElementById('contactSearchInput');
    if (contactSearchInput) {
        contactSearchInput.value = '';
        searchContacts('');
    }

    // Handle add contact modal search
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.value = '';
        const initialState = document.getElementById('initialSearchState');
        const searchResults = document.getElementById('searchResults');

        if (initialState) initialState.classList.remove('hidden');
        if (searchResults) {
            searchResults.innerHTML = '';
            searchResults.classList.add('hidden');
        }
    }

    const searchClearBtn = document.getElementById('searchClearBtn');
    if (searchClearBtn) {
        searchClearBtn.classList.add('hidden');
    }
};

// Add this function to show skeleton loading in the search results
window.showSearchSkeletonLoading = function() {
    const resultsElement = document.getElementById('searchResults');
    const initialState = document.getElementById('initialSearchState');
    
    if (initialState) initialState.classList.add('hidden');
    
    let skeletonHTML = '';
    for (let i = 0; i < 3; i++) {
        skeletonHTML += `
        <div class="p-4 border-b border-dark-tertiary">
            <div class="flex items-center">
                <div class="skeleton skeleton-pic mr-3"></div>
                <div class="flex-1">
                    <div class="skeleton skeleton-name mb-2"></div>
                    <div class="skeleton skeleton-message"></div>
                </div>
                <div class="skeleton" style="width: 50px; height: 30px; border-radius: 4px;"></div>
            </div>
        </div>`;
    }
    
    resultsElement.classList.remove('hidden');
    resultsElement.innerHTML = skeletonHTML;
};

// Modify the liveContactSearch function to use skeleton loading
window.liveContactSearch = async function () {
    const searchInput = document.getElementById('searchInput');
    const searchClearBtn = document.getElementById('searchClearBtn');
    const initialState = document.getElementById('initialSearchState');
    const resultsElement = document.getElementById('searchResults');
    const errorElement = document.getElementById('contactAddError');
    const noResultsState = document.getElementById('noResultsState');

    if (searchInput && searchClearBtn) {
        const query = searchInput.value.trim();

        // Show/hide the clear button based on input content
        if (query !== '') {
            searchClearBtn.classList.remove('hidden');
            if (initialState) initialState.classList.add('hidden');
            if (noResultsState) noResultsState.classList.add('hidden');

            // Only search if query is at least 3 characters
            if (query.length >= 3) {
                errorElement.classList.remove('hidden');
                errorElement.textContent = '';
                
                // Show skeleton loading instead of spinner
                window.showSearchSkeletonLoading();

                try {
                    // Check if we have a valid user and token
                    if (!window.currentUser || !window.currentUser._id) {
                        throw new Error('User not logged in');
                    }

                    // Use the correct endpoint with the proper URL
                    const searchUrl = `${window.CONTACTS_API_URL}/search?userId=${window.currentUser._id}&searchTerm=${encodeURIComponent(query)}`;
                    console.log('Searching contacts with URL:', searchUrl);
                    
                    const response = await fetch(searchUrl, {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${window.apiUtils.getAuthToken()}`
                        }
                    });
                    
                    if (!response.ok) {
                        throw new Error(`Search failed with status: ${response.status}`);
                    }
                    
                    const data = await response.json();

                    if (!data.users || data.users.length === 0) {
                        resultsElement.classList.add('hidden');
                        resultsElement.innerHTML = '<div class="p-4 text-center text-gray-400">No users found with that phone number or username</div>';
                        return;
                    }

                    // Display found users
                    let resultsHTML = '';
                    data.users.forEach(user => {
                        // Check if user is already a contact
                        const isAlreadyContact = window.contactsState.contacts.some(c => c._id === user._id);
                        
                        const initials = user.username ? user.username.split(' ').map(n => n[0]).join('').toUpperCase() : '';
                        resultsHTML += `
                          <div class="p-4 border-b border-dark-tertiary">
                            <div class="flex items-center">
                              <div class="profile-pic mr-3">
                                ${user.profilePicture ? `<img src="${user.profilePicture}" alt="${user.username}" class="w-full h-full object-cover rounded-full">` : `<div class="w-full h-full flex items-center justify-center bg-purple-primary rounded-full">${initials}</div>`}
                              </div>
                              <div class="flex-1">
                                <h3 class="font-medium">${user.username || 'User'}</h3>
                                <p class="text-sm text-gray-400">${user.anonId || ''}</p>
                              </div>
                              <button class="btn btn-primary btn-sm view-profile-btn" data-user-id="${user._id}" data-user-name="${user.username || 'User'}" data-user-phone="${user.anonId || ''}" data-user-bio="${user.bio || ''}" data-user-pic="${user.profilePicture || ''}">
                                View Profile
                              </button>
                            </div>
                          </div>
                        `;
                    });

                    if (resultsHTML === '') {
                        resultsElement.innerHTML = '<div class="p-4 text-center text-gray-400">No users found</div>';
                    } else {
                        resultsElement.innerHTML = resultsHTML;

                        // Add event listeners to all "View Profile" buttons
                        document.querySelectorAll('.view-profile-btn').forEach(btn => {
                            btn.addEventListener('click', (e) => {
                                const userId = e.target.getAttribute('data-user-id');
                                const userName = e.target.getAttribute('data-user-name');
                                const userPhone = e.target.getAttribute('data-user-phone');
                                const userBio = e.target.getAttribute('data-user-bio');
                                const userPic = e.target.getAttribute('data-user-pic');
                                
                                // Close the add contact modal
                                closeAddContactModal();
                                
                                // Show the user profile
                                showUserProfileFromSearch(userId, userName, userPhone, userBio, userPic);
                            });
                        });
                    }
                } catch (error) {
                    console.error('Error searching for users:', error);
                    resultsElement.innerHTML = '<div class="p-4 text-center text-red-500">Error searching for users. Please try again.</div>';
                }
            }
        } else {
            searchClearBtn.classList.add('hidden');
            if (initialState) initialState.classList.remove('hidden');
            if (resultsElement) resultsElement.classList.add('hidden');
        }
    }
};

/**
 * Show user profile from search results
 * @param {string} userId - User ID
 * @param {string} userName - User name
 * @param {string} userPhone - User phone number
 * @param {string} userBio - User bio
 * @param {string} userPic - User profile picture URL
 */
function showUserProfileFromSearch(userId, userName, userPhone, userBio, userPic) {
    // Get the modal elements
    const modal = document.getElementById('contactProfileModal');
    const profilePic = document.getElementById('profileModalPic');
    const profileName = document.getElementById('profileModalName');
    const profilePhone = document.getElementById('profileModalPhone');
    const profileBio = document.getElementById('profileModalBio');
    const profileLastSeen = document.getElementById('profileModalLastSeen');
    const messageBtn = document.getElementById('messageContactBtn');
    const removeBtn = document.getElementById('removeContactModalBtn');
    
    // Check if this user is already a contact
    const isAlreadyContact = window.contactsState.contacts.some(c => c._id === userId);
    
    // Set the profile picture
    const initials = userName ? userName.split(' ').map(n => n[0]).join('').toUpperCase() : '';
    profilePic.innerHTML = userPic 
        ? `<img src="${userPic}" alt="${userName}" class="w-full h-full object-cover rounded-full">` 
        : initials;
    
    // Set the contact details
    profileName.textContent = userName || 'Unknown';
    profilePhone.textContent = userPhone || '';
    
    // Set the bio (with fallback)
    profileBio.textContent = userBio || 'No bio available';
    
    // Set last seen
    profileLastSeen.textContent = 'Unknown';
    
    // Change button text based on whether user is already a contact
    if (isAlreadyContact) {
        messageBtn.innerHTML = '<i class="fas fa-comment mr-2"></i> Message';
        messageBtn.onclick = () => {
            modal.classList.add('hidden');
            modal.classList.remove('active');
            window.selectContact(userId);
        };
        
        removeBtn.innerHTML = '<i class="fas fa-user-minus mr-2"></i> Remove';
        removeBtn.onclick = () => {
            modal.classList.add('hidden');
            modal.classList.remove('active');
            
            // Show confirmation dialog
            Swal.fire({
                title: 'Remove Contact',
                text: `Are you sure you want to remove ${userName} from your contacts?`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#f44336',
                cancelButtonColor: '#333',
                confirmButtonText: 'Yes, remove',
                background: '#1e1e1e',
                color: '#fff'
            }).then((result) => {
                if (result.isConfirmed) {
                    window.removeContact(userId);
                }
            });
        };
    } else {
        messageBtn.innerHTML = '<i class="fas fa-user-plus mr-2"></i> Add Contact';
        messageBtn.onclick = async () => {
            modal.classList.add('hidden');
            modal.classList.remove('active');
            await window.addContactById(userId);
        };
        
        removeBtn.innerHTML = '<i class="fas fa-times mr-2"></i> Cancel';
        removeBtn.onclick = () => {
            modal.classList.add('hidden');
            modal.classList.remove('active');
        };
    }
    
    // Show the modal
    modal.classList.remove('hidden');
    modal.classList.add('active');
}

// Add to window object
window.showUserProfileFromSearch = showUserProfileFromSearch;

// Add toggleTab function that calls toggleSidebarMode
window.toggleTab = function (tab) {
    // Update active tab styling
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active-tab');
    });
    document.getElementById(`${tab}Tab`).classList.add('active-tab');

    // Show/hide content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.add('hidden');
    });
    document.getElementById(`${tab}Content`).classList.remove('hidden');

    // Also call toggleSidebarMode for additional functionality
    window.toggleSidebarMode(tab);
};

// Expose the updateConnectionStatus function to the window object
window.updateConnectionStatus = updateConnectionStatus;

// Expose the initializeUI function to the window object
window.initializeUI = initializeUI;

// Expose the addContactById function to the window object
window.addContactById = addContactById;

// Expose state objects to the window object
window.contactsState = contactsState;

// Add this function to handle back button clicks
function handleBackButton() {
    // Hide the chat area
    document.getElementById('chatAreaBox').classList.add('hidden');
    document.getElementById('emptyChatPlaceholder').classList.remove('hidden');
    
    // Clear the active contact
    window.AppState.setActiveContact(null);
    
    // Update UI
    refreshContactsUI();
    refreshChatsUI('main.js:152 (handleBackButton)');
    
    // Blur any active input fields
    document.activeElement.blur();
}

// Add event listener to back button
document.getElementById('backButton').addEventListener('click', handleBackButton);

// Call this function on page load
document.addEventListener('DOMContentLoaded', initializeAppState);

// Add this debug function
window.checkAuthStatus = function() {
    const tokenInSession = sessionStorage.getItem('authToken');
    const userInSession = sessionStorage.getItem('currentUser');
    const appStateInSession = sessionStorage.getItem('appState');
    
    const tokenInLocal = localStorage.getItem('token') || localStorage.getItem('authToken');
    const userInLocal = localStorage.getItem('currentUser');
    const appStateInLocal = localStorage.getItem('appState');
    
    console.log('Auth status check:');
    console.log('- Token in sessionStorage:', tokenInSession ? 'Present' : 'Not found');
    console.log('- User in sessionStorage:', userInSession ? 'Present' : 'Not found');
    console.log('- AppState in sessionStorage:', appStateInSession ? 'Present' : 'Not found');
    console.log('- Token in localStorage:', tokenInLocal ? 'Present' : 'Not found');
    console.log('- User in localStorage:', userInLocal ? 'Present' : 'Not found');
    console.log('- AppState in localStorage:', appStateInLocal ? 'Present' : 'Not found');
    console.log('- Token in AppState:', window.AppState?.token ? 'Present' : 'Not found');
    console.log('- User in AppState:', window.AppState?.currentUser ? 'Present' : 'Not found');
    
    return {
        tokenInSessionStorage: !!tokenInSession,
        userInSessionStorage: !!userInSession,
        appStateInSessionStorage: !!appStateInSession,
        tokenInLocalStorage: !!tokenInLocal,
        userInLocalStorage: !!userInLocal,
        appStateInLocalStorage: !!appStateInLocal,
        tokenInAppState: !!window.AppState?.token,
        userInAppState: !!window.AppState?.currentUser
    };
};

// Also add to the window object exports:
window.initializeMessageInput = initializeMessageInput;

// Expose additional functions to the window object
window.liveContactSearch = liveContactSearch;
window.clearContactSearch = clearContactSearch;
window.addContactById = addContactById;
window.CONTACTS_API_URL = 'http://localhost:4000/contacts';
window.USERS_API_URL = 'http://localhost:4000/users';

// Add a debug function to check if the modal is working
window.debugModal = function() {
    const modal = document.getElementById('addContactModal');
    console.log('Modal element:', modal);
    console.log('Modal classes:', modal.className);
    
    // Try to open the modal
    console.log('Attempting to open modal...');
    modal.classList.remove('hidden');
    modal.classList.add('active');
    
    // Check if the modal is visible
    setTimeout(() => {
        console.log('Modal classes after opening:', modal.className);
        console.log('Modal visibility:', window.getComputedStyle(modal).visibility);
        console.log('Modal opacity:', window.getComputedStyle(modal).opacity);
    }, 500);
};

// In the connectSocket function, after setting up the socket
function setupSocketEventHandlers() {
    // Remove any existing handlers first
    if (window.socket) {
        window.socket.removeAllListeners('ephemeral_message');
        window.socket.removeAllListeners('user_status');
        // Remove other listeners as needed
        
        // Set up the handlers once
        window.socket.on('ephemeral_message', async (data) => {
            console.log('Received ephemeral message:', data);
            await handleIncomingEphemeral(data);
        });
        
        window.socket.on('user_status', (data) => {
            console.log('User status update:', data);
            // Update contact status
            // ...
        });
        
        // Other event handlers
    }
}

// Initialize window focus state
window.isWindowFocused = document.hasFocus();

// Handle window focus/blur for online status and message acknowledgment
window.addEventListener('focus', () => {
    window.isWindowFocused = true;
    
    // Update online status
    if (window.socket && window.socket.connected) {
        window.socket.emit('user_status', { status: 'online' });
    }
    
    // If in a chat, mark messages as read now that window is focused
    if (window.AppState.activeContactId && typeof window.markMessagesAsRead === 'function') {
        window.markMessagesAsRead(window.AppState.activeContactId);
    }
});

window.addEventListener('blur', () => {
    window.isWindowFocused = false;
    
    // Update online status
    if (window.socket && window.socket.connected) {
        window.socket.emit('user_status', { status: 'away' });
    }
});

// Expose functions to window object
window.selectContact = selectContact;
window.refreshContactsUI = refreshContactsUI;
window.refreshChatsUI = refreshChatsUI;
window.toggleTab = toggleTab;
window.searchContacts = searchContacts;
window.openAddContactModal = openAddContactModal;
window.closeAddContactModal = closeAddContactModal;
window.addContactById = addContactById;
window.removeContact = removeContact;
window.openContactProfileModal = openContactProfileModal;
window.closeContactProfileModal = closeContactProfileModal;
window.showUserProfileFromSearch = showUserProfileFromSearch;
window.toggleUserMenu = toggleUserMenu;
window.closeWelcomeModal = function() {
    const modal = document.getElementById('welcomeModal');
    if (modal) {
        modal.classList.add('hidden');
    }
};

// Add missing functions
window.showUserProfile = function() {
    // Close the user menu
    toggleUserMenu();
    
    // TODO: Implement user profile modal
    showToast('User profile feature coming soon!', 'info');
};

window.showUserSettings = function() {
    // Close the user menu
    toggleUserMenu();
    
    // TODO: Implement settings modal
    showToast('Settings feature coming soon!', 'info');
};

window.handleLogout = function() {
    // Close the user menu
    toggleUserMenu();
    
    // Show confirmation dialog
    Swal.fire({
        title: 'Logout',
        text: 'Are you sure you want to logout?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#8a2be2',
        cancelButtonColor: '#333',
        confirmButtonText: 'Yes, logout',
        background: '#1e1e1e',
        color: '#fff'
    }).then((result) => {
        if (result.isConfirmed) {
            logout();
        }
    });
};
