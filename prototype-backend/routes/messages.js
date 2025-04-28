/*************************************************
 * routes/messages.js
 *************************************************/
const express = require('express');
const router = express.Router();
const EphemeralMessage = require('../models/EphemeralMessage');
const config = require('../config');

/**
 * GET /messages
 * Return ephemeral messages for the authenticated user
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Find all ephemeral messages for userId that haven't been delivered
    const msgs = await EphemeralMessage.find({ 
      toUserId: userId,
      delivered: false
    }).sort({ time: 1 });
    
    console.log(`Found ${msgs.length} undelivered messages for user ${userId}`);
    
    // First send the response with the messages
    res.json({ ephemeralMessages: msgs });
    
    // Then mark messages as delivered (after response is sent)
    if (msgs.length > 0) {
      const messageIds = msgs.map(msg => msg._id);
      await EphemeralMessage.updateMany(
        { 
          _id: { $in: messageIds },
          delivered: false
        },
        { 
          $set: { 
            delivered: true,
            deliveredAt: new Date()
          } 
        }
      );
      console.log(`Marked ${messageIds.length} messages as delivered`);
    }
  } catch (err) {
    console.error('Fetch ephemeral error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /messages/history
 * Return recent message history for a conversation (last 24 hours)
 * This is for debugging purposes only and should be removed in production
 */
router.get('/history', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { contactId } = req.query;
    
    if (!contactId) {
      return res.status(400).json({ error: 'contactId is required' });
    }
    
    // Get messages from the last 24 hours
    const oneDayAgo = new Date(Date.now() - (24 * 60 * 60 * 1000));
    
    const msgs = await EphemeralMessage.find({
      $or: [
        { fromUserId: userId, toUserId: contactId },
        { fromUserId: contactId, toUserId: userId }
      ],
      createdAt: { $gt: oneDayAgo }
    }).sort({ time: 1 });
    
    console.log(`Found ${msgs.length} recent messages between ${userId} and ${contactId}`);
    
    return res.json({ 
      messages: msgs,
      note: 'This endpoint is for debugging only and should be removed in production'
    });
  } catch (err) {
    console.error('Fetch message history error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /messages/store
 * Store an ephemeral message
 */
router.post('/store', async (req, res) => {
  try {
    const { 
      messageId, toUserId, nonceHex, blockHash, iv, authTag, ciphertext, time,
      type = 'text', expiresAfterRead = 0, fileMetadata = null
    } = req.body;
    
    const fromUserId = req.user.userId;
    
    if (!toUserId || !ciphertext || !messageId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if message with this ID already exists
    const existingMsg = await EphemeralMessage.findOne({ messageId });
    if (existingMsg) {
      return res.json({ 
        message: 'Message already exists', 
        msgId: existingMsg._id,
        messageId: existingMsg.messageId
      });
    }

    const msg = new EphemeralMessage({
      messageId,
      toUserId,
      fromUserId,
      nonceHex,
      blockHash,
      iv,
      authTag,
      ciphertext,
      time: time || Date.now(),
      type,
      expiresAfterRead,
      fileMetadata
    });
    
    await msg.save();
    console.log(`Stored ephemeral message ${messageId} from ${fromUserId} to ${toUserId}`);
    
    return res.json({ 
      message: 'Ephemeral message stored', 
      msgId: msg._id,
      messageId: msg.messageId
    });
  } catch (err) {
    console.error('Store ephemeral error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /messages/ack
 * Acknowledge receipt of a message
 */
router.post('/ack', async (req, res) => {
  try {
    const { messageId } = req.body;
    const userId = req.user.userId;
    
    if (!messageId) {
      return res.status(400).json({ error: 'messageId is required' });
    }
    
    // Find the message by messageId (not MongoDB _id)
    const message = await EphemeralMessage.findOne({ messageId: messageId });
    
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    // Verify this user is the recipient
    if (message.toUserId !== userId) {
      return res.status(403).json({ error: 'Not authorized to acknowledge this message' });
    }
    
    // Update message as delivered if not already
    if (!message.delivered) {
      message.delivered = true;
      message.deliveredAt = new Date();
      await message.save();
      console.log(`Message ${messageId} acknowledged by user ${userId}`);
    }
    
    return res.json({ 
      message: 'Message acknowledged',
      messageId: message.messageId
    });
  } catch (err) {
    console.error('Acknowledge message error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /messages/read
 * Mark messages as read
 */
router.post('/read', async (req, res) => {
  try {
    const { messageIds } = req.body;
    const userId = req.user.userId;
    
    if (!messageIds || !Array.isArray(messageIds)) {
      return res.status(400).json({ error: 'messageIds array is required' });
    }
    
    // Only mark messages addressed to this user
    const result = await EphemeralMessage.updateMany(
      { 
        _id: { $in: messageIds },
        toUserId: userId,
        read: false
      },
      { 
        $set: { 
          read: true,
          readAt: new Date()
        } 
      }
    );
    
    return res.json({ 
      message: 'Messages marked as read',
      count: result.modifiedCount
    });
  } catch (err) {
    console.error('Mark read error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * DELETE /messages/:id
 * Delete a specific message (only if you're the sender or recipient)
 */
router.delete('/:id', async (req, res) => {
  try {
    const messageId = req.params.id;
    const userId = req.user.userId;
    
    const message = await EphemeralMessage.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    // Check if user is sender or recipient
    if (message.fromUserId !== userId && message.toUserId !== userId) {
      return res.status(403).json({ error: 'Not authorized to delete this message' });
    }
    
    await message.deleteOne();
    return res.json({ message: 'Message deleted successfully' });
  } catch (err) {
    console.error('Delete message error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * DELETE /messages
 * Delete all messages for a conversation
 */
router.delete('/', async (req, res) => {
  try {
    const { contactId } = req.query;
    const userId = req.user.userId;
    
    if (!contactId) {
      return res.status(400).json({ error: 'contactId is required' });
    }
    
    // Delete all messages between these two users
    const result = await EphemeralMessage.deleteMany({
      $or: [
        { fromUserId: userId, toUserId: contactId },
        { fromUserId: contactId, toUserId: userId }
      ]
    });
    
    return res.json({ 
      message: 'Conversation deleted',
      count: result.deletedCount
    });
  } catch (err) {
    console.error('Delete conversation error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /messages/cleanup
 * Manually trigger cleanup of delivered messages
 * Admin only endpoint
 */
router.post('/cleanup', async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Optional: Check if user has admin rights
    // if (!isAdmin(userId)) {
    //   return res.status(403).json({ error: 'Admin access required' });
    // }
    
    // Delete messages that have been delivered
    const result = await EphemeralMessage.deleteMany({
      delivered: true
    });
    
    return res.json({ 
      message: 'Cleanup completed',
      deletedCount: result.deletedCount
    });
  } catch (err) {
    console.error('Cleanup error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
