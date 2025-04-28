/**
 * contacts.js - Contact management and UI functionality
 */

import { currentUser, showToast } from './core.js';
import { markMessagesAsRead, showMessageDetails } from './messaging.js';
import { contactsState, renderChatMessages, fetchUserById } from './shared.js';

// Export the contactsState for other modules
export { contactsState };

// API endpoint constants
const CONTACTS_API_URL = 'http://localhost:4000/contacts';
const USERS_API_URL = 'http://localhost:4000/users';

// Add a flag to prevent duplicate fetches
let isFetchingContacts = false;

/**
 * Fetch contacts from the server.
 */
async function fetchContacts(caller = 'unknown') {
    console.log('fetchContacts called from:', caller);
    
    // Check if already fetching
    if (isFetchingContacts) {
        console.log('Already fetching contacts, skipping duplicate call');
        return;
    }
    
    isFetchingContacts = true;
    
    try {
        if (!window.currentUser?._id) {
            console.error('No current user ID available');
            return;
        }

        // Show skeleton loading state for contacts and chats lists
        showContactsSkeletonLoading();

        // Fetch contacts from the server
        const response = await window.apiUtils.apiGet(`${CONTACTS_API_URL}?userId=${window.currentUser._id}`);
        if (!response || !response.contacts) {
            throw new Error('Failed to fetch contacts');
        }

        const contactsData = response.contacts;
        const mappedContacts = contactsData.map(contact => ({
            _id: contact._id,
            name: contact.username || contact.anonId || contact.phoneNumber,
            anonId: contact.anonId,
            phoneNumber: contact.phoneNumber,
            bio: contact.bio || '',
            pfp: contact.profilePicture || '',
            messages: contact.messages || [],
            lastMessage: contact.lastMessage || '',
            unreadCount: contact.unreadCount || 0,
            lastSeen: contact.lastSeen || null,
            isBlocked: contact.isBlocked || false
        }));

        console.log('Fetched contacts:', mappedContacts);

        // Update AppState with the new contacts - check for duplicates
        const uniqueContacts = [];
        const contactIds = new Set();

        // Filter out duplicates based on _id
        for (const contact of mappedContacts) {
            if (!contactIds.has(contact._id)) {
                contactIds.add(contact._id);
                uniqueContacts.push(contact);
            }
        }

        window.AppState.contacts = uniqueContacts;
        window.AppState.saveToLocalStorage();  // if you want to persist the state

        // Also update your local contactsState if needed:
        contactsState.contacts = uniqueContacts;

        // Refresh UI
        refreshContactsUI();
        refreshChatsUI('contacts.js:67 (after fetchContacts)');
    } catch (error) {
        console.error('Error fetching contacts:', error);
        document.getElementById('contactsList').innerHTML = '<div class="p-4 text-center text-red-500"><i class="fas fa-exclamation-circle mr-2"></i> Failed to load contacts</div>';
        document.getElementById('recentChatsList').innerHTML = '<div class="p-4 text-center text-red-500"><i class="fas fa-exclamation-circle mr-2"></i> Failed to load chats</div>';
        showToast('Failed to load contacts. Please try again.', 'error');
    } finally {
        isFetchingContacts = false;
    }
}

/**
 * Fetch user by ID.
 */

/**
 * Refresh the contacts UI.
 */
let refreshContactsUITimeout = null;
function refreshContactsUI() {
    // Debounce the function to prevent multiple rapid calls
    if (refreshContactsUITimeout) {
        clearTimeout(refreshContactsUITimeout);
    }
    
    refreshContactsUITimeout = setTimeout(() => {
        _refreshContactsUI();
    }, 50);
}

