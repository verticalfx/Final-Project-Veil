// middleware/auth.js
const { verifyJWT } = require('../cryptoUtils');
const config = require('../config');

/**
 * Middleware to authenticate JWT tokens
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function authenticateJWT(req, res, next) {
  // Get the authorization header
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ error: 'Authorization header missing' });
  }
  
  // Check if it's a Bearer token
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ error: 'Invalid authorization format. Use: Bearer <token>' });
  }
  
  const token = parts[1];
  
  // Verify the token
  const decoded = verifyJWT(token, config.auth.jwtSecret);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  
  // Add the user info to the request object
  req.user = decoded;
  
  // Continue to the next middleware or route handler
  next();
}

module.exports = {
  authenticateJWT
}; 