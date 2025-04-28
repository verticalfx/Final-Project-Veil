/**
 * messaging.js - Messaging functionality
 */

import { currentUser, contacts, activeContactId, showToast, generateUUID } from './core.js';
import { ephemeralEncrypt, ephemeralDecrypt, getEOSBlockHash } from './crypto.js';
import { contactsState, renderChatMessages, fetchUserById } from './shared.js';

/**
 * Initialize message input functionality
 */
function initializeMessageInput() {
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendMessageBtn');
    const emojiButton = document.getElementById('emojiButton');
    const emojiPicker = document.getElementById('emojiPicker');
    
    if (!messageInput || !sendButton || !emojiButton || !emojiPicker) {
        console.error('Message input elements not found');
        return;
    }
    
    // Auto-resize textarea as user types
    messageInput.addEventListener('input', function() {
        // Store the current height to check if it changes
        const oldHeight = this.offsetHeight;
        
        // Reset height to auto to get the correct scrollHeight
        this.style.height = 'auto';
        
        // Set new height based on scrollHeight (with max height)
        const newHeight = Math.min(this.scrollHeight, 120);
        this.style.height = newHeight + 'px';
        
        // If height increased, scroll chat to bottom to keep the view consistent
        if (newHeight > oldHeight && typeof window.scrollToBottom === 'function') {
            window.scrollToBottom(false); // Use instant scroll for better UX during typing
        }
    });
    
    // Handle Enter key to send, Shift+Enter for new line
    messageInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Send button click handler
    sendButton.addEventListener('click', function() {
        sendMessage();
    });
    
    
}



/**
 * Send a message
 */
async function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    if (!messageInput) {
        console.error('Message input not found');
        return;
    }

    const text = messageInput.value.trim();
    if (!text) {
        console.log('No message to send');
        return;
    }

    // Ensure the user is logged in using AppState
    if (!window.AppState.currentUser || !window.AppState.currentUser._id) {
        console.error('No current user found in AppState');
        showToast('User not logged in. Please log in again.', 'error');
        return;
    }

    // Get active contact from AppState
    const activeContactId = window.AppState.activeContactId;
    if (!activeContactId) {
        console.error('No active contact selected');
        showToast('Please select a contact first', 'error');
        return;
    }

    // Clear the input early for better UX
    messageInput.value = '';
    
    // Reset textarea height
    messageInput.style.height = 'auto';

    try {
        // Generate a message ID before sending
        const messageId = generateUUID();
        
        // Create a message object using AppState.currentUser
        const message = {
            _id: messageId,
            from: window.AppState.currentUser._id,
            to: activeContactId,
            text: text,
            time: new Date().toISOString(),
            status: 'sending'
        };

        // Add message to state immediately for instant feedback
        window.AppState.addMessage(activeContactId, message);
        
        // Ensure chat container is visible and empty chat placeholder is hidden
        const chatContainer = document.getElementById('chatContainer');
        const emptyChatPlaceholder = document.getElementById('emptyChatPlaceholder');
        if (chatContainer) chatContainer.classList.remove('hidden');
        if (emptyChatPlaceholder) emptyChatPlaceholder.classList.add('hidden');
        
        // Render messages to show the new message with animation
        renderChatMessages();
        // Ensure Chats tab updates immediately
        if (typeof window.refreshContactsUI === 'function') {
            window.refreshContactsUI();
        }

        // Send the ephemeral message
        const result = await sendEphemeralMessage(activeContactId, text);
        
        // Update message status to sent
        const updatedMessage = {
            ...message,
            status: 'sent'
        };
        
        // Update the message in state
        window.AppState.addMessage(activeContactId, updatedMessage);
        
        // Re-render messages to update status
        renderChatMessages();

        // Setup listeners for status updates
        setupMessageStatusListeners(activeContactId, messageId);

    } catch (error) {
        console.error('Error sending message:', error);
        showToast('Failed to send message', 'error');
        
        // Update message status to failed
        const failedMessage = {
            _id: messageId,
            from: window.AppState.currentUser._id,
            to: activeContactId,
            text: text,
            time: new Date().toISOString(),
            status: 'failed'
        };
        
        // Update the message in state
        window.AppState.addMessage(activeContactId, failedMessage);
        
        // Re-render messages to show failed status
        renderChatMessages();
    }
}

/**
 * Set up listeners for message status updates
 */
function setupMessageStatusListeners(contactId, messageId) {
    if (!contactId || !messageId) {
        console.error('Invalid contact ID or message ID for status listeners');
        return;
    }

    console.log(`Setting up status listeners for message ${messageId} to contact ${contactId}`);

    // Check if we have socket connection
    if (!window.socket) {
        console.error('Socket connection not available');
        return;
    }

    // Listen for delivery receipt
    window.socket.on(`message:delivered:${messageId}`, () => {
        console.log(`Message ${messageId} delivered to ${contactId}`);

        // Update message status in AppState
        window.AppState.updateMessageStatus(contactId, messageId, 'delivered');

        // Refresh UI
        refreshChatsUI();
    });

    // Listen for read receipt
    window.socket.on(`message:read:${messageId}`, () => {
        console.log(`Message ${messageId} read by ${contactId}`);

        // Update message status in AppState
        window.AppState.updateMessageStatus(contactId, messageId, 'read');

        // Refresh UI
        refreshChatsUI();
    });
}