// Move the actual implementation to a private function
function _refreshContactsUI() {
    console.log('Refreshing contacts UI...');
    const contactsList = document.getElementById('contactsList');
    const recentChatsList = document.getElementById('recentChatsList');
    if (!contactsList || !recentChatsList) return;

    // Clear existing lists
    contactsList.innerHTML = '';
    recentChatsList.innerHTML = '';

    if (!contactsState.contacts.length) {
        contactsList.innerHTML = '<div class="p-4 text-center text-gray-400">No contacts yet</div>';
        recentChatsList.innerHTML = '<div class="p-4 text-center text-gray-400">No chats yet</div>';
        return;
    }

    // Sort contacts by last message time (most recent first)
    const sortedContacts = [...contactsState.contacts].sort((a, b) => {
        const aTime = (a.messages && a.messages.length > 0) ?
            new Date(a.messages[a.messages.length - 1].time) : new Date(0);
        const bTime = (b.messages && b.messages.length > 0) ?
            new Date(b.messages[b.messages.length - 1].time) : new Date(0);
        return bTime - aTime;
    });

    // Create separate arrays for regular contacts and unknown contacts
    const regularContacts = sortedContacts.filter(contact => !contact.isNotInContacts);
    const unknownContacts = sortedContacts.filter(contact => contact.isNotInContacts);
    
    // Display regular contacts as usual
    if (regularContacts.length === 0 && unknownContacts.length === 0) {
        contactsList.innerHTML = '<div class="p-4 text-center text-gray-400">No contacts yet</div>';
        recentChatsList.innerHTML = '<div class="p-4 text-center text-gray-400">No chats yet</div>';
    } else {
        // Create and append contact items
        regularContacts.forEach(contact => {
            const contactItem = document.createElement('div');
            contactItem.className = `contact-item ${contact._id === contactsState.activeContactId ? 'active' : ''}`;
            contactItem.setAttribute('data-id', contact._id);
            contactItem.addEventListener('click', () => {
                // Only set active contact when explicitly clicked
                window.selectContact(contact._id);
            });

            // Get initials for profile picture fallback
            const initials = contact.name ? contact.name.split(' ').map(n => n[0]).join('').toUpperCase() : '';
            contactItem.innerHTML = `
              <div class="profile-pic">
                ${contact.pfp ? `<img src="${contact.pfp}" alt="${contact.name}" class="w-full h-full object-cover rounded-full">` : initials}
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex justify-between items-center">
                  <h3 class="font-medium truncate">${contact.name}</h3>
                  ${contact.unreadCount ? `<span class="bg-purple-primary text-white text-xs rounded-full px-2 py-1 ml-2">${contact.unreadCount}</span>` : ''}
                </div>
              </div>
              <button class="three-dots-menu" onclick="event.stopPropagation(); openContactProfileModal('${contact._id}')">
                <i class="fas fa-ellipsis-v"></i>
              </button>
            `;
            contactsList.appendChild(contactItem);

            // Append to recent chats if there are messages
            if (contact.messages && contact.messages.length > 0) {
                const chatItem = document.createElement('div');
                chatItem.className = `contact-item ${contact._id === contactsState.activeContactId ? 'active' : ''}`;
                chatItem.setAttribute('data-id', contact._id);
                chatItem.addEventListener('click', () => {
                    // Only set active contact when explicitly clicked
                    window.selectContact(contact._id);
                });
                chatItem.innerHTML = `
                  <div class="profile-pic">
                    ${contact.pfp ? `<img src="${contact.pfp}" alt="${contact.name}" class="w-full h-full object-cover rounded-full">` : initials}
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex justify-between items-center">
                      <h3 class="font-medium truncate">${contact.name}</h3>
                      ${contact.unreadCount ? `<span class="bg-purple-primary text-white text-xs rounded-full px-2 py-1 ml-2">${contact.unreadCount}</span>` : ''}
                    </div>
                    <p class="text-gray-400 text-sm truncate">${contact.lastMessage || 'No messages yet'}</p>
                  </div>
                  <button class="three-dots-menu" onclick="event.stopPropagation(); openContactProfileModal('${contact._id}')">
                    <i class="fas fa-ellipsis-v"></i>
                  </button>
                `;
                recentChatsList.appendChild(chatItem);
            }
        });
        
        // Display unknown contacts chats as normal items (skip fancy card)
        unknownContacts.forEach(contact => {
            if (contact.messages && contact.messages.length > 0) {
                const chatItem = document.createElement('div');
                chatItem.className = `contact-item ${contact._id === contactsState.activeContactId ? 'active' : ''}`;
                chatItem.setAttribute('data-id', contact._id);
                chatItem.addEventListener('click', () => window.selectContact(contact._id));

                const initials = (contact.name || '').split(' ').map(n=>n[0]).join('').toUpperCase();
                chatItem.innerHTML = `<div class="profile-pic">${contact.pfp?`<img src="${contact.pfp}" class="w-full h-full object-cover rounded-full">`:initials}</div>
                <div class="flex-1 min-w-0"><div class="flex justify-between items-center"><h3 class="font-medium truncate">${contact.name}</h3><span class="bg-purple-primary text-white text-xs rounded-full px-2 py-1 ml-2">${contact.unreadCount||''}</span></div><p class="text-gray-400 text-sm truncate">${contact.lastMessage||'New message'}</p></div>`;
                recentChatsList.appendChild(chatItem);
            }
        });
    }

    // Make sure contactsState is in sync with AppState
    if (window.AppState && window.AppState.contacts) {
        contactsState.contacts = [...window.AppState.contacts];
    }
}

/**
 * Refreshes the chat UI based on the active contact
 * @param {string} caller - The name of the function or file that called refreshChatsUI
 */
