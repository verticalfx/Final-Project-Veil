// models/EphemeralMessage.js
const mongoose = require('mongoose');

const ephemeralMessageSchema = new mongoose.Schema({
  messageId: { 
    type: String, 
    required: true,
    index: true  // Add index for faster queries
  },
  toUserId: { 
    type: String, 
    required: true,
    index: true  // Add index for faster queries
  },
  fromUserId: { 
    type: String, 
    required: true,
    index: true  // Add index for faster queries
  },
  nonceHex: String,
  blockHash: String,
  iv: String,
  authTag: String,
  ciphertext: String,
  time: { 
    type: String,
    default: () => new Date().toISOString()
  },
  
  // Message status flags
  delivered: { 
    type: Boolean, 
    default: false,
    index: true  // Add index for faster queries
  },
  read: { 
    type: Boolean, 
    default: false,
    index: true  // Add index for faster queries
  },
  
  // Timestamps for status changes
  deliveredAt: { 
    type: Date, 
    default: null 
  },
  readAt: { 
    type: Date, 
    default: null 
  },
  
  // Auto-delete after read (in seconds, 0 = never)
  expiresAfterRead: {
    type: Number,
    default: 0
  },
  
  // Message type (for future use)
  type: {
    type: String,
    enum: ['text', 'image', 'file', 'audio', 'video'],
    default: 'text'
  },
  
  // For file messages
  fileMetadata: {
    name: String,
    size: Number,
    mimeType: String
  },
  
  // Creation timestamp
  createdAt: {
    type: Date,
    default: Date.now,
    index: true  // Add index for faster queries
  }
});

// Add TTL index to automatically delete messages after they're read
// Only applies if expiresAfterRead > 0 and readAt is set
ephemeralMessageSchema.index(
  { readAt: 1 },
  { 
    expireAfterSeconds: 0,  // The actual TTL is calculated dynamically
    partialFilterExpression: { 
      readAt: { $ne: null },
      expiresAfterRead: { $gt: 0 }
    }
  }
);

module.exports = mongoose.model('EphemeralMessage', ephemeralMessageSchema);