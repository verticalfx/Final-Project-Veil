const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { generateOTP, generateJWT, generateSecureToken } = require('../cryptoUtils');
const config = require('../config');
const { sendOTP } = require('../utils/smsService');
const crypto = require('crypto');

// OTP store with expiration
const otpStore = new Map(); // { phoneNumber: { otp, expiresAt } }

// Request log for rate limiting
const otpRequestLog = new Map(); // { phoneNumber: { timestamp, count } }

/**
 * Clear expired OTPs from the store
 */
function clearExpiredOTPs() {
  const now = Date.now();
  for (const [phoneNumber, data] of otpStore.entries()) {
    if (data.expiresAt < now) {
      otpStore.delete(phoneNumber);
    }
  }
}

// Run cleanup every minute
setInterval(clearExpiredOTPs, 60000);

/**
 * Generate a unique anonymous identifier
 * Format: anon_XXXXXXXXXXXX (where X is alphanumeric)
 */
function generateAnonId() {
  const randomPart = crypto.randomBytes(8).toString('hex');
  return `anon_${randomPart}`;
}

/**
 * Generate a Telegram-style anonymous ID
 * Format: 888XXXXXXX (where X is a digit)
 * @returns {string} The generated anonymous ID
 */
function generateTelegramStyleAnonId() {
  // Generate 7 random digits
  const min = 0;
  const max = 9999999;
  const randomNum = Math.floor(min + Math.random() * (max - min + 1))
    .toString()
    .padStart(7, '0');
  
  return `888${randomNum}`;
}

/**
 * STEP 1: User enters phone number
 *   - If phone is registered, respond "OK, send OTP"
 *   - If phone not found, respond "register needed"
 */
