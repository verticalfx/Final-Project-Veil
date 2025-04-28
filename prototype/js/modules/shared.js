/**
 * shared.js - Shared state and functions between modules
 */

// Shared state
export const contactsState = {
    contacts: [],
    activeContactId: null
};

// Shared functions
export function renderChatMessages() {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) {
        console.error('Chat messages container not found');
        return;
    }

    // Clear existing messages
    chatMessages.innerHTML = '';

    // Get active contact
    const activeContactId = window.AppState.activeContactId;
    if (!activeContactId) {
        console.log('No active contact selected');
        return;
    }

    // Get active contact from AppState
    const activeContact = window.AppState.getActiveContact();
    if (!activeContact) {
        console.error('Active contact not found in AppState');
        return;
    }

    // Check if contact is not in contacts list (was auto-created from a message)
    if (activeContact.isNotInContacts) {
        // Add warning banner
        const warningBanner = document.createElement('div');
        warningBanner.className = 'bg-gradient-to-r from-yellow-600 to-orange-600 bg-opacity-30 text-yellow-200 p-4 mb-4 rounded-lg border border-yellow-500 shadow-md';
        warningBanner.innerHTML = `
            <div class="flex items-start">
                <div class="bg-yellow-500 rounded-full p-2 mr-3">
                    <i class="fas fa-shield-alt text-xl text-gray-900"></i>
                </div>
                <div class="flex-1">
                    <p class="text-sm font-bold flex items-center">
                        <i class="fas fa-exclamation-triangle mr-2"></i>
                        Unknown Contact - Security Notice
                    </p>
                    <div class="mt-2 space-y-1 text-xs">
                        <p class="flex items-center">
                            <i class="fas fa-lock mr-2 w-5 text-center"></i>
                            <span>Messages are end-to-end encrypted but this chat is <b>temporary</b></span>
                        </p>
                        <p class="flex items-center">
                            <i class="fas fa-user-shield mr-2 w-5 text-center"></i>
                            <span>Verify identity before sharing sensitive information</span>
                        </p>
                        <p class="flex items-center">
                            <i class="fas fa-history mr-2 w-5 text-center"></i>
                            <span>Chat history may be lost if you don't add to contacts</span>
                        </p>
                    </div>
                </div>
            </div>
            <div class="flex justify-end mt-3 space-x-2">
                <button id="blockContactBtn" class="bg-gray-700 hover:bg-gray-600 text-white text-xs px-3 py-1 rounded-full flex items-center transition-colors">
                    <i class="fas fa-ban mr-1"></i> Block
                </button>
                <button id="addToContactsBtn" class="bg-green-600 hover:bg-green-500 text-white text-xs px-3 py-1 rounded-full flex items-center transition-colors">
                    <i class="fas fa-user-plus mr-1"></i> Add to Contacts
                </button>
                <button id="learnMoreBtn" class="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1 rounded-full flex items-center transition-colors mr-2">
                    <i class="fas fa-info-circle mr-1"></i> Learn More
                </button>
            </div>
        `;
        chatMessages.appendChild(warningBanner);
        
        // Add event listeners to the buttons
        const addButton = warningBanner.querySelector('#addToContactsBtn');
        if (addButton) {
            addButton.addEventListener('click', () => {
                // Add contact to contacts list
                window.addContactById(activeContactId);
                
                // Remove the warning banner
                warningBanner.remove();
                
                // Show success toast
                showToast('Contact added successfully', 'success');
            });
        }
        
        // Add block contact functionality
        const blockButton = warningBanner.querySelector('#blockContactBtn');
        if (blockButton) {
            blockButton.addEventListener('click', () => {
                if (confirm('Are you sure you want to block this contact? You will no longer receive messages from them.')) {
                    // Implement blocking functionality
                    blockContact(activeContactId);
                    
                    // Go back to empty chat state
                    window.AppState.activeContactId = null;
                    window.AppState.saveToLocalStorage();
                    
                    // Refresh UI
                    window.refreshChatsUI('shared.js:109 (blockContact)');
                    
                    // Show success toast
                    showToast('Contact blocked', 'info');
                }
            });
        }

        // Add learn more functionality
        const learnMoreBtn = warningBanner.querySelector('#learnMoreBtn');
        if (learnMoreBtn) {
            learnMoreBtn.addEventListener('click', () => {
                window.showSecurityInfoModal();
            });
        }
    }

    // Check if contact has messages
    if (!activeContact.messages || activeContact.messages.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'flex items-center justify-center h-full text-gray-400';
        emptyState.textContent = 'No messages yet';
        chatMessages.appendChild(emptyState);
        return;
    }

    // Create a fragment to improve performance
    const fragment = document.createDocumentFragment();

    // For each message
    activeContact.messages.forEach((message, index) => {
        // Add null check for currentUser
        const isFromMe = window.AppState.currentUser && message.from === window.AppState.currentUser._id;
        const messageClass = isFromMe ? 'message-sent' : 'message-received';
        const animationDelay = index * 0.05; // Stagger animation
        const animationClass = 'animate-pop-in';
        
        // Create message element with animation
        const messageEl = document.createElement('div');
        messageEl.className = `message ${messageClass}`;
        messageEl.style.animationDelay = `${animationDelay}s`;
        messageEl.dataset.messageId = message._id;
        
        // Create message content
        const bubbleEl = document.createElement('div');
        // Assign color class based on sender (purple for me, grey for others)
        const bubbleClass = isFromMe ? 'outgoing' : 'incoming';
        bubbleEl.className = `message-bubble ${bubbleClass} ${animationClass}`;
        bubbleEl.textContent = message.text;
        bubbleEl.title = "Click to view encryption details";
        bubbleEl.onclick = function() {
            console.log('Message bubble clicked:', message);
            if (typeof window.showMessageDetails === 'function') {
                window.showMessageDetails(message);
            } else {
                console.error('showMessageDetails function not found on window object');
            }
        };
        
        // Create message time
        const timeEl = document.createElement('div');
        timeEl.className = 'message-time';
        timeEl.textContent = formatMessageTime(message.time);
        
        // Add status indicator for sent messages
        if (isFromMe) {
            const statusEl = document.createElement('span');
            statusEl.className = 'message-status ml-1';
            
            if (message.status === 'sent') {
                statusEl.innerHTML = '<i class="fas fa-check text-gray-400"></i>';
            } else if (message.status === 'delivered') {
                statusEl.innerHTML = '<i class="fas fa-check-double text-gray-400"></i>';
            } else if (message.status === 'read') {
                statusEl.innerHTML = '<i class="fas fa-check-double text-blue-400"></i>';
            }
            
            timeEl.appendChild(statusEl);
        }
        
        // Assemble message
        messageEl.appendChild(bubbleEl);
        messageEl.appendChild(timeEl);
        
        // Add to fragment
        fragment.appendChild(messageEl);
    });

    // Add all messages to the container
    chatMessages.appendChild(fragment);
    
    // Scroll to bottom smoothly
    scrollToBottom(true);
    
    // DO NOT automatically mark messages as read here
    // This will be handled by the selectContact function
    // Remove or comment out the following code:
    /*
    if (typeof window.markMessagesAsRead === 'function') {
        window.markMessagesAsRead(activeContactId);
    }
    */
}