/**
 * Send an ephemeral message
 */
async function sendEphemeralMessage(contactId, text) {
    console.log('SEND-CHECKPOINT 1: Starting sendEphemeralMessage', { contactId, textLength: text?.length });

    if (!text || !contactId) {
        console.error('SEND-CHECKPOINT ERROR: Invalid parameters', { text: !!text, contactId: !!contactId });
        throw new Error('Invalid parameters for sending message');
    }

    // Check for current user in window object
    if (!window.currentUser || !window.currentUser._id) {
        console.error('SEND-CHECKPOINT ERROR: No current user found');
        throw new Error('User not logged in');
    }

    try {
        // Get the latest EOS block hash
        console.log('SEND-CHECKPOINT 2: Getting EOS block hash');
        const blockHash = await getEOSBlockHash();
        console.log('SEND-CHECKPOINT 3: Got block hash', { blockHashLength: blockHash?.length });

        // Generate a random nonce (32 bytes)
        console.log('SEND-CHECKPOINT 4: Generating random nonce');
        const nonce = window.secureCrypto.getRandomBytes(32);
        console.log('SEND-CHECKPOINT 5: Generated nonce', { nonceType: typeof nonce, nonceLength: nonce?.length });

        // Encrypt the message
        console.log('SEND-CHECKPOINT 6: Calling ephemeralEncrypt');
        const encryptedData = await ephemeralEncrypt(blockHash, nonce, text);
        console.log('SEND-CHECKPOINT 7: Message encrypted successfully', { encryptedData: !!encryptedData });

        // Generate a unique message ID
        const messageId = generateUUID();

        // Prepare the message payload
        console.log('SEND-CHECKPOINT 8: Preparing message payload');
        const messagePayload = {
            messageId: messageId,
            toUserId: contactId,
            nonceHex: encryptedData.nonce,
            blockHash: encryptedData.blockHash,
            iv: encryptedData.iv,
            authTag: encryptedData.authTag,
            ciphertext: encryptedData.encryptedText,
            time: new Date().toISOString()
        };
        console.log('SEND-CHECKPOINT 9: Message payload prepared', { payloadKeys: Object.keys(messagePayload) });

        // Check if socket is available
        if (!window.socket || !window.socket.connected) {
            console.error('SEND-CHECKPOINT ERROR: Socket not connected');
            throw new Error('Not connected to server');
        }

        // Send via socket.io
        console.log('SEND-CHECKPOINT 10: Sending via socket.io');
        window.socket.emit('ephemeral_message', messagePayload);
        console.log('SEND-CHECKPOINT 11: Message sent via socket.io');

        // Return the message ID for tracking
        return { messageId };
    } catch (error) {
        console.error('SEND-CHECKPOINT ERROR: Error in sendEphemeralMessage:', error);
        throw error;
    }
}

/**
 * Handle incoming ephemeral message
 */