function refreshChatsUI(caller = 'unknown') {
    // Use the logging function if available
    if (typeof window.logRefreshChatsUI === 'function') {
        window.logRefreshChatsUI(caller || 'contacts.js');
    } else {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] refreshChatsUI called from: ${caller || 'contacts.js'}`);
        console.log('Call stack:', new Error().stack);
    }
    
    console.log('Refreshing chats UI...');

    // Get UI elements
    const chatHeader = document.getElementById('chatHeader');
    const emptyChatPlaceholder = document.getElementById('emptyChatPlaceholder');
    const chatContainer = document.getElementById('chatContainer');
    const chatAreaBox = document.getElementById('chatAreaBox');
    const chatArea = document.getElementById('chatArea');
    const backButton = document.getElementById('backButton');

    // Log elements found
    console.log('UI elements:', {
        chatHeader: !!chatHeader,
        emptyChatPlaceholder: !!emptyChatPlaceholder,
        chatContainer: !!chatContainer,
        chatAreaBox: !!chatAreaBox,
        chatArea: !!chatArea,
        backButton: !!backButton
    });

    // Get active contact ID from AppState
    const activeContactId = window.AppState.activeContactId;
    console.log('Active contact ID from AppState:', activeContactId);

    // If no active contact, show empty state
    if (!activeContactId) {
        console.log('No active contact, showing empty state');

        // Show empty chat placeholder
        if (emptyChatPlaceholder) emptyChatPlaceholder.classList.remove('hidden');

        // Hide chat elements
        if (chatHeader) chatHeader.classList.add('hidden');
        if (chatContainer) chatContainer.classList.add('hidden');
        if (chatAreaBox) chatAreaBox.classList.add('hidden');
        
        // Hide back button when not in chat
        if (backButton) backButton.classList.add('hidden');

        // Show chat area (needed for empty state)
        if (chatArea) chatArea.classList.remove('hidden');
        return;
    }

    // Find active contact from AppState
    const activeContact = window.AppState.contacts.find(c => c._id === activeContactId);
    if (!activeContact) {
        console.error('Active contact not found in contacts list');
        return;
    }

    console.log('Found active contact:', activeContact.name);

    // Show chat area and hide empty placeholder
    if (chatArea) chatArea.classList.remove('hidden');
    if (emptyChatPlaceholder) emptyChatPlaceholder.classList.add('hidden');
    
    // Show back button when in chat
    if (backButton) backButton.classList.remove('hidden');

    // Update chat header
    if (chatHeader) {
        chatHeader.classList.remove('hidden');
        
        // Show back button when in chat
        if (backButton) backButton.classList.remove('hidden');

        // Update contact info
        const chatTitle = document.getElementById('chatTitle');
        const chatSubtitle = document.getElementById('chatSubtitle');
        const chatContactPic = document.getElementById('chatContactPic');

        if (chatTitle) {
            // For unknown contacts, show "Unknown" with their anonId
            if (activeContact.isNotInContacts) {
                const displayId = activeContact.anonId || (activeContact.phoneNumber ? activeContact.phoneNumber.slice(-8) : 'Unknown');
                chatTitle.innerHTML = `
                    <div class="flex items-center">
                        <span>Unknown (${displayId})</span>
                        <span class="ml-2 text-yellow-500" title="Unverified sender">
                            <i class="fas fa-shield-alt"></i>
                        </span>
                    </div>
                `;
            } else {
                chatTitle.textContent = activeContact.name || 'Unknown Contact';
            }
        }
        
        if (chatSubtitle) {
            if (activeContact.isNotInContacts) {
                chatSubtitle.innerHTML = `
                    <span class="text-yellow-500 flex items-center">
                        <i class="fas fa-exclamation-triangle mr-1.5 text-xs"></i>
                        <span>Unverified sender</span>
                    </span>
                `;
            } else {
                chatSubtitle.textContent = activeContact.online ? 'Online' :
                    activeContact.lastSeen ? `Last seen ${formatLastSeen(activeContact.lastSeen)}` :
                        'Offline';
            }
        }
        
        if (chatContactPic) {
            if (activeContact.isNotInContacts) {
                // For unknown contacts, use a special profile pic with warning colors
                const displayId = activeContact.anonId || (activeContact.phoneNumber ? activeContact.phoneNumber.slice(-8) : 'Unknown');
                const initials = displayId.slice(0, 2).toUpperCase();
                chatContactPic.innerHTML = activeContact.pfp ?
                    `<img src="${activeContact.pfp}" alt="Unknown" class="w-full h-full rounded-full">` :
                    `<div class="w-full h-full rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 text-gray-900 flex items-center justify-center font-bold">${initials}</div>`;
            } else {
                chatContactPic.innerHTML = activeContact.pfp ?
                    `<img src="${activeContact.pfp}" alt="${activeContact.name}" class="w-full h-full rounded-full">` :
                    '<i class="fas fa-user"></i>';
            }
        }
    }

    // Show chat container and input
    if (chatContainer) chatContainer.classList.remove('hidden');
    if (chatAreaBox) chatAreaBox.classList.remove('hidden');

    // Add security alert banner for unknown contacts
    const existingAlert = document.getElementById('securityAlertBanner');
    if (existingAlert) {
        existingAlert.remove();
    }

    if (activeContact.isNotInContacts) {
        // Create security alert banner
        const alertBanner = document.createElement('div');
        alertBanner.id = 'securityAlertBanner';
        alertBanner.className = 'security-alert-banner';
        
        // Get the anonId or a fallback
        const displayId = activeContact.anonId || (activeContact.phoneNumber ? activeContact.phoneNumber.slice(-8) : 'Unknown');
        
        alertBanner.innerHTML = `
            <div class="security-alert-content">
                <div class="security-alert-icon">
                    <i class="fas fa-shield-alt"></i>
                </div>
                <div class="security-alert-text">
                    This is an <strong>unverified sender</strong> with ID ${displayId}. 
                    Exercise caution with any links or requests.
                </div>
            </div>
            <div class="security-alert-actions">
                <button class="security-alert-btn security-alert-btn-primary" onclick="addContactById('${activeContact._id}')">
                    <i class="fas fa-user-plus mr-1"></i> Add Contact
                </button>
                <button class="security-alert-btn security-alert-btn-secondary" onclick="blockContact('${activeContact._id}')">
                    <i class="fas fa-ban mr-1"></i> Block
                </button>
            </div>
        `;
        
        // Insert at the top of the chat messages
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            chatMessages.insertAdjacentElement('afterbegin', alertBanner);
        }
    }

    // Render messages
    renderChatMessages();
}

/**
 * Format message date
 */
function formatMessageDate(date) {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
        return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
    } else {
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
        });
    }
}

/**
 * Format message time
 */
function formatMessageTime(timestamp) {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const now = new Date();
    
    // If today, show time
    if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // If this year, show month and day
    if (date.getFullYear() === now.getFullYear()) {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
    
    // Otherwise show date
    return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Format last seen time
 */
function formatLastSeen(timeStr) {
    const lastSeen = new Date(timeStr);
    const now = new Date();
    const diffMinutes = Math.floor((now - lastSeen) / 1000 / 60);

    if (diffMinutes < 1) return 'just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;

    return lastSeen.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
    });
}

/**
 * Get message status icon
 */
function getMessageStatusIcon(status) {
    switch (status) {
        case 'pending':
            return '<i class="fas fa-clock"></i>';
        case 'sent':
            return '<i class="fas fa-check"></i>';
        case 'delivered':
            return '<i class="fas fa-check-double"></i>';
        case 'read':
            return '<i class="fas fa-check-double text-blue-400"></i>';
        case 'failed':
            return '<i class="fas fa-exclamation-circle text-red-500"></i>';
        default:
            return '';
    }
}

/**
 * Select a contact
 * @param {string} contactId - The ID of the contact to select
 */
function selectContact(contactId) {
    console.log('Selecting contact:', contactId);
    
    // Set active contact in AppState
    window.AppState.activeContactId = contactId;
    window.AppState.saveToLocalStorage();
    
    // Get the contact
    const contact = window.AppState.contacts.find(c => c._id === contactId);
    if (!contact) {
        console.error('Contact not found:', contactId);
        return;
    }
    
    // Only acknowledge messages if window is focused AND user has clicked on the chat
    if (window.isWindowFocused) {
        console.log('Acknowledging messages for contact:', contactId);
        
        // Reset unread count
        contact.unreadCount = 0;
        
        // Acknowledge pending messages
        if (contact.pendingAcks && contact.pendingAcks.length > 0) {
            console.log('Acknowledging pending messages:', contact.pendingAcks.length);
            
            // Acknowledge each pending message
            if (typeof window.ackEphemeralMessage === 'function') {
                contact.pendingAcks.forEach(messageId => {
                    window.ackEphemeralMessage(messageId);
                });
                
                // Clear the pending acknowledgments
                contact.pendingAcks = [];
            } else {
                console.error('ackEphemeralMessage function not available');
            }
        }
        
        window.AppState.saveToLocalStorage();
    } else {
        console.log('Window not focused, not acknowledging messages for contact:', contactId);
    }
    
    // Refresh UI (using debounced version)
    refreshContactsUI();
    refreshChatsUI('contacts.js (selectContact)');
    
    // Render chat messages
    if (typeof window.renderChatMessages === 'function') {
        window.renderChatMessages();
    }
}

/**
 * View a contact's profile.
 */
function viewContactProfile(contactId) {
    const contact = contactsState.contacts.find(c => c._id === contactId);
    if (!contact) return;

    const modal = document.getElementById('contactProfileModal');
    const content = document.getElementById('contactProfileContent');
    const initials = contact.name ? contact.name.split(' ').map(n => n[0]).join('').toUpperCase() : '';

    content.innerHTML = `
      <div class="text-center mb-6">
        <div class="profile-pic mx-auto mb-4" style="width: 80px; height: 80px;">
          ${contact.pfp ? `<img src="${contact.pfp}" alt="${contact.name}" class="w-full h-full object-cover rounded-full">`
            : `<div class="w-full h-full flex items-center justify-center bg-purple-primary rounded-full text-2xl">${initials}</div>`}
        </div>
        <h2 class="text-xl font-medium">${contact.name}</h2>
        <p class="text-gray-400">${contact.anonId || contact.phoneNumber || ''}</p>
      </div>
      
      ${contact.bio ? `
      <div class="mb-6">
        <h3 class="text-sm text-gray-400 mb-2">Bio</h3>
        <p>${contact.bio}</p>
      </div>
      ` : ''}
      
      <div class="flex justify-between">
        <button id="messageContactBtn" class="btn btn-primary">
          <i class="fas fa-comment mr-2"></i> Message
        </button>
        <button id="removeContactModalBtn" class="btn btn-danger">
          <i class="fas fa-user-minus mr-2"></i> Remove
        </button>
      </div>
    `;

    modal.classList.remove('hidden');

    // Setup modal buttons
    document.getElementById('messageContactBtn').addEventListener('click', () => {
        modal.classList.add('hidden');
        selectContact(contactId);
    });
    document.getElementById('removeContactModalBtn').addEventListener('click', () => {
        modal.classList.add('hidden');
        removeContact(contactId);
    });
}

/**
 * Clear the chat history for a given contact.
 */
function clearChat(contactId) {
    Swal.fire({
        title: 'Clear chat history?',
        text: 'This will delete all messages in this chat. This action cannot be undone.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Clear',
        confirmButtonColor: '#d33',
        cancelButtonText: 'Cancel',
        background: '#1e1e2e',
        color: '#fff'
    }).then((result) => {
        if (result.isConfirmed) {
            const contact = contactsState.contacts.find(c => c._id === contactId);
            if (!contact) return;
            contact.messages = [];
            contact.lastMessage = '';
            contact.unreadCount = 0;
            refreshChatsUI('contacts.js:593 (clearChat)');
            refreshContactsUI();
            showToast('Chat history cleared', 'success');
        }
    });
}

/**
 * Remove a contact.
 */
function removeContact(contactId) {
    Swal.fire({
        title: 'Remove contact?',
        text: 'This will remove the contact and delete all messages. This action cannot be undone.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Remove',
        confirmButtonColor: '#d33',
        cancelButtonText: 'Cancel',
        background: '#1e1e2e',
        color: '#fff'
    }).then((result) => {
        if (result.isConfirmed) {
            removeContactViaBackend(contactId);
        }
    });
}

/**
 * Remove contact via backend API.
 */
async function removeContactViaBackend(contactId) {
    try {
        // Get the token from apiUtils
        const token = window.apiUtils ? window.apiUtils.getAuthToken() : sessionStorage.getItem('authToken');
        
        const res = await fetch(`${CONTACTS_API_URL}/${contactId}?userId=${window.currentUser._id}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : ''
            }
        });
        const data = await res.json();
        if (data.error) {
            alert('Remove contact error: ' + data.error);
        } else {
            contactsState.contacts = contactsState.contacts.filter(c => c._id !== contactId);
            refreshContactsUI();
            refreshChatsUI('contacts.js:642 (removeContact)');
            if (contactsState.activeContactId === contactId) {
                contactsState.activeContactId = null;
                document.getElementById('chatMessages').innerHTML = '';
            }
        }
    } catch (err) {
        console.error('removeContactViaBackend error:', err);
    }
}