// Helper function to format message time
function formatMessageTime(timeString) {
    const date = new Date(timeString);
    const now = new Date();
    
    // Check if same day
    if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // Check if yesterday
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // Otherwise show date
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + 
           date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Helper function to get status icon
function getStatusIcon(status) {
    switch(status) {
        case 'sending':
            return '<i class="fas fa-clock text-gray-400"></i>';
        case 'sent':
            return '<i class="fas fa-check text-gray-400"></i>';
        case 'delivered':
            return '<i class="fas fa-check-double text-gray-400"></i>';
        case 'read':
            return '<i class="fas fa-check-double text-purple-secondary"></i>';
        case 'failed':
            return '<i class="fas fa-exclamation-circle text-red-500"></i>';
        default:
            return '<i class="fas fa-clock text-gray-400"></i>';
    }
}

/**
 * Fetch user information by ID
 */
export async function fetchUserById(userId) {
    console.log('Fetching user information for ID:', userId);
    try {
        const response = await window.apiUtils.apiGet(`http://localhost:4000/users/${userId}`);

        if (!response || !response._id) {
            console.error('Failed to fetch user information:', response);
            return null;
        }

        console.log('User information fetched successfully:', response);
        return response;
    } catch (error) {
        console.error('Error fetching user information:', error);
        return null;
    }
}

// Add this function to shared.js
function showToast(message, type = 'info') {
    // Create toast container if it doesn't exist
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.className = 'fixed bottom-4 right-4 z-50 flex flex-col space-y-2';
        document.body.appendChild(toastContainer);
    }
    
    // Create toast element
    const toast = document.createElement('div');
    
    // Set appropriate styling based on type
    let iconClass = 'fa-info-circle';
    let bgColor = 'bg-blue-500';
    
    switch (type) {
        case 'success':
            iconClass = 'fa-check-circle';
            bgColor = 'bg-green-500';
            break;
        case 'error':
            iconClass = 'fa-exclamation-circle';
            bgColor = 'bg-red-500';
            break;
        case 'warning':
            iconClass = 'fa-exclamation-triangle';
            bgColor = 'bg-yellow-500';
            break;
    }
    
    toast.className = `${bgColor} text-white px-4 py-2 rounded-lg shadow-lg flex items-center min-w-[200px] transform transition-all duration-300 ease-in-out`;
    toast.innerHTML = `
        <i class="fas ${iconClass} mr-2"></i>
        <span class="flex-1">${message}</span>
    `;
    
    // Add to container
    toastContainer.appendChild(toast);
    
    // Animate in
    setTimeout(() => {
        toast.classList.add('translate-y-0', 'opacity-100');
    }, 10);
    
    // Remove after 3 seconds
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}