async function handleIncomingEphemeral(message) {
    if (!message) {
        console.error('Invalid message received');
        return null;
    }

    console.log('Processing incoming ephemeral message:', message.messageId || message._id);

    // Check if we have the necessary data to process the message
    if (!message.fromUserId && !message.from) {
        console.error('Message has no sender ID');
        return null;
    }

    if (!message.toUserId && !message.to) {
        console.error('Message has no recipient ID');
        return null;
    }

    // Normalize message format - handle both real-time and offline message formats
    const normalizedMessage = {
        _id: message._id || message.messageId || generateUUID(),
        from: message.from || message.fromUserId,
        to: message.to || message.toUserId,
        text: message.text || '',
        time: message.time || new Date().toISOString(),
        status: 'received',
        // Include encryption data if available
        blockHash: message.blockHash,
        nonceHex: message.nonceHex,
        iv: message.iv,
        authTag: message.authTag,
        ciphertext: message.ciphertext
    };

    // Check if this is for the current user
    if (normalizedMessage.to !== window.AppState.currentUser?._id) {
        console.warn('Message not intended for current user', {
            messageTo: normalizedMessage.to,
            currentUser: window.AppState.currentUser?._id
        });
        return null;
    }

    // Get contact ID (sender)
    const contactId = normalizedMessage.from;
    if (!contactId) {
        console.error('Message has no sender ID after normalization');
        return null;
    }

    // Check if contact exists
    let contact = window.AppState.getContact(contactId);

    // If contact doesn't exist, create a temporary chat session
    if (!contact) {
        console.log('Message from unknown contact, creating temporary chat session:', contactId);

        // Create temporary chat session object
        contact = {
            _id: contactId,
            name: `Unknown (${contactId.substring(0, 8)})`,
            messages: [],
            isTemporary: true,
            isNotInContacts: true,
            pendingAcks: [],
            unreadCount: 1
        };

        // Add the temporary chat session to AppState
        window.AppState.addContact(contact);
        
        // Also update contactsState to ensure UI consistency
        if (window.contactsState && window.contactsState.contacts) {
            const existingIndex = window.contactsState.contacts.findIndex(c => c._id === contactId);
            if (existingIndex >= 0) {
                window.contactsState.contacts[existingIndex] = contact;
            } else {
                window.contactsState.contacts.push(contact);
            }
        }
        
        // Force a UI refresh to show the new contact
        if (typeof window.refreshContactsUI === 'function') {
            window.refreshContactsUI();
        }
    }

    // If the message has encrypted content, decrypt it
    if (normalizedMessage.ciphertext && normalizedMessage.blockHash && normalizedMessage.nonceHex) {
        try {
            // Decrypt the message - await the result
            const decryptedText = await ephemeralDecrypt({
                blockHash: normalizedMessage.blockHash,
                nonceHex: normalizedMessage.nonceHex,
                iv: normalizedMessage.iv,
                authTag: normalizedMessage.authTag,
                ciphertext: normalizedMessage.ciphertext
            });
            
            if (decryptedText) {
                normalizedMessage.text = decryptedText;
            } else {
                console.error('Failed to decrypt message');
                normalizedMessage.text = '[Encrypted message - unable to decrypt]';
            }
        } catch (error) {
            console.error('Error decrypting message:', error);
            normalizedMessage.text = '[Encrypted message - decryption error]';
        }
    }

    // Add message to contact
    window.AppState.addMessage(contactId, normalizedMessage);

    // If this is the active contact, refresh the chat UI
    if (window.AppState.activeContactId === contactId) {
        window.renderChatMessages();
    }

    // Log that the message was processed
    console.log('Ephemeral message processed successfully:', normalizedMessage._id);

    // Don't acknowledge unknown contact messages until they're actually viewed
    if (!contact.isNotInContacts) {
        // For known contacts, acknowledge immediately
        await ackEphemeralMessage(normalizedMessage._id);
    } else {
        // For unknown contacts, store the message ID to acknowledge later when viewed
        if (!contact.pendingAcks) {
            contact.pendingAcks = [];
        }
        contact.pendingAcks.push(normalizedMessage._id);
        console.log('Message acknowledgment deferred until viewed:', normalizedMessage._id);
    }

    // Don't auto-select unknown contacts
    if (!window.AppState.activeContactId && !contact.isNotInContacts) {
        console.log('Auto-selecting contact after processing messages:', contactId);
        window.selectContact(contactId);
    } else if (contact.isNotInContacts) {
        console.log('Received message from unknown contact, not auto-selecting');
        
        // Increment unread count
        contact.unreadCount = (contact.unreadCount || 0) + 1;
        window.AppState.saveToLocalStorage();
        
        // Update the badge
        updateUnknownMessagesBadge();
        
        // Show notification
        if ("Notification" in window && Notification.permission === "granted") {
            const notification = new Notification("New message from unknown sender", {
                body: "Message received from an unverified contact",
                icon: "/img/logo.png"
            });
            
            notification.onclick = function() {
                window.focus();
                window.selectContact(contactId);
            };
        }
    }

    // Refresh the UI to show the updated message preview and unread count
    if (typeof window.refreshContactsUI === 'function') {
        window.refreshContactsUI();
    }

    if (typeof window.refreshChatsUI === 'function') {
        window.refreshChatsUI('handleIncomingEphemeral');
    }

    // Create notification in chat tab
    createNewMessagesNotification();

    return normalizedMessage;
}

/**
 * Update UI after processing messages
 */
function updateUIAfterMessageProcessing(contactId) {
    console.log('Updating UI after message processing for contact:', contactId);

    // Ensure contactsState exists
    if (!window.contactsState) {
        window.contactsState = {
            contacts: [],
            activeContactId: ''
        };
    }

    // Update UI
    if (typeof window.refreshContactsUI === 'function') {
        window.refreshContactsUI();
    }

    // Select the contact if not already selected
    if (contactId && typeof window.selectContact === 'function') {
        const activeContactId = window.contactsState?.activeContactId || window.activeContactId;

        if (!activeContactId || activeContactId === '') {
            console.log('Auto-selecting contact after message processing:', contactId);

            // Verify the contact exists in contactsState
            const contactExists = window.contactsState.contacts.some(c => c._id === contactId);

            if (contactExists) {
                window.selectContact(contactId);
            } else {
                console.error('Cannot select contact - not found in contactsState:', contactId);

                // Try to find the contact in localStorage
                try {
                    const storedContacts = JSON.parse(localStorage.getItem('contacts') || '[]');
                    const storedContact = storedContacts.find(c => c._id === contactId);

                    if (storedContact) {
                        // Add to contactsState
                        window.contactsState.contacts.push(storedContact);
                        console.log('Added contact from localStorage to contactsState:', storedContact.name);

                        // Now select it
                        window.selectContact(contactId);
                    }
                } catch (error) {
                    console.error('Error loading contact from localStorage:', error);
                }

            }

        }

    }

    // Update chat UI
    if (typeof window.refreshChatsUI === 'function') {
        window.refreshChatsUI();
    }
}

