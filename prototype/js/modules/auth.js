/**
 * auth.js - Authentication and onboarding functionality
 */

import { currentUser, contacts, activeContactId, showToast, generateUUID } from './core.js';
import { fetchContacts, refreshContactsUI, refreshChatsUI, fetchUserById } from './contacts.js';
import { fetchOfflineEphemeralMessages, handleIncomingEphemeral } from './messaging.js';
import { fetchUserById as sharedFetchUserById, renderChatMessages } from './shared.js';
import API_CONFIG from '../config.js';

const authState = {
    phoneNumber: '',
    username: '',
    bio: '',
    phoneNotRegistered: false,
    requestToken: null
};

// Expose authState to window for access from other modules
window.authState = authState;

/**
 * Set loading state for a button.
 * When isLoading is true, the button text is updated and disabled.
 */
function setLoadingState(buttonElement, isLoading, loadingText = 'Processing...') {
    if (isLoading) {
        buttonElement.dataset.originalText = buttonElement.textContent;
        buttonElement.textContent = loadingText;
        buttonElement.disabled = true;
    } else {
        if (buttonElement.dataset.originalText) {
            buttonElement.textContent = buttonElement.dataset.originalText;
        }
        buttonElement.disabled = false;
    }
}

/**
 * Auto-fill OTP input fields and update the hidden input.
 */
function autoFillOtpInputs(otp) {
    if (!otp) return;
    const otpInputs = document.querySelectorAll('.otp-input');
    const otpDigits = otp.split('');
    otpInputs.forEach((input, index) => {
        if (index < otpDigits.length) {
            input.value = otpDigits[index];
        }
    });
    // Update the hidden OTP input
    const otpHiddenInput = document.getElementById('otpInput');
    if (otpHiddenInput) otpHiddenInput.value = otp;
}

/**
 * Start the phone login process.
 */