/**
 * Open the "add contact" modal.
 */
function openAddContactModal() {
    console.log('Opening add contact modal');
    const modal = document.getElementById('addContactModal');
    const searchInput = document.getElementById('searchInput');
    
    // Reset search input
    if (searchInput) searchInput.value = '';
    
    // Reset UI elements
    const searchResults = document.getElementById('searchResults');
    if (searchResults) {
        searchResults.innerHTML = '';
        searchResults.classList.add('hidden');
    }
    
    const contactAddError = document.getElementById('contactAddError');
    if (contactAddError) {
        contactAddError.textContent = '';
        contactAddError.classList.add('hidden');
    }
    
    const initialSearchState = document.getElementById('initialSearchState');
    if (initialSearchState) initialSearchState.classList.remove('hidden');
    
    const noResultsState = document.getElementById('noResultsState');
    if (noResultsState) noResultsState.classList.add('hidden');
    
    if (modal) {
        // Remove hidden class and add active class
        modal.classList.remove('hidden');
        modal.classList.add('active');
        
        // Focus the search input
        setTimeout(() => {
            if (searchInput) searchInput.focus();
        }, 100);
    } else {
        console.error('Add contact modal not found');
    }
}

/**
 * Close the "add contact" modal.
 */
function closeAddContactModal() {
    console.log('Closing add contact modal');
    const modal = document.getElementById('addContactModal');
    if (modal) {
        // Remove active class first
        modal.classList.remove('active');
        
        // Add hidden class after a short delay to allow for transition
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 300);
    } else {
        console.error('Add contact modal not found');
    }
}