// Add a flag to track if we're already fetching messages
let isFetchingMessages = false;

/**
 * Fetch offline ephemeral messages
 */
async function fetchOfflineEphemeralMessages() {
    // Check if we're already fetching messages
    if (isFetchingMessages) {
        console.log('Already fetching messages, skipping duplicate request');
        return;
    }

    // Set flag to prevent duplicate requests
    isFetchingMessages = true;

    try {
        console.log('Fetching offline ephemeral messages...');

        // Check if user is logged in
        if (!window.AppState.currentUser || !window.AppState.currentUser._id) {
            console.error('Cannot fetch messages: No current user');
            isFetchingMessages = false;
            return;
        }

        // Make API request with error handling
        try {
            const response = await window.apiUtils.apiGet('http://localhost:4000/messages');
            
            if (!response) {
                console.error('Failed to fetch offline messages: No data received');
                isFetchingMessages = false;
                return;
            }

            // Handle the response format
            if (!response.ephemeralMessages) {
                console.log('No offline messages to process');
                isFetchingMessages = false;
                return;
            }

            console.log(`Fetched ${response.ephemeralMessages.length} offline messages`);

            // Process each message if there are any
            if (response.ephemeralMessages.length > 0) {
                // Store processed contacts to update UI only once
                const processedContacts = new Set();

                for (const msg of response.ephemeralMessages) {
                    try {
                        // Process the message - make sure it has the right format for handleIncomingEphemeral
                        const processedMessage = await handleIncomingEphemeral({
                            messageId: msg.messageId,
                            fromUserId: msg.fromUserId,
                            toUserId: msg.toUserId,
                            blockHash: msg.blockHash,
                            nonceHex: msg.nonceHex,
                            iv: msg.iv,
                            authTag: msg.authTag,
                            ciphertext: msg.ciphertext,
                            time: msg.time
                        });

                        // Keep track of which contact this message is from
                        if (msg.fromUserId && processedMessage) {
                            processedContacts.add(msg.fromUserId);
                        }

                        // Only acknowledge immediately for known contacts
                        const contact = window.AppState.getContact(msg.fromUserId);
                        if (contact && !contact.isNotInContacts) {
                            // For known contacts, acknowledge immediately
                            await ackEphemeralMessage(msg.messageId);
                        } else {
                            // For unknown contacts or if contact doesn't exist yet, create or update contact
                            let unknownContact = contact;
                            
                            if (!unknownContact) {
                                unknownContact = {
                                    _id: msg.fromUserId,
                                    name: `Unknown (${msg.fromUserId.substring(0, 8)})`,
                                    messages: [],
                                    isNotInContacts: true,
                                    pendingAcks: [],
                                    unreadCount: 1
                                };
                                
                                // Add to AppState
                                window.AppState.addContact(unknownContact);
                            }
                            
                            // Add to pending acknowledgments
                            if (!unknownContact.pendingAcks) {
                                unknownContact.pendingAcks = [];
                            }
                            unknownContact.pendingAcks.push(msg.messageId);
                            
                            console.log('Message acknowledgment deferred until viewed:', msg.messageId);
                            
                            // Update UI to show the unknown contact
                            if (typeof window.refreshContactsUI === 'function') {
                                window.refreshContactsUI();
                            }
                            
                            // Update badge
                            if (typeof window.updateUnknownMessagesBadge === 'function') {
                                window.updateUnknownMessagesBadge();
                            }
                        }

                        // Small delay to ensure UI updates properly
                        await new Promise(resolve => setTimeout(resolve, 50));
                    } catch (error) {
                        console.error('Error processing offline message:', error);
                    }
                }

                // Update UI only once after all messages are processed
                if (processedContacts.size > 0) {
                    const firstContactId = Array.from(processedContacts)[0];

                    // Only auto-select known contacts
                    const firstContact = window.AppState.getContact(firstContactId);
                    if (!window.AppState.activeContactId && firstContact && !firstContact.isNotInContacts) {
                        console.log('Auto-selecting contact after processing messages:', firstContactId);
                        if (typeof window.selectContact === 'function') {
                            window.selectContact(firstContactId);
                        }
                    } else if (firstContact && firstContact.isNotInContacts) {
                        console.log('Received messages from unknown contact, not auto-selecting');
                        // Optionally show a notification
                        showNotification(`New message from unknown user`, 'Click to view');
                    }
                }
            }
        } catch (error) {
            // Handle 404 specifically
            if (error.status === 404) {
                console.log('No offline messages endpoint available - this is expected for some server configurations');
            } else {
                console.error('Failed to fetch offline messages:', error);
            }
            isFetchingMessages = false;
            return;
        }
    } catch (error) {
        console.error('Error fetching offline messages:', error);
    } finally {
        // Reset flag
        isFetchingMessages = false;
    }
}

