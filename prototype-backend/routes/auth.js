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
 * Validate phone number format
 * @param {string} phoneNumber 
 * @returns {boolean}
 */
function isValidPhoneNumber(phoneNumber) {
  // Basic E.164 format validation
  return /^\+[1-9]\d{1,14}$/.test(phoneNumber);
}

/**
 * STEP 1: User enters phone number
 */
router.post('/start', async (req, res) => {
  const { phoneNumber } = req.body;
  const previousToken = req.headers['x-otp-request-token'];
  
  if (!phoneNumber) {
    return res.status(400).json({ error: 'Phone number is required' });
  }

  if (!isValidPhoneNumber(phoneNumber)) {
    return res.status(400).json({ error: 'Invalid phone number format. Please use international format (e.g., +441234567890)' });
  }
  
  // Check for spam/rate limiting
  const now = Date.now();
  const lastRequest = otpRequestLog.get(phoneNumber);
  
  // If this is a resend request, verify the token
  if (previousToken) {
    if (!validateRequestToken(phoneNumber, previousToken)) {
      return res.status(400).json({ error: 'Invalid or expired request token' });
    }
    
    // Check cooldown period - skip in demo mode
    if (!config.sms.demoMode && lastRequest && (now - lastRequest.timestamp < config.auth.otpCooldown * 1000)) {
      return res.status(429).json({ 
        error: 'Please wait before requesting another OTP',
        retryAfter: Math.ceil((lastRequest.timestamp + (config.auth.otpCooldown * 1000) - now) / 1000)
      });
    }
  }
  
  try {
    // Generate OTP and new request token
    const otp = config.sms.demoMode ? config.sms.demoOtp : generateOTP(config.auth.otpLength);
    const requestToken = generateSecureToken();
    const expiresAt = now + (config.auth.otpExpiresIn * 1000);
    
    // Store OTP with expiration and request token
    otpStore.set(phoneNumber, { otp, expiresAt, requestToken, attempts: 0 });
    
    // Log this request for rate limiting
    otpRequestLog.set(phoneNumber, { 
      timestamp: now,
      count: (lastRequest ? lastRequest.count + 1 : 1)
    });
    
    // Send OTP via SMS
    const smsResult = await sendOTP(phoneNumber, otp);
    
    // Set the request token in the response header
    res.set('X-OTP-Request-Token', requestToken);
    
    let user = await User.findOne({ phoneNumber });
    
    // Prepare response
    const response = {
      message: user ? 'User found. OTP sent.' : 'Phone not registered, register flow',
      needsRegistration: !user,
      smsStatus: smsResult.success ? 'sent' : 'failed'
    };

    // Add error info if SMS failed
    if (!smsResult.success) {
      response.smsError = smsResult.error;
      response.retryable = smsResult.retryable;
    }

    // Only include OTP in demo mode
    if (config.sms.demoMode) {
      response.otp = otp;
      response.demoMode = true;
    }

    // Log OTP in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`OTP for ${phoneNumber}: ${otp}`);
    }

    return res.json(response);
  } catch (err) {
    console.error('Error in /start:', err);
    return res.status(500).json({ 
      error: 'Failed to process request',
      retryable: true
    });
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
  const { phoneNumber, otp } = req.body;
  const requestToken = req.headers['x-otp-request-token'];
  
  if (!phoneNumber || !otp) {
    return res.status(400).json({ error: 'Phone number and OTP are required' });
  }
  
  if (!isValidPhoneNumber(phoneNumber)) {
    return res.status(400).json({ error: 'Invalid phone number format' });
  }
  
  // Get stored OTP data
  const otpData = otpStore.get(phoneNumber);
  
  if (!otpData) {
    return res.status(400).json({ error: 'No OTP request found for this number' });
  }
  
  // Check attempts
  if (otpData.attempts >= config.auth.maxOtpAttempts) {
    otpStore.delete(phoneNumber); // Clear the OTP after max attempts
    return res.status(400).json({ 
      error: 'Maximum verification attempts exceeded. Please request a new OTP.',
      maxAttemptsReached: true
    });
  }
  
  // Increment attempts
  otpData.attempts += 1;
  otpStore.set(phoneNumber, otpData);
  
  // Verify both the OTP and the request token
  if (otpData.otp !== otp || otpData.requestToken !== requestToken) {
    const remainingAttempts = config.auth.maxOtpAttempts - otpData.attempts;
    return res.status(400).json({ 
      error: 'Invalid OTP',
      remainingAttempts
    });
  }
  
  if (otpData.expiresAt < Date.now()) {
    otpStore.delete(phoneNumber);
    return res.status(400).json({ error: 'OTP has expired' });
  }
  
  try {
    // Find or create user
    let user = await User.findOne({ phoneNumber });
    if (!user) {
      // Generate unique anonId
      let anonId;
      let isAnonIdUnique = false;
      while (!isAnonIdUnique) {
        anonId = generateTelegramStyleAnonId();
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
    console.error('Error in /verify:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;