/**
 * Search and add a contact.
 */
async function searchAndAddContact() {
    const searchInput = document.getElementById('searchInput');
    const query = searchInput.value.trim();
    const errorElement = document.getElementById('contactAddError');
    const resultsElement = document.getElementById('searchResults');

    errorElement.textContent = '';
    if (!query) {
        errorElement.textContent = 'Please enter a phone number or username';
        return;
    }

    resultsElement.innerHTML = '<div class="p-4 text-center text-gray-400"><i class="fas fa-spinner fa-spin mr-2"></i> Searching...</div>';

    try {
        const { ok, data } = await window.apiUtils.apiGet(`${USERS_API_URL}/search?query=${encodeURIComponent(query)}`);
        if (!ok) {
            throw new Error(data.error || 'Search failed');
        }

        if (!data.user) {
            resultsElement.innerHTML = '<div class="p-4 text-center text-gray-400">No user found with that phone number or username</div>';
            return;
        }

        // Check if user is already a contact
        const isAlreadyContact = contactsState.contacts.some(c => c._id === data.user._id);
        if (isAlreadyContact) {
            resultsElement.innerHTML = '<div class="p-4 text-center text-gray-400">This user is already in your contacts</div>';
            return;
        }

        // Display found user
        const initials = data.user.username ? data.user.username.split(' ').map(n => n[0]).join('').toUpperCase() : '';
        resultsElement.innerHTML = `
          <div class="p-4 border-b border-dark-tertiary">
            <div class="flex items-center">
              <div class="profile-pic mr-3">
                ${data.user.profilePicture ? `<img src="${data.user.profilePicture}" alt="${data.user.username}" class="w-full h-full object-cover rounded-full">` : `<div class="w-full h-full flex items-center justify-center bg-purple-primary rounded-full">${initials}</div>`}
              </div>
              <div class="flex-1">
                <h3 class="font-medium">${data.user.username || 'User'}</h3>
                <p class="text-gray-400">${data.user.anonId || data.user.phoneNumber || ''}</p>
                ${data.user.bio ? `<p class="text-sm mt-1">${data.user.bio}</p>` : ''}
              </div>
              <button id="addUserBtn" class="btn btn-primary btn-sm">Add</button>
            </div>
          </div>
        `;

        // Add the contact when clicking the "Add" button
        document.getElementById('addUserBtn').addEventListener('click', async () => {
            const { ok, data: addData } = await window.apiUtils.apiPost(CONTACTS_API_URL, {
                userId: window.currentUser._id,
                contactId: data.user._id
            });
            if (!ok) {
                errorElement.textContent = addData.error || 'Failed to add contact';
                return;
            }

            // Create a new contact object
            const newContact = {
                _id: data.user._id,
                name: data.user.username || data.user.anonId || data.user.phoneNumber,
                anonId: data.user.anonId,
                phoneNumber: data.user.phoneNumber,
                bio: data.user.bio || '',
                pfp: data.user.profilePicture || '',
                messages: [],
                lastMessage: '',
                unreadCount: 0
            };
            contactsState.contacts.push(newContact);
            refreshContactsUI();
            closeAddContactModal();
            showToast(`Added ${newContact.name} to contacts`, 'success');
            selectContact(newContact._id);
        });
    } catch (error) {
        console.error('Error searching for contact:', error);
        errorElement.textContent = 'Network error. Please try again.';
    }
}