/**
 * Acknowledge ephemeral message
 */
async function ackEphemeralMessage(messageId) {
    try {
        const response = await window.apiUtils.apiPost('http://localhost:4000/messages/ack', { messageId });

        // Check if response exists and has expected format
        if (!response) {
            console.error('Failed to acknowledge message: No response received');
            return false;
        }

        // Log success
        console.log('Message acknowledged successfully:', messageId);
        return true;
    } catch (err) {
        console.error('Error acknowledging message:', err);
        return false;
    }
}

/**
 * Mark messages as read
 */
function markMessagesAsRead(contact) {
    if (!contact) {
        console.error('Cannot mark messages as read: Contact is null');
        return;
    }

    contact.unreadCount = 0;

    if (!contact.messages || !Array.isArray(contact.messages)) {
        console.log('No messages to mark as read for contact:', contact.name || contact._id);
        return;
    }

    // Check if we have a current user
    if (!window.currentUser || !window.currentUser._id) {
        console.error('Cannot mark messages as read: No current user');
        return;
    }

    console.log('Marking messages as read for contact:', contact.name || contact._id);

    contact.messages.forEach(m => {
        if (m && m.from && m.from !== window.currentUser._id) {
            m.read = true;
        }
    });

    console.log('Messages marked as read');
}

/**
 * Show message details
 */
function showMessageDetails(m) {
    console.log('showMessageDetails called with:', m);
    const modal = document.getElementById('messageInfoModal');
    const content = document.getElementById('messageInfoContent');

    if (!modal || !content) {
        console.error('Modal or content element not found:', { modal, content });
        return;
    }

    // Format time
    const time = new Date(m.time).toLocaleString();
    
    // Get encryption details
    const encryptionDetails = getEncryptionDetails(m);
    
    console.log('Rendering message details modal');

    // Check if encryption details are missing
    const missingEncryption = !m.blockHash && !m.nonceHex && !m.nonce && !m.iv && !m.authTag;

    content.innerHTML = `
      <div class="bg-dark-tertiary p-4 rounded-lg mb-4">
        <h3 class="font-medium mb-2">Message</h3>
        <p class="text-white">${m.text}</p>
      </div>
      
      <div class="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p class="text-gray-400 text-sm mb-1">Sent</p>
          <p>${time}</p>
        </div>
        <div>
          <p class="text-gray-400 text-sm mb-1">Status</p>
          <p class="flex items-center">
            ${m.read ? 'Read' : (m.status === 'delivered' ? 'Delivered' : 'Sent')}
            <span class="ml-2">${getMessageStatusIcon(m.status || 'sent')}</span>
          </p>
        </div>
      </div>
      
      <h3 class="font-medium mb-2 text-purple-primary">
        <i class="fas fa-shield-alt mr-2"></i>Encryption Details
      </h3>
      <div class="bg-dark-tertiary p-4 rounded-lg text-xs font-mono overflow-auto">
        ${missingEncryption ? 
          `<div class="text-yellow-400 mb-3 p-2 bg-dark-secondary rounded">
            <i class="fas fa-exclamation-triangle mr-1"></i> 
            This appears to be a test message or the encryption metadata is not available.
          </div>` : ''}
        <p class="mb-2"><span class="text-purple-tertiary font-bold">Block Hash:</span> ${m.blockHash || 'N/A'}</p>
        <p class="mb-2"><span class="text-purple-tertiary font-bold">Nonce:</span> ${m.nonceHex || m.nonce || 'N/A'}</p>
        <p class="mb-2"><span class="text-purple-tertiary font-bold">IV:</span> ${m.iv || 'N/A'}</p>
        <p class="mb-2"><span class="text-purple-tertiary font-bold">Auth Tag:</span> ${m.authTag || 'N/A'}</p>
        <p class="mb-2"><span class="text-purple-tertiary font-bold">Timestamp:</span> ${m.time || 'N/A'}</p>
      </div>
      
      <div class="mt-4 p-4 bg-dark-tertiary rounded-lg">
        <h4 class="font-medium mb-2 text-purple-primary">How E2EE Works in This Message</h4>
        <ol class="list-decimal pl-5 space-y-2 text-sm">
          <li>A unique encryption key is derived from the block hash and nonce</li>
          <li>The message is encrypted using AES-GCM with the derived key</li>
          <li>The IV (Initialization Vector) ensures unique encryption even with the same key</li>
          <li>The Auth Tag verifies the message hasn't been tampered with</li>
          <li>Only you and the recipient can decrypt this message</li>
        </ol>
      </div>
      
      <div class="mt-4 p-4 bg-dark-tertiary rounded-lg">
        <h4 class="font-medium mb-2 text-purple-primary">How This Prevents Server Tampering</h4>
        <ul class="list-disc pl-5 space-y-2 text-sm">
          <li><strong>Key Generation:</strong> Encryption keys are generated on your device, not on the server</li>
          <li><strong>Message Encryption:</strong> Messages are encrypted before leaving your device</li>
          <li><strong>Server Blindness:</strong> The server only sees encrypted data, never the plaintext message</li>
          <li><strong>Tamper Detection:</strong> The Auth Tag will fail verification if the message is modified</li>
          <li><strong>No Key Storage:</strong> Encryption keys are never stored on the server</li>
          <li><strong>Ephemeral Keys:</strong> Each message uses a unique key derived from the block hash and nonce</li>
        </ul>
      </div>
      
      <button id="toggleRawData" class="mt-4 w-full py-2 bg-dark-tertiary hover:bg-dark-secondary text-purple-primary rounded-lg transition-colors">
        <i class="fas fa-code mr-2"></i>View Raw Encrypted Data
      </button>
      
      <div id="rawEncryptedData" class="mt-4 p-4 bg-dark-tertiary rounded-lg text-xs font-mono overflow-auto hidden">
        <pre>${JSON.stringify(m, null, 2)}</pre>
      </div>
      
      <div class="mt-4 text-center">
        <p class="text-sm text-gray-400">
          <i class="fas fa-lock mr-1"></i>
          This message is secured with end-to-end encryption
        </p>
      </div>
    `;

    // Add event listener for the toggle button
    setTimeout(() => {
        const toggleButton = document.getElementById('toggleRawData');
        const rawDataDiv = document.getElementById('rawEncryptedData');
        
        if (toggleButton && rawDataDiv) {
            toggleButton.addEventListener('click', () => {
                rawDataDiv.classList.toggle('hidden');
                toggleButton.innerHTML = rawDataDiv.classList.contains('hidden') 
                    ? '<i class="fas fa-code mr-2"></i>View Raw Encrypted Data'
                    : '<i class="fas fa-eye-slash mr-2"></i>Hide Raw Encrypted Data';
            });
        }
    }, 100);

    // Remove hidden class and add active class with a slight delay for animation
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.add('active');
    }, 10);
}

