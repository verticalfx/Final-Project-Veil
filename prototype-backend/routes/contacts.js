// routes/contacts.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const mongoose = require('mongoose');

/**
 * GET /contacts
 * Get all contacts for the authenticated user
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const user = await User.findById(userId).populate('contacts', '_id username bio pfp anonId');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    return res.json({ contacts: user.contacts });
  } catch (err) {
    console.error('GET /contacts error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /contacts/:contactId
 * Add a contact
 */
router.post('/:contactId', async (req, res) => {
  try {
    const userId = req.user.userId;
    const contactId = req.params.contactId;
    
    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(contactId)) {
      return res.status(400).json({ error: 'Invalid contact ID format' });
    }
    
    // Check if trying to add self
    if (userId === contactId) {
      return res.status(400).json({ error: 'Cannot add yourself as a contact' });
    }
    
    // Check if contact exists
    const contact = await User.findById(contactId);
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if contact is already added
    if (user.contacts.includes(contactId)) {
      return res.status(400).json({ error: 'Contact already added' });
    }
    
    // Add contact
    user.contacts.push(contactId);
    await user.save();
    
    // Get the contact details to return
    const contactDetails = await User.findById(contactId).select('_id username bio pfp anonId');
    
    return res.json({
      message: 'Contact added successfully',
      contact: contactDetails
    });
  } catch (err) {
    console.error('POST /contacts/:contactId error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * DELETE /contacts/:contactId
 * Remove a contact from the authenticated user's contact list
 */
router.delete('/:contactId', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { contactId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(contactId)) {
      return res.status(400).json({ error: 'Invalid contact ID' });
    }

    // Find the authenticated user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if contact exists in the user's contacts
    const contactIndex = user.contacts.findIndex(
      (c) => c.toString() === contactId
    );

    if (contactIndex === -1) {
      return res.status(404).json({ error: 'Contact not found in your contacts' });
    }

    // Remove from contacts
    user.contacts.splice(contactIndex, 1);
    await user.save();

    return res.json({ message: 'Contact removed successfully' });
  } catch (err) {
    console.error('DELETE /contacts/:contactId error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /contacts/search
 * Search for users by username or anonymous ID
 */
router.get('/search', async (req, res) => {
  try {
    const { searchTerm } = req.query;
    
    if (!searchTerm) {
      return res.status(400).json({ error: 'Search term is required' });
    }
    
    // Search for users by username or anonymous ID
    const users = await User.find({
      $or: [
        { username: { $regex: searchTerm, $options: 'i' } },
        { anonId: { $regex: searchTerm, $options: 'i' } }
      ]
    }).select('_id username bio pfp anonId');
    
    return res.json({ users });
  } catch (err) {
    console.error('GET /contacts/search error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /contacts/search
 * Search for users by username or phone number (POST version)
 */
router.post('/search', async (req, res) => {
  try {
    const { userId, searchTerm } = req.body;

    if (!searchTerm) {
      return res.status(400).json({ error: 'Search term is required' });
    }

    // Validate userId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    // Find the user to ensure they exist
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get the user's contacts for privacy checks
    const userContacts = user.contacts.map(c => c.toString());

    // Build the search query
    const baseQuery = {
      _id: { $ne: userId } // Exclude the current user
    };

    // Create separate queries for username and phone number
    const usernameQuery = {
      ...baseQuery,
      username: { $regex: searchTerm, $options: 'i' }
    };

    // Phone number query needs to respect privacy settings
    const phoneQuery = {
      ...baseQuery,
      phoneNumber: { $regex: searchTerm, $options: 'i' },
      $or: [
        // Phone is visible to everyone
        { 'privacySettings.phoneNumberVisibility': 'everyone' },
        // Phone is visible to contacts and user is in their contacts
        { 
          'privacySettings.phoneNumberVisibility': 'contacts',
          '_id': { $in: userContacts }
        },
        // User has been explicitly granted permission to see phone
        {
          'privacySettings.phoneNumberSharedWith': { $in: [new mongoose.Types.ObjectId(userId)] }
        }
      ]
    };

    // Combine queries
    const users = await User.find({
      $or: [usernameQuery, phoneQuery]
    }).limit(10).select('_id username phoneNumber bio profilePicture privacySettings');

    // Filter out phone numbers based on privacy settings
    const filteredUsers = users.map(user => {
      const userData = user.toObject();
      
      // Check if phone number should be hidden
      const isContact = userContacts.includes(user._id.toString());
      const isSharedWithUser = user.privacySettings?.phoneNumberSharedWith?.some(
        id => id.toString() === userId
      );
      
      // Hide phone number based on privacy settings
      if (
        user.privacySettings?.phoneNumberVisibility === 'nobody' ||
        (user.privacySettings?.phoneNumberVisibility === 'contacts' && !isContact && !isSharedWithUser)
      ) {
        userData.phoneNumber = null;
      }
      
      return userData;
    });

    return res.json({ users: filteredUsers });
  } catch (err) {
    console.error('POST /contacts/search error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /contacts
 * Add a contact (with contactId in request body)
 */
router.post('/', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { contactId } = req.body;
    
    if (!contactId) {
      return res.status(400).json({ error: 'Contact ID is required' });
    }
    
    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(contactId)) {
      return res.status(400).json({ error: 'Invalid contact ID format' });
    }
    
    // Check if trying to add self
    if (userId === contactId) {
      return res.status(400).json({ error: 'Cannot add yourself as a contact' });
    }
    
    // Check if contact exists
    const contact = await User.findById(contactId);
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if contact is already added
    if (user.contacts.includes(contactId)) {
      return res.status(400).json({ error: 'Contact already added' });
    }
    
    // Add contact
    user.contacts.push(contactId);
    await user.save();
    
    // Get the contact details to return
    const contactDetails = await User.findById(contactId).select('_id username bio pfp anonId');
    
    return res.json({
      message: 'Contact added successfully',
      contact: contactDetails
    });
  } catch (err) {
    console.error('POST /contacts error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