/**
 * Toggle sidebar mode between chats and contacts.
 */
function toggleSidebarMode(mode) {
    // Get the current mode if not provided
    const sidebarMode = mode || (document.getElementById('chatsTab').classList.contains('active-tab') ? 'contacts' : 'chats');

    // Get UI elements
    const chatsTab = document.getElementById('chatsTab');
    const contactsTab = document.getElementById('contactsTab');
    const chatsContent = document.getElementById('chatsContent');
    const contactsContent = document.getElementById('contactsContent');
    const recentChatsList = document.getElementById('recentChatsList');
    const contactsList = document.getElementById('contactsList');

    // Update tab classes
    if (sidebarMode === 'chats') {
        // Update tab buttons
        chatsTab.classList.add('active-tab');
        contactsTab.classList.remove('active-tab');

        // Update content visibility
        if (chatsContent) chatsContent.classList.remove('hidden');
        if (contactsContent) contactsContent.classList.add('hidden');
        if (recentChatsList) recentChatsList.classList.remove('hidden');
        if (contactsList) contactsList.classList.add('hidden');
    } else {
        // Update tab buttons
        chatsTab.classList.remove('active-tab');
        contactsTab.classList.add('active-tab');

        // Update content visibility
        if (chatsContent) chatsContent.classList.add('hidden');
        if (contactsContent) contactsContent.classList.remove('hidden');
        if (recentChatsList) recentChatsList.classList.add('hidden');
        if (contactsList) contactsList.classList.remove('hidden');
    }
}