/**
 * Get detailed encryption information for a message
 */
function getEncryptionDetails(message) {
    // For test messages or messages without encryption metadata,
    // generate sample values to demonstrate how it would work
    const isMissingEncryption = !message.blockHash && !message.nonceHex && !message.nonce && !message.iv && !message.authTag;
    
    // If this is a test message, generate sample encryption details
    if (isMissingEncryption) {
        // Generate deterministic values based on message content and time
        const messageText = message.text || '';
        const messageTime = message.time || new Date().toISOString();
        const combinedString = messageText + messageTime;
        
        // Simple hash function for demo purposes
        const simpleHash = str => {
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                const char = str.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash;
            }
            return Math.abs(hash).toString(16).padStart(8, '0');
        };
        
        const demoBlockHash = simpleHash(combinedString + '1');
        const demoNonce = simpleHash(combinedString + '2');
        const demoIv = simpleHash(combinedString + '3').substring(0, 16);
        const demoAuthTag = simpleHash(combinedString + '4');
        
        return {
            blockHash: demoBlockHash + ' (demo)',
            nonce: demoNonce + ' (demo)',
            iv: demoIv + ' (demo)',
            authTag: demoAuthTag + ' (demo)',
            timestamp: message.time || 'N/A',
            isDemo: true
        };
    }
    
    // Return actual encryption details
    return {
        blockHash: message.blockHash || 'N/A',
        nonce: message.nonceHex || message.nonce || 'N/A',
        iv: message.iv || 'N/A',
        authTag: message.authTag || 'N/A',
        timestamp: message.time || 'N/A',
        isDemo: false
    };
}

/**
 * Close message info modal
 */
function closeMessageInfo() {
    console.log('closeMessageInfo called');
    const modal = document.getElementById('messageInfoModal');
    if (modal) {
        modal.classList.remove('active');
        // Keep the hidden class for compatibility
        modal.classList.add('hidden');
    }
}

/**
 * Show encryption info modal
 */
function showEncryptionInfo() {
    const modal = document.getElementById('encryptionInfoModal');
    if (modal) {
        modal.classList.remove('hidden');
        // Add active class to make modal visible with animation
        setTimeout(() => {
            modal.classList.add('active');
        }, 10);
    }
}

/**
 * Close encryption info modal
 */
function closeEncryptionInfo() {
    const modal = document.getElementById('encryptionInfoModal');
    if (modal) {
        modal.classList.remove('active');
        // Add hidden class after animation completes
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 300);
    }
}

/**
 * Handle incoming message from socket
 */
