/**
 * API Utilities Module
 * 
 * This module provides utility functions for interacting with the API,
 * including authentication token management and standardized request methods.
 */

// Base URL for API requests
const API_BASE_URL = 'http://localhost:4000/api';

// Storage keys
const AUTH_TOKEN_KEY = 'authToken';
const CURRENT_USER_KEY = 'currentUser';

/**
 * Gets the authentication token from session storage
 * @returns {string|null} The authentication token or null if not found
 */
function getAuthToken() {
    return sessionStorage.getItem(AUTH_TOKEN_KEY);
}

/**
 * Sets the authentication token in session storage
 * @param {string} token - The authentication token to store
 */
function setAuthToken(token) {
    sessionStorage.setItem(AUTH_TOKEN_KEY, token);
    
    // Clear any token from localStorage to prevent using old tokens
    localStorage.removeItem(AUTH_TOKEN_KEY);
}

/**
 * Clears the authentication token from session storage
 */
function clearAuthToken() {
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_TOKEN_KEY); // Also clear from localStorage
}

/**
 * Gets the current user from session storage
 * @returns {Object|null} The current user object or null if not found
 */
function getCurrentUser() {
    const userJson = sessionStorage.getItem(CURRENT_USER_KEY);
    return userJson ? JSON.parse(userJson) : null;
}

/**
 * Sets the current user in session storage
 * @param {Object} user - The user object to store
 */
function setCurrentUser(user) {
    sessionStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    
    // Clear any user from localStorage to prevent using old data
    localStorage.removeItem(CURRENT_USER_KEY);
}

/**
 * Clears the current user from session storage
 */
function clearCurrentUser() {
    sessionStorage.removeItem(CURRENT_USER_KEY);
    localStorage.removeItem(CURRENT_USER_KEY); // Also clear from localStorage
}

/**
 * Makes an authenticated API request
 * @param {string} endpoint - The API endpoint to request
 * @param {Object} options - The fetch options
 * @returns {Promise<Object>} The response data
 */
async function apiRequest(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

    try {
        // Use our getAuthToken function to get the token
        const token = getAuthToken();
        console.log('Using token for API request:', token ? 'Token exists' : 'No token');
        
        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : '',
                ...options.headers
            }
        });

        // Check if response is OK
        if (!response.ok) {
            // Store status for error handling
            const error = new Error(`API request failed with status ${response.status}`);
            error.status = response.status;

            // Try to get error details
            try {
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    const errorData = await response.json();
                    error.data = errorData;
                } else {
                    const text = await response.text();
                    error.text = text.substring(0, 100); // Just get a snippet
                }
            } catch (parseError) {
                error.parseError = parseError.message;
            }

            throw error;
        }

        // Check content type
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return await response.json();
        } else {
            // For non-JSON responses, return text
            return { text: await response.text() };
        }
    } catch (error) {
        console.error('API request error:', error);

        // Handle authentication errors
        if (error.status === 401) {
            console.error('Authentication error: Token may be invalid or expired');
            
            // Check if we're on the login page
            const isOnLoginPage = document.getElementById('onboardingContainer') && 
                                 !document.getElementById('onboardingContainer').classList.contains('hidden');
            
            // If not on login page, redirect to login
            if (!isOnLoginPage) {
                console.log('Redirecting to login due to authentication error');
                // Clear token and user data
                localStorage.removeItem('token');
                localStorage.removeItem('currentUser');
                window.AppState.token = null;
                window.AppState.currentUser = null;
                window.currentUser = null;
                
                // Show login screen
                document.getElementById('onboardingContainer').classList.remove('hidden');
                document.getElementById('chatScreen').classList.add('hidden');
                
                // Show error message
                showToast('Session expired. Please log in again.', 'error');
            }
        }

        throw error;
    }
}

/**
 * Makes a GET request to the API
 * @param {string} endpoint - The API endpoint to request
 * @param {Object} options - Additional fetch options
 * @returns {Promise<Object>} The response data
 */
function apiGet(endpoint, options = {}) {
    return apiRequest(endpoint, {
        method: 'GET',
        ...options
    });
}

/**
 * Makes a POST request to the API
 * @param {string} endpoint - The API endpoint to request
 * @param {Object} body - The request body
 * @param {Object} options - Additional fetch options
 * @returns {Promise<Object>} The response data
 */
function apiPost(endpoint, body, options = {}) {
    return apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
        ...options
    });
}

function getUserData() {
    const data = localStorage.getItem('userData');
    return data ? JSON.parse(data) : null;
}

/**
 * Makes a PUT request to the API
 * @param {string} endpoint - The API endpoint to request
 * @param {Object} body - The request body
 * @param {Object} options - Additional fetch options
 * @returns {Promise<Object>} The response data
 */
function apiPut(endpoint, body, options = {}) {
    return apiRequest(endpoint, {
        method: 'PUT',
        body: JSON.stringify(body),
        ...options
    });
}

/**
 * Makes a DELETE request to the API
 * @param {string} endpoint - The API endpoint to request
 * @param {Object} options - Additional fetch options
 * @returns {Promise<Object>} The response data
 */
function apiDelete(endpoint, options = {}) {
    return apiRequest(endpoint, {
        method: 'DELETE',
        ...options
    });
}

// Expose functions to window object
window.apiUtils = {
    getAuthToken,
    setAuthToken,
    clearAuthToken,
    getCurrentUser,
    setCurrentUser,
    clearCurrentUser,
    apiRequest,
    apiGet,
    apiPost,
    apiPut,
    apiDelete,
    getUserData
}; 