async function startPhoneLogin() {
    const phoneInp = document.getElementById('phoneInput');
    let phoneValue = phoneInp.value.trim();
    
    // Always ensure phone number starts with +
    if (!phoneValue.startsWith('+')) {
        // Get the country code from the select
        const countrySelect = document.getElementById('countrySelect');
        const selectedDialCode = countrySelect ? countrySelect.value : '';
        phoneValue = '+' + (selectedDialCode + phoneValue.replace(/[^\d]/g, ''));
    }
    
    // Normalize the phone number by removing spaces, dashes, and parentheses
    // Keep the leading + for international numbers
    const normalizedPhone = phoneValue.startsWith('+') 
        ? '+' + phoneValue.substring(1).replace(/[\s\-\(\)]/g, '')
        : phoneValue.replace(/[\s\-\(\)]/g, '');
    
    phoneValue = normalizedPhone;
    authState.phoneNumber = phoneValue;
    document.getElementById('phoneError').textContent = '';

    if (!phoneValue) {
        document.getElementById('phoneError').textContent = 'Please enter your phone number.';
        return;
    }

    console.log('Normalized phone number:', phoneValue);

    // Show loading state
    const continueBtn = document.querySelector('#stepPhone button');
    setLoadingState(continueBtn, true, 'Processing...');

    try {
        const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AUTH}/start`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                phoneNumber: phoneValue
            })
        });
        
        // Get the OTP request token from the response headers
        const requestToken = response.headers.get('x-otp-request-token');
        if (requestToken) {
            authState.requestToken = requestToken;
            console.log('Received OTP request token:', requestToken);
        }
        
        const data = await response.json();

        // Reset phoneNotRegistered flag before checking response
        authState.phoneNotRegistered = false;

        if (data.needsRegistration) {
            authState.phoneNotRegistered = true;
            showStep('stepName');
            hideStep('stepPhone');
        } else {
            showStep('stepOTP');
            hideStep('stepPhone');

            // Auto-focus first OTP input and fill in OTP if provided
            setTimeout(() => {
                const firstOtpInput = document.querySelector('.otp-input[data-index="0"]');
                if (firstOtpInput) firstOtpInput.focus();

                if (data.otp) {
                    autoFillOtpInputs(data.otp);
                }
            }, 100);
        }
    } catch (err) {
        document.getElementById('phoneError').textContent = 'Could not contact server.';
        console.error('Error starting login:', err);
    } finally {
        setLoadingState(continueBtn, false);
    }
}

/**
 * Continue from name input to bio or OTP.
 */
function continueFromName() {
    const nameErr = document.getElementById('nameError');
    nameErr.textContent = '';

    const usernameInput = document.getElementById('regUsername');
    const username = usernameInput.value.trim();
    
    console.log('Username input value:', username);
    console.log('phoneNotRegistered:', authState.phoneNotRegistered);

    if (!username && authState.phoneNotRegistered) {
        nameErr.textContent = 'Username is required.';
        return;
    }
    
    // Save username to authState
    authState.username = username;
    console.log('Saved username to authState:', authState.username);
    
    if (authState.phoneNotRegistered) {
        showStep('stepBio');
        hideStep('stepName');
    } else {
        showStep('stepOTP');
        hideStep('stepName');
    }
}

/**
 * Submit username and continue.
 */
function submitUsername() {
    continueFromName();
}

/**
 * Continue from bio input to OTP.
 */
function continueFromBio() {
    const bioInput = document.getElementById('regBio');
    const bio = bioInput.value.trim();
    
    // Save bio to authState
    authState.bio = bio;
    console.log('Saved bio to authState:', authState.bio);
    
    hideStep('stepBio');
    showStep('stepOTP');
    registerUser();
}

/**
 * Submit bio and continue.
 */
function submitBio() {
    continueFromBio();
}

/**
 * Skip bio input and continue.
 */
function skipBio() {
    hideStep('stepBio');
    showStep('stepOTP');
    registerUser();
}

/**
 * Register a new user.
 */
async function registerUser() {
    const nameErr = document.getElementById('nameError');
    nameErr.textContent = '';

    console.log('Registering user with:', {
        phoneNumber: authState.phoneNumber,
        username: authState.username,
        bio: authState.bio
    });

    try {
        const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AUTH}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phoneNumber: authState.phoneNumber,
                username: authState.username,
                bio: authState.bio,
                pfp: '' // Profile picture can be added later
            })
        });
        const data = await response.json();
        
        if (data.error) {
            nameErr.textContent = data.error;
            console.error('Registration error:', data.error);
        } else {
            console.log('Registration success, proceed OTP...');
            // After registration, request OTP for demo purposes
            const otpRes = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AUTH}/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phoneNumber: authState.phoneNumber })
            });
            
            // Get the new OTP request token from the response headers
            const newRequestToken = otpRes.headers.get('x-otp-request-token');
            if (newRequestToken) {
                // Update the authState with the new token
                authState.requestToken = newRequestToken;
                console.log('Updated OTP request token after registration:', newRequestToken);
            } else {
                console.error('No request token received after registration');
            }
            
            const otpData = await otpRes.json();
            setTimeout(() => {
                if (otpData.otp) {
                    autoFillOtpInputs(otpData.otp);
                }
                const firstOtpInput = document.querySelector('.otp-input[data-index="0"]');
                if (firstOtpInput) firstOtpInput.focus();
            }, 100);
        }
    } catch (err) {
        console.error('Registration request failed:', err);
        nameErr.textContent = 'Registration request failed.';
    }
}

/**
 * Verify OTP code.
 */
async function verifyOtp() {
    console.log("Starting OTP verification process");
    const otpInputElem = document.getElementById('otpInput');
    const otpVal = otpInputElem.value.trim();
    const otpErr = document.getElementById('otpError');
    otpErr.textContent = '';

    // Find all OTP input fields to count them
    const otpInputs = document.querySelectorAll('.otp-input');
    console.log(`Found ${otpInputs.length} OTP input fields`);

    // Check if we have a combined OTP value
    console.log(`Combined OTP value: ${otpVal}`);

    if (!otpVal || otpVal.length !== otpInputs.length) {
        otpErr.textContent = `Please enter a valid ${otpInputs.length}-digit OTP`;
        return;
    }

    // Check if we have the request token
    if (!authState.requestToken) {
        otpErr.textContent = 'Session expired. Please go back and try again.';
        return;
    }

    // Show loading spinner and disable verify button
    const loadingContainer = document.querySelector('.loading-container');
    const verifyBtn = document.getElementById('verifyButton');
    loadingContainer.classList.remove('hidden');
    setLoadingState(verifyBtn, true, 'Verifying...');

    try {
        console.log('Using request token for verification:', authState.requestToken);
        const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AUTH}/verify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-otp-request-token': authState.requestToken
            },
            body: JSON.stringify({
                phoneNumber: authState.phoneNumber,
                otp: otpVal
            })
        });
        
        if (!response.ok) {
            console.error('OTP verification failed with status:', response.status);
            const errorData = await response.json();
            console.error('Error response:', errorData);
            otpErr.textContent = errorData.error || 'Verification failed. Please try again.';
            loadingContainer.classList.add('hidden');
            setLoadingState(verifyBtn, false, 'Verify');
            return;
        }
        
        // Check for a new token in the response headers
        const newRequestToken = response.headers.get('x-otp-request-token');
        if (newRequestToken) {
            authState.requestToken = newRequestToken;
            console.log('Updated request token from headers:', authState.requestToken);
        }
        
        const data = await response.json();

        loadingContainer.classList.add('hidden');
        setLoadingState(verifyBtn, false);

        if (data.error) {
            otpErr.textContent = data.error;
            // Clear OTP inputs and focus the first one
            const otpInputs = document.querySelectorAll('.otp-input');
            otpInputs.forEach(input => {
                input.value = '';
                input.classList.remove('border-purple-primary');
            });
            if (otpInputs.length) otpInputs[0].focus();
            otpInputElem.value = '';
            return;
        }

        // Store token and update user state using apiUtils
        window.AppState.token = data.token;
        
        // Use apiUtils to store the token in sessionStorage
        if (window.apiUtils) {
            window.apiUtils.setAuthToken(data.token);
            window.apiUtils.setCurrentUser(data.user);
            console.log('Token stored in sessionStorage using apiUtils');
        } else {
            // Fallback to sessionStorage directly if apiUtils is not available
            sessionStorage.setItem('authToken', data.token);
            sessionStorage.setItem('currentUser', JSON.stringify(data.user));
            console.log('Token stored in sessionStorage directly');
        }

        window.currentUser = data.user;
        window.AppState.currentUser = data.user;

        // Clear the active contact when logging in
        window.AppState.activeContactId = null;
        window.AppState.saveToLocalStorage();

        // Make sure the user data is properly set before proceeding
        console.log('User authenticated:', window.currentUser);
        
        // Hide onboarding and show chat screen
        document.getElementById('onboardingContainer').classList.add('hidden');
        document.getElementById('chatScreen').classList.remove('hidden');
        
        // Update user display
        updateUserDisplay(data.user);
        
        // Initialize UI elements
        const chatsTab = document.getElementById('chatsTab');
        if (chatsTab) {
            chatsTab.classList.add('active-tab');
        }
        
        const contactsTab = document.getElementById('contactsTab');
        if (contactsTab) {
            contactsTab.classList.remove('active-tab');
        }
        
        const chatsContent = document.getElementById('chatsContent');
        if (chatsContent) {
            chatsContent.classList.remove('hidden');
        }
        
        const contactsContent = document.getElementById('contactsContent');
        if (contactsContent) {
            contactsContent.classList.add('hidden');
        }
        
        // Show success message
        showToast('Login successful!', 'success');

        // Check if this is a new registration
        if (authState.phoneNotRegistered) {
            // Show welcome modal with celebration effect
            //showWelcomeModal(data.user);
        }

        // Initialize app functions after a short delay to ensure user data is set
        setTimeout(() => {
            try {
                // Use window.currentUser directly in these functions
                window.fetchContacts = fetchContacts;
                window.fetchContacts('verifyOtp');
                window.fetchOfflineEphemeralMessages = fetchOfflineEphemeralMessages;
                window.fetchOfflineEphemeralMessages();
                window.connectSocket();
                
                // Refresh UI components
                if (typeof window.refreshContactsUI === 'function') {
                    window.refreshContactsUI();
                }
                
                if (typeof window.refreshChatsUI === 'function') {
                    window.refreshChatsUI('auth.js:400 (verifyOtp)');
                }
            } catch (err) {
                console.error('Error initializing app functions:', err);
            }
        }, 500); // Increased delay to ensure everything is loaded
    } catch (err) {
        loadingContainer.classList.add('hidden');
        setLoadingState(verifyBtn, false);
        console.error('Error verifying OTP:', err);
        otpErr.textContent = 'Network error. Please try again.';
    }
}

/**
 * Update the user display in the header
 * @param {Object} user - The user object
 */
function updateUserDisplay(user) {
    if (!user) return;
    
    // Update username display
    const userDisplay = document.getElementById('userDisplay');
    if (userDisplay) {
        userDisplay.textContent = user.username || 'User';
    }
    
    // Update anonId display
    const userAnonId = document.getElementById('userAnonId');
    if (userAnonId) {
        userAnonId.textContent = user.anonId || '';
    }
    
    // Update user menu
    const userMenuName = document.getElementById('userMenuName');
    if (userMenuName) {
        userMenuName.textContent = user.username || 'User';
    }
    
    const userMenuAnonId = document.getElementById('userMenuAnonId');
    if (userMenuAnonId) {
        userMenuAnonId.textContent = user.anonId || '';
    }
    
    // Update profile picture
    const userProfilePic = document.getElementById('userProfilePic');
    if (userProfilePic) {
        if (user.pfp) {
            userProfilePic.innerHTML = `<img src="${user.pfp}" alt="${user.username}" class="w-full h-full object-cover rounded-full">`;
        } else {
            const initials = user.username ? user.username.split(' ').map(n => n[0]).join('').toUpperCase() : '';
            userProfilePic.innerHTML = `<div class="w-full h-full flex items-center justify-center bg-purple-primary rounded-full">${initials}</div>`;
        }
    }
}

/**
 * Show a step in the onboarding process with animation.
 */
function showStep(id) {
    const element = document.getElementById(id);
    if (element) {
        element.classList.remove('hidden');
        element.classList.add('step-transition');
        
        // Update progress indicator
        updateProgressIndicator(id);
        
        // Focus first input in the step
        const firstInput = element.querySelector('input');
        if (firstInput) {
            setTimeout(() => firstInput.focus(), 300);
        }
    }
}

/**
 * Hide a step in the onboarding process with animation.
 */
function hideStep(id) {
    const element = document.getElementById(id);
    if (element) {
        element.classList.add('fade-out');
        setTimeout(() => {
            element.classList.add('hidden');
            element.classList.remove('fade-out');
        }, 200);
    }
}

/**
 * Update progress indicator based on current step
 */
function updateProgressIndicator(currentStepId) {
    const steps = ['stepPhone', 'stepOTP', 'stepName', 'stepBio'];
    const currentIndex = steps.indexOf(currentStepId);
    
    steps.forEach((step, index) => {
        const indicator = document.querySelector(`[data-step="${step}"]`);
        if (!indicator) return;
        
        if (index < currentIndex) {
            indicator.classList.add('completed');
            indicator.classList.remove('active');
        } else if (index === currentIndex) {
            indicator.classList.add('active');
            indicator.classList.remove('completed');
        } else {
            indicator.classList.remove('active', 'completed');
        }
        
        // Update progress lines
        if (index < steps.length - 1) {
            const line = document.querySelector(`[data-line="${step}"]`);
            if (line) {
                if (index < currentIndex) {
                    line.classList.add('active');
                } else {
                    line.classList.remove('active');
                }
            }
        }
    });
}

/**
 * Show welcome modal with celebration effect
 */
function showWelcomeModal(user) {
    Swal.fire({
        title: 'Welcome to Veil! 🎉',
        html: `
            <div class="welcome-modal">
                <div class="welcome-avatar">
                    ${user.username.charAt(0).toUpperCase()}
                </div>
                <p class="welcome-message">
                    Hey ${user.username}! Your secure messaging journey begins now.
                </p>
                <div class="welcome-features">
                    <div class="feature-item">
                        <i class="fas fa-shield-alt"></i>
                        <span>End-to-end encryption</span>
                    </div>
                    <div class="feature-item">
                        <i class="fas fa-clock"></i>
                        <span>Ephemeral messaging</span>
                    </div>
                    <div class="feature-item">
                        <i class="fas fa-user-secret"></i>
                        <span>Complete privacy</span>
                    </div>
                </div>
            </div>
        `,
        background: '#1a1a1a',
        showConfirmButton: true,
        confirmButtonText: "Let's Start!",
        confirmButtonColor: '#6C4EF6',
        allowOutsideClick: false,
        customClass: {
            popup: 'welcome-modal-popup',
            title: 'welcome-modal-title',
            confirmButton: 'welcome-modal-button'
        },
        didOpen: () => {
            // Add floating animation to features
            const features = document.querySelectorAll('.feature-item');
            features.forEach((feature, index) => {
                feature.style.animation = `float 3s ease-in-out ${index * 0.2}s infinite`;
            });
        }
    });
}

/**
 * Show user profile modal
 */
function showUserProfile() {
    // Close the user menu
    toggleUserMenu();
    
    // TODO: Implement user profile modal
    showToast('User profile feature coming soon!', 'info');
}

/**
 * Show user settings modal
 */
function showUserSettings() {
    // Close the user menu
    toggleUserMenu();
    
    // TODO: Implement settings modal
    showToast('Settings feature coming soon!', 'info');
}

/**
 * Handle user logout.
 */
function handleLogout() {
    window.location.reload();
}

/**
 * Properly cleanup socket connection
 */
function cleanupSocket() {
    if (window.socket) {
        // Emit offline status before disconnecting
        window.socket.emit('userStatus', { online: false });
        
        // Remove all listeners to prevent memory leaks
        window.socket.removeAllListeners();
        
        // Disconnect the socket
        window.socket.disconnect();
        
        // Clear the socket instance
        window.socket = null;
        
        console.log('Socket connection cleaned up');
    }
}

/**
 * Logout function
 */
function logout() {
    console.log('Logging out...');
    
    // Reset auth state
    authState.phoneNumber = '';
    authState.username = '';
    authState.bio = '';
    authState.phoneNotRegistered = false;
    authState.requestToken = null;
    
    // Clear token and user data from sessionStorage using apiUtils if available
    if (window.apiUtils) {
        window.apiUtils.clearAuthToken();
        window.apiUtils.clearCurrentUser();
        console.log('Token cleared from sessionStorage using apiUtils');
    } else {
        // Fallback to clearing sessionStorage directly
        sessionStorage.removeItem('authToken');
        sessionStorage.removeItem('currentUser');
        console.log('Token cleared from sessionStorage directly');
    }
    
    // Also clear any legacy localStorage items
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('appState'); // Also clear the app state
    
    // Clear AppState
    window.AppState.token = null;
    window.AppState.currentUser = null;
    window.AppState.activeContactId = null;
    window.AppState.contacts = [];
    window.AppState.saveToLocalStorage();
    
    // Cleanup socket connection
    cleanupSocket();
    
    // Reset the UI to initial state
    resetAuthUI();
    
    console.log('User logged out successfully');
    
    // Show success toast if available
    if (window.Toast?.fire) {
        window.Toast.fire({
            icon: 'success',
            title: 'Logged out successfully'
        });
    } else if (window.Swal?.fire) {
        window.Swal.fire({
            icon: 'success',
            title: 'Logged out successfully',
            toast: true,
            position: 'bottom-end',
            showConfirmButton: false,
            timer: 3000
        });
    }
    
    // Reload the page to ensure clean state
    setTimeout(() => {
        window.location.reload();
    }, 500);
}

/**
 * Reset the auth UI to its initial state
 */
function resetAuthUI() {
    // Get all the step elements
    const onboardingContainer = document.getElementById('onboardingContainer');
    const chatScreen = document.getElementById('chatScreen');
    const stepPhone = document.getElementById('stepPhone');
    const stepOTP = document.getElementById('stepOTP');
    const stepName = document.getElementById('stepName');
    const stepBio = document.getElementById('stepBio');

    // First, show the onboarding container and hide chat screen
    if (onboardingContainer) onboardingContainer.classList.remove('hidden');
    if (chatScreen) chatScreen.classList.add('hidden');

    // Hide all steps except phone
    [stepOTP, stepName, stepBio].forEach(step => {
        if (step) step.classList.add('hidden');
    });
    if (stepPhone) stepPhone.classList.remove('hidden');

    // Reset country select and phone input
    const countrySelect = document.getElementById('countrySelect');
    const phoneInput = document.getElementById('phoneInput');
    const selectedFlag = document.getElementById('selectedFlag');
    const selectedCountryCode = document.getElementById('selectedCountryCode');

    // Set default country (GB/44)
    const defaultCountry = window.phoneCountryList?.find(c => c.code === 'GB') || { code: 'GB', dialCode: '44' };
    
    if (countrySelect) {
        countrySelect.value = defaultCountry.dialCode;
    }
    
    if (selectedFlag) {
        selectedFlag.className = `flag-icon flag-icon-${defaultCountry.code.toLowerCase()}`;
    }
    
    if (selectedCountryCode) {
        selectedCountryCode.textContent = `+${defaultCountry.dialCode}`;
    }
    
    if (phoneInput) {
        // Set the phone input with the country code prefix
        phoneInput.value = `+${defaultCountry.dialCode} `;
        // Focus and move cursor to end
        setTimeout(() => {
            phoneInput.focus();
            phoneInput.setSelectionRange(phoneInput.value.length, phoneInput.value.length);
        }, 100);
    }

    // Reset OTP inputs
    const otpInputs = document.querySelectorAll('.otp-input');
    otpInputs.forEach(input => {
        input.value = '';
        input.classList.remove('border-purple-primary');
    });
    const otpHiddenInput = document.getElementById('otpInput');
    if (otpHiddenInput) otpHiddenInput.value = '';

    // Reset username and bio inputs
    const usernameInput = document.getElementById('regUsername');
    const bioInput = document.getElementById('regBio');
    if (usernameInput) usernameInput.value = '';
    if (bioInput) bioInput.value = '';

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
}

// Make functions available globally
window.currentUser = currentUser;
window.logout = logout;
window.verifyOtp = verifyOtp;
window.handleIncomingEphemeral = handleIncomingEphemeral;
window.fetchOfflineEphemeralMessages = fetchOfflineEphemeralMessages;
window.fetchUserById = fetchUserById;
console.log('Auth module loaded, functions exposed to window:', {
  currentUser: !!window.currentUser,
  logout: !!window.logout,
  verifyOtp: !!window.verifyOtp,
  handleIncomingEphemeral: !!window.handleIncomingEphemeral,
  fetchOfflineEphemeralMessages: !!window.fetchOfflineEphemeralMessages,
  fetchUserById: !!window.fetchUserById
});

// Export functions
export {
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
    skipBio,
    updateUserDisplay,
    showWelcomeModal,
    showUserProfile,
    showUserSettings
};