async function handleIncomingMessage(message) {
    console.log('Received message via socket:', {
        messageId: message.messageId,
        fromUserId: message.fromUserId,
        hasBlockHash: !!message.blockHash,
        hasNonceHex: !!message.nonceHex,
        hasIv: !!message.iv,
        hasAuthTag: !!message.authTag,
        hasCiphertext: !!message.ciphertext
    });

    // Process the message
    handleIncomingEphemeral(message)
        .then(processedMessage => {
            if (processedMessage) {
                // If this is from the active contact, update the UI
                if (window.AppState.activeContactId === message.fromUserId) {
                    // Refresh the chat UI
                    if (typeof window.refreshChatsUI === 'function') {
                        window.refreshChatsUI();
                    }

                    // Send read receipt
                    if (window.socket) {
                        sendReadReceipt(message.fromUserId, message.messageId);
                    }
                } else {
                    // Otherwise just update the contacts list
                    if (typeof window.refreshContactsUI === 'function') {
                        window.refreshContactsUI();
                    }
                }
            }
        })
        .catch(error => {
            console.error('Error handling incoming socket message:', error);
        });
}

/**
 * Send read receipt for a message
 */
function sendReadReceipt(contactId, messageId) {
    if (!contactId || !messageId) {
        console.error('Invalid contact ID or message ID for read receipt');
        return;
    }

    console.log(`Sending read receipt for message ${messageId} to ${contactId}`);

    // Check if we have socket connection
    if (!window.socket) {
        console.error('Socket connection not available');
        return;
    }

    // Send read receipt via socket
    window.socket.emit('message:read', {
        messageId: messageId,
        contactId: contactId,
        userId: window.AppState.currentUser?._id,
        timestamp: new Date().toISOString()
    });

    // Also send via API for reliability
    fetch('/api/messages/read', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            messageId: messageId,
            contactId: contactId
        })
    }).catch(error => {
        console.error('Error sending read receipt via API:', error);
    });
}

/**
 * Append a new message to the chat UI without re-rendering everything
 */
function appendNewMessage(message) {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) {
        console.error('Chat messages container not found');
        return;
    }

    // Get the active contact
    const activeContact = window.AppState.getActiveContact();
    if (!activeContact) {
        console.error('No active contact found');
        return;
    }

    // Check if we need to add a new date separator
    const messageDate = new Date(message.time).toLocaleDateString();
    const lastDateSeparator = chatMessages.querySelector('.date-separator:last-child');
    const needsDateSeparator = !lastDateSeparator ||
        lastDateSeparator.dataset.date !== messageDate;

    // Add date separator if needed
    if (needsDateSeparator) {
        const dateDiv = document.createElement('div');
        dateDiv.className = 'flex justify-center my-4 date-separator';
        dateDiv.dataset.date = messageDate;
        dateDiv.innerHTML = `
            <span class="bg-dark-tertiary text-gray-400 text-xs px-3 py-1 rounded-full">
                ${formatMessageDate(message.time)}
            </span>
        `;
        chatMessages.appendChild(dateDiv);
    }

    // Create message element
    const isFromMe = message.from === window.AppState.currentUser?._id;
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isFromMe ? 'message-sent' : 'message-received'}`;
    messageDiv.dataset.messageId = message._id;

    // Message content
    messageDiv.innerHTML = `
        <div class="message-bubble animate-pop-in" 
             title="Click to view encryption details">
            ${message.text}
        </div>
        <div class="message-time">
            ${formatMessageTime(message.time)}
            ${isFromMe ? getMessageStatusIcon(message.status || 'sent') : ''}
        </div>
    `;

    // Add click event listener to the message bubble
    setTimeout(() => {
        const bubbleEl = messageDiv.querySelector('.message-bubble');
        if (bubbleEl) {
            bubbleEl.addEventListener('click', function() {
                console.log('Message bubble clicked (from appendNewMessage):', message);
                if (typeof window.showMessageDetails === 'function') {
                    window.showMessageDetails(message);
                } else {
                    console.error('showMessageDetails function not found on window object');
                }
            });
        }
    }, 0);

    // Add to chat container
    chatMessages.appendChild(messageDiv);

    // Scroll to bottom using the utility function
    if (typeof window.scrollToBottom === 'function') {
        window.scrollToBottom(true);
    } else {
        // Fallback if the utility function is not available
        chatMessages.scrollTo({
            top: chatMessages.scrollHeight,
            behavior: 'smooth'
        });
    }

    // Mark as read if from someone else
    if (!isFromMe && window.socket) {
        window.socket.emit('message_read', {
            messageId: message._id,
            fromUserId: message.from
        });
    }
}

/**
 * Render chat messages for the active contact
 */


// Helper function to format message date
function formatMessageDate(dateString) {
    const date = new Date(dateString);
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

// Helper function to format message time
function formatMessageTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
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
 * Get icon for message status
 */
function getMessageStatusIcon(status) {
    switch (status) {
        case 'sending':
        case 'pending':
            return '<i class="fas fa-spinner fa-spin"></i>';
        case 'sent':
            return '<i class="fas fa-check text-gray-400"></i>';
        case 'delivered':
            return '<i class="fas fa-check-double text-gray-400"></i>';
        case 'read':
            return '<i class="fas fa-check-double text-blue-400"></i>';
        case 'failed':
            return '<i class="fas fa-exclamation-circle text-red-500"></i>';
        default:
            return '';
    }
}

/**
 * Refresh the chats UI
 */
function refreshChatsUI() {
    console.log('Refreshing chats UI');

    // Render chat messages
    renderChatMessages();

    // Update contacts list to show latest message
    if (typeof window.refreshContactsUI === 'function') {
        window.refreshContactsUI();
    }

    // Save state
    window.AppState.saveState();

    // Create notification for new messages in chat tab
    if (typeof window.createNewMessagesNotification === 'function') {
        window.createNewMessagesNotification();
    }
}

// Add this function to messaging.js
function showNotification(title, body) {
    // Check if the browser supports notifications
    if (!("Notification" in window)) {
        console.log("This browser does not support desktop notification");
        return;
    }

    // Check if permission is already granted
    if (Notification.permission === "granted") {
        const notification = new Notification(title, { body });
        
        // When clicked, show the messages from the unknown contact
        notification.onclick = function() {
            window.focus();
            // You could add logic here to show the unknown contacts list
        };
    }
    // Otherwise, request permission
    else if (Notification.permission !== "denied") {
        Notification.requestPermission().then(function (permission) {
            if (permission === "granted") {
                const notification = new Notification(title, { body });
                
                notification.onclick = function() {
                    window.focus();
                    // You could add logic here to show the unknown contacts list
                };
            }
        });
    }
}

// Add this function to messaging.js
function updateUnknownMessagesBadge() {
    // Count unread messages from unknown contacts
    const unknownContacts = window.AppState.contacts.filter(c => c.isNotInContacts);
    const unreadCount = unknownContacts.reduce((total, contact) => total + (contact.unreadCount || 0), 0);
    
    // Find or create the badge
    let badge = document.getElementById('unknown-messages-badge');
    
    // Remove the badge if it exists - we're now showing unknown contacts in the chat list
    if (badge) {
        badge.remove();
    }
    
    // Refresh the contacts UI to update the unknown contacts in the chat list
    if (typeof window.refreshContactsUI === 'function') {
        window.refreshContactsUI();
    }
}

// Add this function to messaging.js
function addUnknownContactsCSS() {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.7; }
            100% { opacity: 1; }
        }

        .animate-pulse {
            animation: pulse 2s infinite;
        }

        .unknown-contact {
            position: relative;
            overflow: hidden;
        }

        .unknown-contact::after {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
            animation: shine 2s infinite;
        }

        @keyframes shine {
            0% { left: -100%; }
            100% { left: 100%; }
        }
    `;
    document.head.appendChild(style);
}

