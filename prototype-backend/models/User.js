// models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  phoneNumber: {
    type: String,
    required: true,
    unique: true,
  },
  // Anonymous identifier for public use (Telegram-style number)
  anonId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    match: [/^888\d{7}$/, 'Anonymous ID must be in format 888 followed by 7 digits']
  },
  username: {
    type: String,
    unique: true,
    sparse: true,
    match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, underscores'],
  },
  bio: {
    type: String,
    default: '',
  },
  pfp: {
    type: String, // Store a URL or base64 in this POC
    default: '',
  },
  // Store contacts as array of user references
  contacts: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  ],
  // Blocked users
  blockedUsers: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  ],
  // Privacy settings
  privacySettings: {
    phoneNumberVisibility: {
      type: String,
      enum: ['everyone', 'contacts', 'nobody'],
      default: 'nobody' // Changed default to 'nobody' for better privacy
    },
    // Store users who have been granted special permission to see phone number
    phoneNumberSharedWith: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ]
  },
  // User settings
  settings: {
    notifications: {
      enabled: {
        type: Boolean,
        default: true
      },
      sound: {
        type: Boolean,
        default: true
      },
      vibration: {
        type: Boolean,
        default: true
      },
      messagePreview: {
        type: Boolean,
        default: true
      }
    },
    theme: {
      type: String,
      enum: ['light', 'dark', 'system'],
      default: 'system'
    },
    language: {
      type: String,
      default: 'en'
    },
    fontSize: {
      type: String,
      enum: ['small', 'medium', 'large'],
      default: 'medium'
    },
    readReceipts: {
      type: Boolean,
      default: true
    },
    typingIndicators: {
      type: Boolean,
      default: true
    }
  },
  // Last active timestamp
  lastActive: {
    type: Date,
    default: Date.now,
  },
  // Account creation timestamp
  createdAt: {
    type: Date,
    default: Date.now,
  },
  // Account status
  isActive: {
    type: Boolean,
    default: true,
  },
});

// Add index for faster lookups
userSchema.index({ phoneNumber: 1 });
userSchema.index({ username: 1 });
userSchema.index({ anonId: 1 });

module.exports = mongoose.model('User', userSchema);
