/**
 * config.js - Global configuration
 */

const TEST_MODE = true;

const API_CONFIG = {
    BASE_URL: TEST_MODE ? 'http://localhost:4000' : 'http://138.197.106.91:4000',
    SOCKET_URL: TEST_MODE ? 'http://localhost:4000' : 'http://138.197.106.91:4000',
    ENDPOINTS: {
        AUTH: '/auth',
        CONTACTS: '/contacts',
        MESSAGES: '/messages',
        USERS: '/users'
    }
};


// Freeze the config to prevent modifications
Object.freeze(API_CONFIG);
Object.freeze(API_CONFIG.ENDPOINTS);

export default API_CONFIG; 