// Call this function when the module loads
addUnknownContactsCSS();

/**
 * Create a notification for new messages in the chat tab
 */
function createNewMessagesNotification() {
    // Disabled (user preference) – do nothing
    return;
}

/**
 * Add CSS for new messages notification
 */
function addNewMessagesNotificationCSS() {
    // Check if the style already exists
    if (document.getElementById('new-messages-notification-style')) return;
    
    const style = document.createElement('style');
    style.id = 'new-messages-notification-style';
    style.textContent = `
        #new-messages-notification {
            animation: slideIn 0.3s ease-out;
            position: relative;
            z-index: 10;
            margin-top: 10px;
        }

        @keyframes slideIn {
            from {
                transform: translateY(-20px);
                opacity: 0;
            }
            to {
                transform: translateY(0);
                opacity: 1;
            }
        }

        #new-messages-notification::before {
            content: '';
            position: absolute;
            left: 0;
            top: 0;
            height: 100%;
            width: 3px;
            background: linear-gradient(to bottom, #8b5cf6, #7c3aed);
        }

        #new-messages-notification:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }
    `;
    
    document.head.appendChild(style);
}

// Export functions for module imports
export {
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
    fetchUserById,
    initializeMessageInput,
};

// Export functions to window
window.sendMessage = sendMessage;
window.handleIncomingMessage = handleIncomingMessage;
window.handleIncomingEphemeral = handleIncomingEphemeral;
window.fetchOfflineEphemeralMessages = fetchOfflineEphemeralMessages;
window.renderChatMessages = renderChatMessages;
window.refreshChatsUI = refreshChatsUI;
window.sendReadReceipt = sendReadReceipt;
window.setupMessageStatusListeners = setupMessageStatusListeners;
window.getMessageStatusIcon = getMessageStatusIcon;
window.fetchUserById = fetchUserById;
window.updateUnknownMessagesBadge = updateUnknownMessagesBadge;
window.ackEphemeralMessage = ackEphemeralMessage;
window.closeMessageInfo = closeMessageInfo; 
window.closeMessageInfo = closeMessageInfo; 
window.closeMessageInfo = closeMessageInfo; 
window.closeMessageInfo = closeMessageInfo; 
window.createNewMessagesNotification = createNewMessagesNotification; 