// Export the function
window.showToast = showToast;

// Add this function to shared.js
function showSecurityInfoModal() {
    // Create modal container
    const modalContainer = document.createElement('div');
    modalContainer.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modalContainer.id = 'security-info-modal';
    
    // Create modal content
    modalContainer.innerHTML = `
        <div class="bg-gray-900 rounded-lg shadow-lg max-w-md w-full mx-4 overflow-hidden transform transition-all">
            <div class="bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-3 flex items-center justify-between">
                <h3 class="text-white font-bold flex items-center">
                    <i class="fas fa-shield-alt mr-2"></i>
                    Security Information
                </h3>
                <button id="close-security-modal" class="text-white hover:text-gray-200">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="p-4 max-h-[70vh] overflow-y-auto">
                <div class="space-y-4">
                    <div class="bg-yellow-500 bg-opacity-20 p-3 rounded-lg border border-yellow-600">
                        <h4 class="font-bold text-yellow-300 flex items-center">
                            <i class="fas fa-exclamation-triangle mr-2"></i>
                            Unknown Contacts
                        </h4>
                        <p class="text-sm mt-2 text-gray-300">
                            Messages from unknown contacts are encrypted but should be treated with caution.
                            Verify the sender's identity before sharing sensitive information.
                        </p>
                        <ul class="mt-2 text-sm text-gray-300 space-y-1 pl-6 list-disc">
                            <li>Unknown contacts are not saved to your contacts list</li>
                            <li>Chat history with unknown contacts may be lost</li>
                            <li>You can add them to contacts or block them at any time</li>
                        </ul>
                    </div>
                    
                    <div class="bg-green-500 bg-opacity-20 p-3 rounded-lg border border-green-600">
                        <h4 class="font-bold text-green-300 flex items-center">
                            <i class="fas fa-lock mr-2"></i>
                            End-to-End Encryption
                        </h4>
                        <p class="text-sm mt-2 text-gray-300">
                            All messages in Veil are protected with end-to-end encryption, meaning only you and 
                            the recipient can read them.
                        </p>
                    </div>
                    
                    <div class="bg-blue-500 bg-opacity-20 p-3 rounded-lg border border-blue-600">
                        <h4 class="font-bold text-blue-300 flex items-center">
                            <i class="fas fa-user-shield mr-2"></i>
                            Best Practices
                        </h4>
                        <ul class="mt-2 text-sm text-gray-300 space-y-1 pl-6 list-disc">
                            <li>Verify contacts through other channels when possible</li>
                            <li>Don't share sensitive information with unverified contacts</li>
                            <li>Block and report suspicious contacts</li>
                            <li>Keep your app updated for the latest security features</li>
                        </ul>
                    </div>
                </div>
            </div>
            <div class="bg-gray-800 px-4 py-3 flex justify-end">
                <button id="understand-security-btn" class="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-md text-sm transition-colors">
                    I Understand
                </button>
            </div>
        </div>
    `;
    
    // Add to document
    document.body.appendChild(modalContainer);
    
    // Add event listeners
    document.getElementById('close-security-modal').addEventListener('click', () => {
        modalContainer.remove();
    });
    
    document.getElementById('understand-security-btn').addEventListener('click', () => {
        modalContainer.remove();
    });
    
    // Close when clicking outside
    modalContainer.addEventListener('click', (e) => {
        if (e.target === modalContainer) {
            modalContainer.remove();
        }
    });
}