/**
 * Search contacts by filtering the displayed list.
 */
function searchContacts(query) {
    query = query.toLowerCase().trim();
    const contactItems = document.querySelectorAll('.contact-item');

    if (!query) {
        contactItems.forEach(item => item.classList.remove('hidden'));
        return;
    }

    contactItems.forEach(item => {
        const name = item.querySelector('h3').textContent.toLowerCase();
        const lastMessage = item.querySelector('p').textContent.toLowerCase();
        if (name.includes(query) || lastMessage.includes(query)) {
            item.classList.remove('hidden');
        } else {
            item.classList.add('hidden');
        }
    });
}

/**
 * Add a contact by user ID
 */
async function addContactById(userId) {
    try {
        const errorElement = document.getElementById('contactAddError');
        errorElement.classList.remove('hidden');
        errorElement.textContent = '';

        console.log('Adding contact with ID:', userId);
        
        // Show loading state on the add button
        const addButton = document.querySelector(`.add-user-btn[data-user-id="${userId}"]`);
        if (addButton) {
            const originalText = addButton.innerHTML;
            addButton.disabled = true;
            addButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        }

        // Make API call to add contact
        const response = await fetch(`${CONTACTS_API_URL}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${window.apiUtils.getAuthToken()}`
            },
            body: JSON.stringify({
                userId: window.AppState.currentUser._id,
                contactId: userId
            })
        });

        if (!response.ok) {
            if (addButton) {
                addButton.disabled = false;
                addButton.innerHTML = 'Add';
            }
            const errorData = await response.json();
            errorElement.textContent = errorData.error || `Failed to add contact (${response.status})`;
            return false;
        }

        const data = await response.json();

        // Fetch the user details
        const userResponse = await fetch(`${USERS_API_URL}/${userId}`, {
            headers: {
                'Authorization': `Bearer ${window.apiUtils.getAuthToken()}`
            }
        });
        
        if (!userResponse.ok) {
            errorElement.textContent = 'Failed to get user details';
            return false;
        }

        const user = await userResponse.json();

        // Add to contacts state
        const newContact = {
            _id: user._id,
            name: user.username || user.anonId || user.phoneNumber,
            anonId: user.anonId,
            phoneNumber: user.phoneNumber,
            bio: user.bio || '',
            pfp: user.pfp || '',
            messages: [],
            lastMessage: '',
            unreadCount: 0
        };

        window.AppState.addContact(newContact);
        refreshContactsUI();
        closeAddContactModal();
        showToast(`Added ${newContact.name} to contacts`, 'success');
        selectContact(newContact._id);

        return true;
    } catch (error) {
        console.error('Error adding contact:', error);
        const errorElement = document.getElementById('contactAddError');
        errorElement.classList.remove('hidden');
        errorElement.textContent = 'An error occurred while adding the contact';
        
        // Restore the button on error
        const addButton = document.querySelector(`.add-user-btn[data-user-id="${userId}"]`);
        if (addButton) {
            addButton.disabled = false;
            addButton.innerHTML = 'Add';
        }
        
        return false;
    }
}

/**
 * Load contacts from localStorage
 */
function loadContactsFromLocalStorage() {
    try {
        const storedContacts = localStorage.getItem('contacts');
        if (storedContacts) {
            const contacts = JSON.parse(storedContacts);
            console.log(`Loaded ${contacts.length} contacts from localStorage`);

            // Update contactsState
            if (contactsState) {
                // Merge with existing contacts
                const existingIds = new Set(contactsState.contacts.map(c => c._id));
                for (const contact of contacts) {
                    if (!existingIds.has(contact._id)) {
                        contactsState.contacts.push(contact);
                        existingIds.add(contact._id);
                    }
                }
            } else {
                // Initialize contactsState
                window.contactsState = {
                    contacts: contacts,
                    activeContactId: ''
                };
            }

            // Update UI
            if (typeof window.refreshContactsUI === 'function') {
                window.refreshContactsUI();
            }
        }
    } catch (error) {
        console.error('Error loading contacts from localStorage:', error);
    }
}

/**
 * Block a contact
 * @param {string} contactId - The ID of the contact to block
 */
