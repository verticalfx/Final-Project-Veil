// routes/users.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { hashPassword } = require('../cryptoUtils');
const mongoose = require('mongoose');

/**
 * GET /users/:id
 * Get a user's public profile
 */
router.get('/:id', async (req, res) => {
  try {
    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }
    
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Return only public fields
    return res.json({
      _id: user._id,
      anonId: user.anonId,
      username: user.username,
      bio: user.bio,
      pfp: user.pfp
    });
  } catch (err) {
    console.error('GET /users/:id error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /users/anon/:anonId
 * Get a user's public profile by anonymous ID
 */
router.get('/anon/:anonId', async (req, res) => {
  try {
    const anonId = req.params.anonId;
    
    const user = await User.findOne({ anonId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if the requester is allowed to see the phone number
    let showPhoneNumber = false;
    
    if (user.privacySettings && user.privacySettings.phoneNumberVisibility) {
      if (user.privacySettings.phoneNumberVisibility === 'everyone') {
        showPhoneNumber = true;
      } else if (user.privacySettings.phoneNumberVisibility === 'contacts' && 
                user.contacts && user.contacts.includes(req.user.userId)) {
        showPhoneNumber = true;
      } else if (user.privacySettings.phoneNumberSharedWith && 
                user.privacySettings.phoneNumberSharedWith.includes(req.user.userId)) {
        showPhoneNumber = true;
      }
    }
    
    // Return only public fields
    return res.json({
      _id: user._id,
      anonId: user.anonId,
      username: user.username,
      phoneNumber: showPhoneNumber ? user.phoneNumber : undefined,
      bio: user.bio,
      pfp: user.pfp
    });
  } catch (err) {
    console.error('GET /users/anon/:anonId error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /users/me
 * Get the authenticated user's profile
 */
router.get('/me', async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    return res.json({
      _id: user._id,
      anonId: user.anonId,
      username: user.username,
      phoneNumber: user.phoneNumber, // Only include phone number in own profile
      bio: user.bio,
      pfp: user.pfp,
      createdAt: user.createdAt,
      lastActive: user.lastActive
    });
  } catch (err) {
    console.error('GET /users/me error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * PUT /users/me
 * Update the authenticated user's profile
 */
router.put('/me', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { username, bio, pfp } = req.body;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if username is being changed and if it's already taken
    if (username && username !== user.username) {
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return res.status(400).json({ error: 'Username already taken' });
      }
      user.username = username;
    }
    
    // Update other fields if provided
    if (bio !== undefined) user.bio = bio;
    if (pfp !== undefined) user.pfp = pfp;
    
    // Update last active timestamp
    user.lastActive = new Date();
    
    await user.save();
    
    return res.json({
      message: 'Profile updated successfully',
      user: {
        _id: user._id,
        username: user.username,
        phoneNumber: user.phoneNumber,
        bio: user.bio,
        pfp: user.pfp
      }
    });
  } catch (err) {
    console.error('PUT /users/me error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * PUT /users/me/password
 * Set or update the authenticated user's password
 */
router.put('/me/password', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { password } = req.body;
    
    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Hash the password
    const { salt, hash } = await hashPassword(password);
    
    // Update the user's password
    user.passwordSalt = salt;
    user.passwordHash = hash;
    
    await user.save();
    
    return res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('PUT /users/me/password error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * DELETE /users/me
 * Deactivate the authenticated user's account
 */
router.delete('/me', async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Soft delete - mark as inactive
    user.isActive = false;
    await user.save();
    
    return res.json({ message: 'Account deactivated successfully' });
  } catch (err) {
    console.error('DELETE /users/me error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * PUT /users/:id/privacy
 * Update a user's privacy settings
 */
router.put('/:id/privacy', async (req, res) => {
  try {
    const userId = req.params.id;
    const { phoneNumberVisibility } = req.body;
    
    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }
    
    // Validate privacy settings
    if (phoneNumberVisibility && !['everyone', 'contacts', 'nobody'].includes(phoneNumberVisibility)) {
      return res.status(400).json({ error: 'Invalid phone number visibility setting' });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Initialize privacy settings if they don't exist
    if (!user.privacySettings) {
      user.privacySettings = {};
    }
    
    // Update privacy settings
    if (phoneNumberVisibility) {
      user.privacySettings.phoneNumberVisibility = phoneNumberVisibility;
    }
    
    await user.save();
    
    return res.json({
      message: 'Privacy settings updated successfully',
      user: {
        _id: user._id,
        username: user.username,
        phoneNumber: user.phoneNumber,
        bio: user.bio,
        pfp: user.pfp,
        privacySettings: user.privacySettings
      }
    });
  } catch (err) {
    console.error('PUT /users/:id/privacy error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /users/me/blocked
 * Get the list of users blocked by the authenticated user
 */
router.get('/me/blocked', async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const user = await User.findById(userId).populate('blockedUsers', '_id username phoneNumber');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    return res.json({
      blockedUsers: user.blockedUsers || []
    });
  } catch (err) {
    console.error('GET /users/me/blocked error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /users/block/:id
 * Block a user
 */
router.post('/block/:id', async (req, res) => {
  try {
    const userId = req.user.userId;
    const targetUserId = req.params.id;
    
    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }
    
    // Check if trying to block self
    if (userId === targetUserId) {
      return res.status(400).json({ error: 'Cannot block yourself' });
    }
    
    // Check if target user exists
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User to block not found' });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Initialize blockedUsers array if it doesn't exist
    if (!user.blockedUsers) {
      user.blockedUsers = [];
    }
    
    // Check if user is already blocked
    if (user.blockedUsers.includes(targetUserId)) {
      return res.status(400).json({ error: 'User is already blocked' });
    }
    
    // Add user to blocked list
    user.blockedUsers.push(targetUserId);
    await user.save();
    
    return res.json({
      message: 'User blocked successfully',
      blockedUserId: targetUserId
    });
  } catch (err) {
    console.error('POST /users/block/:id error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * DELETE /users/block/:id
 * Unblock a user
 */
router.delete('/block/:id', async (req, res) => {
  try {
    const userId = req.user.userId;
    const targetUserId = req.params.id;
    
    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if user is not blocked
    if (!user.blockedUsers || !user.blockedUsers.includes(targetUserId)) {
      return res.status(400).json({ error: 'User is not blocked' });
    }
    
    // Remove user from blocked list
    user.blockedUsers = user.blockedUsers.filter(id => id.toString() !== targetUserId);
    await user.save();
    
    return res.json({
      message: 'User unblocked successfully',
      unblockedUserId: targetUserId
    });
  } catch (err) {
    console.error('DELETE /users/block/:id error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /users/me/settings
 * Get the authenticated user's settings
 */
router.get('/me/settings', async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    return res.json({
      settings: user.settings || {
        notifications: {
          enabled: true,
          sound: true,
          vibration: true,
          messagePreview: true
        },
        theme: 'system',
        language: 'en',
        fontSize: 'medium',
        readReceipts: true,
        typingIndicators: true
      }
    });
  } catch (err) {
    console.error('GET /users/me/settings error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * PUT /users/me/settings
 * Update the authenticated user's settings
 */
router.put('/me/settings', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { settings } = req.body;
    
    if (!settings) {
      return res.status(400).json({ error: 'Settings object is required' });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Initialize settings if they don't exist
    if (!user.settings) {
      user.settings = {
        notifications: {
          enabled: true,
          sound: true,
          vibration: true,
          messagePreview: true
        },
        theme: 'system',
        language: 'en',
        fontSize: 'medium',
        readReceipts: true,
        typingIndicators: true
      };
    }
    
    // Update notification settings
    if (settings.notifications) {
      if (settings.notifications.enabled !== undefined) {
        user.settings.notifications.enabled = settings.notifications.enabled;
      }
      if (settings.notifications.sound !== undefined) {
        user.settings.notifications.sound = settings.notifications.sound;
      }
      if (settings.notifications.vibration !== undefined) {
        user.settings.notifications.vibration = settings.notifications.vibration;
      }
      if (settings.notifications.messagePreview !== undefined) {
        user.settings.notifications.messagePreview = settings.notifications.messagePreview;
      }
    }
    
    // Update other settings
    if (settings.theme !== undefined && ['light', 'dark', 'system'].includes(settings.theme)) {
      user.settings.theme = settings.theme;
    }
    if (settings.language !== undefined) {
      user.settings.language = settings.language;
    }
    if (settings.fontSize !== undefined && ['small', 'medium', 'large'].includes(settings.fontSize)) {
      user.settings.fontSize = settings.fontSize;
    }
    if (settings.readReceipts !== undefined) {
      user.settings.readReceipts = settings.readReceipts;
    }
    if (settings.typingIndicators !== undefined) {
      user.settings.typingIndicators = settings.typingIndicators;
    }
    
    await user.save();
    
    return res.json({
      message: 'Settings updated successfully',
      settings: user.settings
    });
  } catch (err) {
    console.error('PUT /users/me/settings error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /users/search/anon/:anonId
 * Search for a user by their anonymous ID
 */
router.get('/search/anon/:anonId', async (req, res) => {
  try {
    const anonId = req.params.anonId;
    
    // Validate anonId format
    if (!anonId.match(/^888\d{7}$/)) {
      return res.status(400).json({ error: 'Invalid anonymous ID format. Must be 888 followed by 7 digits.' });
    }
    
    const user = await User.findOne({ anonId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if the requester is allowed to see the phone number
    let showPhoneNumber = false;
    
    if (user.privacySettings && user.privacySettings.phoneNumberVisibility) {
      if (user.privacySettings.phoneNumberVisibility === 'everyone') {
        showPhoneNumber = true;
      } else if (user.privacySettings.phoneNumberVisibility === 'contacts' && 
                user.contacts && user.contacts.includes(req.user.userId)) {
        showPhoneNumber = true;
      } else if (user.privacySettings.phoneNumberSharedWith && 
                user.privacySettings.phoneNumberSharedWith.includes(req.user.userId)) {
        showPhoneNumber = true;
      }
    }
    
    // Return only public fields
    return res.json({
      _id: user._id,
      anonId: user.anonId,
      username: user.username,
      phoneNumber: showPhoneNumber ? user.phoneNumber : undefined,
      bio: user.bio,
      pfp: user.pfp
    });
  } catch (err) {
    console.error('GET /users/search/anon/:anonId error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