// Export the function
window.showSecurityInfoModal = showSecurityInfoModal;

/**
 * Unified refreshChatsUI function that handles both UI updates and message rendering
 * @param {string} caller - The name of the function or module that called refreshChatsUI
 */
function refreshChatsUI(caller = 'unknown') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] refreshChatsUI called from: ${caller}`);
    console.trace('refreshChatsUI call stack');

    // Get UI elements
    const chatHeader = document.getElementById('chatHeader');
    const emptyChatPlaceholder = document.getElementById('emptyChatPlaceholder');
    const chatContainer = document.getElementById('chatContainer');
    const chatAreaBox = document.getElementById('chatAreaBox');
    const chatArea = document.getElementById('chatArea');
    const backButton = document.getElementById('backButton');

    // Log elements found
    console.log('[refreshChatsUI] UI elements:', {
        chatHeader: !!chatHeader,
        emptyChatPlaceholder: !!emptyChatPlaceholder,
        chatContainer: !!chatContainer,
        chatAreaBox: !!chatAreaBox,
        chatArea: !!chatArea,
        backButton: !!backButton
    });

    // Get active contact ID from AppState
    const activeContactId = window.AppState.activeContactId;
    console.log('[refreshChatsUI] Active contact ID:', activeContactId);

    // If no active contact, show empty state
    if (!activeContactId) {
        console.log('[refreshChatsUI] No active contact, showing empty state');
        // Show empty chat placeholder
        if (emptyChatPlaceholder) emptyChatPlaceholder.classList.remove('hidden');
        // Hide chat container
        if (chatContainer) chatContainer.classList.add('hidden');
        return;
    }

    // Render chat messages
    if (typeof window.renderChatMessages === 'function') {
        window.renderChatMessages();
    } else {
        console.error('[refreshChatsUI] renderChatMessages function not found');
    }

    // Update contacts list to show latest message
    if (typeof window.refreshContactsUI === 'function') {
        window.refreshContactsUI();
    } else {
        console.error('[refreshChatsUI] refreshContactsUI function not found');
    }

    // Save state
    if (window.AppState && typeof window.AppState.saveState === 'function') {
        window.AppState.saveState();
    } else {
        console.error('[refreshChatsUI] AppState.saveState function not found');
    }
}

// Export the function
export { refreshChatsUI };

// Add to window object
window.refreshChatsUI = function(caller) {
    return refreshChatsUI(caller);
};

/**
 * Enhanced logging function for tracking refreshChatsUI calls
 * @param {string} caller - The name of the function or file that called refreshChatsUI
 */
function logRefreshChatsUI(caller) {
    const timestamp = new Date().toISOString();
    console.group(`[${timestamp}] refreshChatsUI called from: ${caller}`);
    console.log('Call stack:', new Error().stack);
    console.groupEnd();
}

// Export the function
export { logRefreshChatsUI };

// Add to window object
window.logRefreshChatsUI = logRefreshChatsUI;

// Add a debounce utility function
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

// Export the debounced version of refreshChatsUI
export const debouncedRefreshChatsUI = debounce((caller) => {
    // Call the original refreshChatsUI
    if (typeof window.originalRefreshChatsUI === 'function') {
        window.originalRefreshChatsUI(caller);
    }
}, 100); // 100ms debounce time

// Add to window object
window.debouncedRefreshChatsUI = debouncedRefreshChatsUI;

// Helper function to scroll chat to bottom
export function scrollToBottom(smooth = true) {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    
    chatMessages.scrollTo({
        top: chatMessages.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
    });
}

// Export the scrollToBottom function to window
window.scrollToBottom = scrollToBottom; 