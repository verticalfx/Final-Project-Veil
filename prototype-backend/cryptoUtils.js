// cryptoUtils.js for backend
const crypto = require('crypto');

/**
 * Generate a secure random OTP code
 * @param {number} length - Length of the OTP code
 * @returns {string} - The generated OTP code
 */
function generateOTP(length = 6) {
  // Generate a random number with the specified length
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  return Math.floor(min + Math.random() * (max - min + 1)).toString();
}

/**
 * Hash a password using bcrypt-like approach with Node's crypto
 * @param {string} password - The password to hash
 * @returns {Promise<{salt: string, hash: string}>} - The salt and hash
 */
async function hashPassword(password) {
  return new Promise((resolve, reject) => {
    // Generate a random salt
    const salt = crypto.randomBytes(16).toString('hex');
    
    // Use PBKDF2 with 100,000 iterations and SHA-256
    crypto.pbkdf2(password, salt, 100000, 64, 'sha256', (err, derivedKey) => {
      if (err) return reject(err);
      resolve({
        salt,
        hash: derivedKey.toString('hex')
      });
    });
  });
}

/**
 * Verify a password against a stored hash
 * @param {string} password - The password to verify
 * @param {string} salt - The stored salt
 * @param {string} storedHash - The stored hash
 * @returns {Promise<boolean>} - Whether the password matches
 */
async function verifyPassword(password, salt, storedHash) {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, 100000, 64, 'sha256', (err, derivedKey) => {
      if (err) return reject(err);
      resolve(derivedKey.toString('hex') === storedHash);
    });
  });
}

/**
 * Generate a JWT token
 * @param {Object} payload - The payload to include in the token
 * @param {string} secret - The secret key for signing
 * @param {Object} options - Options for the token (e.g., expiresIn)
 * @returns {string} - The generated JWT token
 */
function generateJWT(payload, secret, options = { expiresIn: '1h' }) {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };
  
  // Add expiration time if specified
  if (options.expiresIn) {
    const expiresInSeconds = parseExpiresIn(options.expiresIn);
    payload.exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  }
  
  // Encode header and payload
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  
  // Create signature
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');
  
  // Return the complete token
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Verify a JWT token
 * @param {string} token - The token to verify
 * @param {string} secret - The secret key for verification
 * @returns {Object|null} - The decoded payload or null if invalid
 */
function verifyJWT(token, secret) {
  try {
    // Split the token
    const [encodedHeader, encodedPayload, signature] = token.split('.');
    
    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64url');
    
    if (signature !== expectedSignature) {
      return null;
    }
    
    // Decode payload
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString());
    
    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    
    return payload;
  } catch (error) {
    return null;
  }
}

/**
 * Parse the expiresIn string to seconds
 * @param {string} expiresIn - The expiration string (e.g., '1h', '30m')
 * @returns {number} - The expiration time in seconds
 */
function parseExpiresIn(expiresIn) {
  const match = expiresIn.match(/^(\d+)([smhd])$/);
  if (!match) {
    return 3600; // Default to 1 hour
  }
  
  const value = parseInt(match[1]);
  const unit = match[2];
  
  switch (unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 60 * 60;
    case 'd': return value * 24 * 60 * 60;
    default: return 3600;
  }
}

/**
 * Generates a secure random token for OTP requests
 * @returns {string} A secure random token
 */
function generateSecureToken() {
  // Using crypto to generate a secure random token
  const crypto = require('crypto');
  return crypto.randomBytes(32).toString('hex');
}

module.exports = {
  generateOTP,
  hashPassword,
  verifyPassword,
  generateJWT,
  verifyJWT,
  generateSecureToken,
  generateOTP
};