router.post('/start', async (req, res) => {
  const { phoneNumber } = req.body;
  const previousToken = req.headers['x-otp-request-token']; // For resend requests
  
  // Check for spam/rate limiting
  const now = Date.now();
  const lastRequest = otpRequestLog.get(phoneNumber);
  
  // If this is a resend request, verify the token
  if (previousToken) {
    // Check if token is valid and not expired
    if (!validateRequestToken(phoneNumber, previousToken)) {
      return res.status(400).json({ error: 'Invalid or expired request token' });
    }
    
    // Check cooldown period (e.g., 30 seconds) - skip in demo mode
    if (!config.sms.demoMode && lastRequest && (now - lastRequest.timestamp < 30000)) {
      return res.status(429).json({ 
        error: 'Please wait before requesting another OTP',
        retryAfter: Math.ceil((lastRequest.timestamp + 30000 - now) / 1000)
      });
    }
  }
  
  // Generate OTP and new request token
  const otp = config.sms.demoMode ? config.sms.demoOtp : generateOTP();
  const requestToken = generateSecureToken(); // Generate a secure random token
  const expiresAt = now + (config.auth.otpExpiresIn * 1000);
  
  // Store OTP with expiration and request token
  otpStore.set(phoneNumber, { otp, expiresAt, requestToken });
  
  // Log this request for rate limiting
  otpRequestLog.set(phoneNumber, { 
    timestamp: now,
    count: (lastRequest ? lastRequest.count + 1 : 1)
  });
  
  // Send OTP via SMS
  const smsResult = await sendOTP(phoneNumber, otp);
  
  // Set the request token in the response header
  res.set('X-OTP-Request-Token', requestToken);
  
  if (!phoneNumber) {
    return res.status(400).json({ error: 'Phone number is required' });
  }

  try {
    let user = await User.findOne({ phoneNumber });
    
    if (user) {
      // Already registered => proceed with OTP
      console.log(`OTP for ${phoneNumber}: ${otp}`);
      
      return res.json({ 
        message: 'User found. OTP sent.', 
        needsRegistration: false,
        smsStatus: smsResult.success ? 'sent' : 'failed',
        // Only include OTP in demo mode
        ...(config.sms.demoMode && { otp })
      });
    } else {
      // Not registered => respond that they need to sign up
      console.log(`OTP for new user ${phoneNumber}: ${otp}`);
      
      return res.json({ 
        message: 'Phone not registered, register flow', 
        needsRegistration: true,
        smsStatus: smsResult.success ? 'sent' : 'failed',
        // Only include OTP in demo mode
        ...(config.sms.demoMode && { otp })
      });
    }
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

/**
 * STEP 2 (Register flow): If phoneNumber wasn't found, create a new user
 *   - Validate username
 *   - Save user
 *   - Return "OK" and also set up a dummy OTP
 */
router.post('/register', async (req, res) => {
  const { phoneNumber, username, bio, pfp } = req.body;

  // Basic checks
  if (!phoneNumber) {
    return res.status(400).json({ error: 'Phone number is required' });
  }
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  try {
    // Check if phone number is already registered
    let existingUser = await User.findOne({ phoneNumber });
    if (existingUser) {
      return res.status(400).json({ error: 'Phone number already registered' });
    }

    // Check if username is already taken
    existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    // Generate a unique Telegram-style anonymous ID
    let anonId;
    let isAnonIdUnique = false;
    
    // Keep generating until we find a unique one
    while (!isAnonIdUnique) {
      anonId = generateTelegramStyleAnonId();
      
      // Check if it's unique
      const existingAnonId = await User.findOne({ anonId });
      if (!existingAnonId) {
        isAnonIdUnique = true;
      }
    }

    // Create new user
    const user = new User({
      phoneNumber,
      anonId,
      username,
      bio: bio || '',
      pfp: pfp || '',
    });

    await user.save();
    
    // We don't clear the OTP here, as the user still needs to verify it
    // The user will need to verify the OTP in the next step

    return res.json({
      message: 'User registered successfully, please verify OTP',
      user: {
        _id: user._id,
        anonId: user.anonId,
        username: user.username,
        bio: user.bio,
        pfp: user.pfp,
      }
    });
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

/**
 * STEP 3: Verify OTP and login
 */
router.post('/verify', async (req, res) => {
  const { phoneNumber, otp, requestToken: bodyRequestToken } = req.body;
  const requestToken = req.headers['x-otp-request-token'] || bodyRequestToken;
  
  // Get stored OTP data
  const otpData = otpStore.get(phoneNumber);
  
  if (!otpData) {
    return res.status(400).json({ error: 'No OTP request found for this number' });
  }
  
  // Verify both the OTP and the request token
  if (otpData.otp !== otp || otpData.requestToken !== requestToken) {
    return res.status(400).json({ error: 'Invalid OTP or request token' });
  }
  
  if (otpData.expiresAt < Date.now()) {
    return res.status(400).json({ error: 'OTP has expired' });
  }
  
  try {
    // Find the user
    let user = await User.findOne({ phoneNumber });
    if (!user) {
      // Auto-register on the fly for test convenience
      let anonId;
      let isAnonIdUnique = false;

      while (!isAnonIdUnique) {
        anonId = generateTelegramStyleAnonId();
        // Ensure uniqueness
        // eslint-disable-next-line no-await-in-loop
        const existing = await User.findOne({ anonId });
        if (!existing) isAnonIdUnique = true;
      }

      user = new User({ phoneNumber, anonId });
      await user.save();
    }

    // Clear the OTP
    otpStore.delete(phoneNumber);

    // Generate JWT token
    const token = generateJWT(
      { userId: user._id, phoneNumber: user.phoneNumber, anonId: user.anonId },
      config.auth.jwtSecret,
      { expiresIn: config.auth.jwtExpiresIn }
    );

    return res.json({
      message: 'Login successful',
      user: {
        _id: user._id,
        anonId: user.anonId,
        username: user.username,
        bio: user.bio,
        pfp: user.pfp,
      },
      token,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

module.exports = router;