function blockContact(contactId) {
    // Find the contact
    const contactIndex = window.AppState.contacts.findIndex(c => c._id === contactId);
    if (contactIndex === -1) {
        console.error('Cannot block: Contact not found', contactId);
        return false;
    }
    
    // Add to blocked contacts list if it doesn't exist
    if (!window.AppState.blockedContacts) {
        window.AppState.blockedContacts = [];
    }
    
    // Get contact info before removing
    const contact = window.AppState.contacts[contactIndex];
    
    // Add to blocked list
    window.AppState.blockedContacts.push({
        _id: contact._id,
        name: contact.name,
        phoneNumber: contact.phoneNumber,
        blockedAt: new Date().toISOString()
    });
    
    // Remove from contacts
    window.AppState.contacts.splice(contactIndex, 1);
    
    // Save changes
    window.AppState.saveToLocalStorage();
    
    // Refresh UI
    refreshContactsUI();
    
    return true;
}

/**
 * Open the contact profile modal for a specific contact
 * @param {string} contactId - The ID of the contact to view
 */
function openContactProfileModal(contactId) {
    console.log('Opening contact profile modal for:', contactId);
    const contact = contactsState.contacts.find(c => c._id === contactId);
    
    if (!contact) {
        console.error('Contact not found:', contactId);
        return;
    }
    
    // Get the modal elements
    const modal = document.getElementById('contactProfileModal');
    const profilePic = document.getElementById('profileModalPic');
    const profileName = document.getElementById('profileModalName');
    const profilePhone = document.getElementById('profileModalPhone');
    const profileBio = document.getElementById('profileModalBio');
    const profileLastSeen = document.getElementById('profileModalLastSeen');
    const messageBtn = document.getElementById('messageContactBtn');
    const removeBtn = document.getElementById('removeContactModalBtn');
    
    // Set the profile picture
    const initials = contact.name ? contact.name.split(' ').map(n => n[0]).join('').toUpperCase() : '';
    profilePic.innerHTML = contact.pfp 
        ? `<img src="${contact.pfp}" alt="${contact.name}" class="w-full h-full object-cover rounded-full">` 
        : initials;
    
    // Set the contact details
    profileName.textContent = contact.name || 'Unknown';
    profilePhone.textContent = contact.anonId || contact.phoneNumber || '';
    
    // Set the bio (with fallback)
    profileBio.textContent = contact.bio || 'No bio available';
    
    // Set last seen
    profileLastSeen.textContent = contact.lastSeen 
        ? formatLastSeen(contact.lastSeen) 
        : 'Unknown';
    
    // Setup message button
    messageBtn.onclick = () => {
        modal.classList.add('hidden');
        modal.classList.remove('active');
        window.selectContact(contactId);
    };
    
    // Setup remove button
    removeBtn.onclick = () => {
        modal.classList.add('hidden');
        modal.classList.remove('active');
        
        // Show confirmation dialog
        Swal.fire({
            title: 'Remove Contact',
            text: `Are you sure you want to remove ${contact.name} from your contacts?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#f44336',
            cancelButtonColor: '#333',
            confirmButtonText: 'Yes, remove',
            background: '#1e1e1e',
            color: '#fff'
        }).then((result) => {
            if (result.isConfirmed) {
                removeContact(contactId);
            }
        });
    };
    
    // Show the modal
    modal.classList.remove('hidden');
    modal.classList.add('active');
}

/**
 * Close contact profile modal
 */
function closeContactProfileModal() {
    const modal = document.getElementById('contactProfileModal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 300); // Match the animation duration
    }
}

// Export functions
export {
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
    loadContactsFromLocalStorage,
    blockContact,
    openContactProfileModal,
    closeContactProfileModal
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Load contacts from localStorage
    loadContactsFromLocalStorage();

    // Then fetch from server
    fetchContacts('DOMContentLoaded');
});

// Make sure this function is available globally
window.selectContact = selectContact;
window.openContactProfileModal = openContactProfileModal;
window.closeContactProfileModal = closeContactProfileModal;

// Add this function at the top of the file, before fetchContacts
function showContactsSkeletonLoading() {
    const contactsList = document.getElementById('contactsList');
    const recentChatsList = document.getElementById('recentChatsList');
    
    // Generate 5 skeleton contacts for the contacts list
    let skeletonHTML = '';
    for (let i = 0; i < 5; i++) {
        skeletonHTML += `
        <div class="skeleton-contact">
            <div class="skeleton skeleton-pic"></div>
            <div class="skeleton-text">
                <div class="skeleton skeleton-name"></div>
                <div class="skeleton skeleton-message"></div>
            </div>
        </div>`;
    }
    
    contactsList.innerHTML = skeletonHTML;
    recentChatsList.innerHTML = skeletonHTML;
}

