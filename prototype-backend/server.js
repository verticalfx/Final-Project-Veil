/*************************************************
 * server.js
 *   - Express + Socket.IO server
 *   - Stores ephemeral ciphertext in the DB if
 *     the recipient is offline
 *   - On receiving "sendEphemeralMessage",
 *     relays or stores ephemeral messages
 *************************************************/
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const morgan = require('morgan');

// Import configuration
const config = require('./config');

// Import middleware
const { authenticateJWT } = require('./middleware/auth');

const authRoutes = require('./routes/auth');
const contactRoutes = require('./routes/contacts');
const messagesRoutes = require('./routes/messages');
const usersRoutes = require('./routes/users');

// Create Express + HTTP + Socket.IO
const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: config.cors.origin,
    methods: config.cors.methods,
    allowedHeaders: config.cors.allowedHeaders
  }
});


// Security middleware
app.use(helmet());
app.use(cors(config.cors));
app.use(bodyParser.json());
app.use(morgan(config.logging.format));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/auth', apiLimiter);

// Connect to MongoDB
mongoose.connect(config.db.uri, config.db.options)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err));

// RESTful routes
app.use('/auth', authRoutes);
app.use('/contacts', authenticateJWT, contactRoutes);
app.use('/messages', authenticateJWT, messagesRoutes);
app.use('/users', authenticateJWT, usersRoutes);

app.get('/', (req, res) => {
  res.send('Socket.IO ephemeral E2EE server is up.');
});

/**
 * Mapping userId → socket for direct message relay.
 * Real production code must handle multiple sockets per user, reconnections, etc.
 */
const userSockets = {};
const userStatusMap = {}; // userId -> boolean (true = online, false = offline)

// Socket.IO authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error: Token required'));
  }

  try {
    const { verifyJWT } = require('./cryptoUtils');
    const decoded = verifyJWT(token, config.auth.jwtSecret);
    if (!decoded) {
      return next(new Error('Authentication error: Invalid token'));
    }
    
    socket.user = decoded;
    next();
  } catch (error) {
    return next(new Error('Authentication error: ' + error.message));
  }
});

/** 
 * On new socket connection
 */
io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);
  const userId = socket.user.userId;
  const anonId = socket.user.anonId;
  console.log('User connected with ID:', userId);
  
  // Debug: Log current userSockets state
  console.log('Current userSockets:', Object.keys(userSockets));

  // Helper to register socket under both IDs
  function registerUserSocket() {
    console.log(`Registering user ${userId} (${anonId}) with socket ${socket.id}`);
    userSockets[userId] = socket;
    if (anonId) userSockets[anonId] = socket;
    userStatusMap[userId] = true;
    if (anonId) userStatusMap[anonId] = true;
    console.log('Updated userSockets:', Object.keys(userSockets));
    broadcastStatus(userId, true);
  }

  // Register on explicit event
  socket.on('registerUser', registerUserSocket);

  // Automatically register the user on connection
  registerUserSocket();
  
  // Deliver any pending messages
  deliverPendingMessages(userId, socket);

  // Send list of currently online users to the newly connected socket
  for (const [onlineUserId, isOnline] of Object.entries(userStatusMap)) {
    if (onlineUserId !== userId && isOnline) {
      socket.emit('user_status', {
        userId: onlineUserId,
        status: 'online',
        lastSeen: new Date()
      });
    }
  }

  // The user front-end calls: socket.emit('userStatus', { online: ... })
  socket.on('userStatus', (data) => {
    const { online } = data;
    userStatusMap[userId] = online;
    broadcastStatus(userId, online);
  });

  /**
   * Handle ephemeral messages
   * encryptedData:
   *   {
   *     messageId, toUserId, nonceHex, blockHash,
   *     iv, authTag, ciphertext, time
   *   }
   */
  socket.on('ephemeral_message', async (encryptedData) => {
    console.log('Ephemeral message from', userId, 'to', encryptedData.toUserId);
    console.log('Message data:', {
      messageId: encryptedData.messageId,
      fromUserId: userId,
      toUserId: encryptedData.toUserId,
      hasBlockHash: !!encryptedData.blockHash,
      hasNonceHex: !!encryptedData.nonceHex,
      hasIv: !!encryptedData.iv,
      hasAuthTag: !!encryptedData.authTag,
      hasCiphertext: !!encryptedData.ciphertext
    });
    
    // Add the sender ID from the authenticated socket
    encryptedData.fromUserId = userId;

    // Debug: Log current userSockets state
    console.log('Current userSockets when sending message:', Object.keys(userSockets));
    console.log('Checking if recipient is online:', encryptedData.toUserId);
    console.log('Recipient socket exists:', !!userSockets[encryptedData.toUserId]);
    
    if (userSockets[encryptedData.toUserId]) {
      console.log('Recipient socket connected:', userSockets[encryptedData.toUserId].connected);
    }

    // Normalize recipient ID (allow anonId)
    let recipientId = encryptedData.toUserId;
    if (typeof recipientId === 'string' && /^888\d{7}$/.test(recipientId)) {
      try {
        const recUser = await User.findOne({ anonId: recipientId }).select('_id');
        if (recUser) recipientId = recUser._id.toString();
      } catch (e) {
        console.error('Error resolving anonId to userId:', e);
      }
    }
    encryptedData.toUserId = recipientId;

    const recipientSocket = userSockets[recipientId];

    try {
      // Check if the recipient has blocked the sender
      const User = require('./models/User');
      const recipient = await User.findById(encryptedData.toUserId);
      
      if (recipient && recipient.blockedUsers && recipient.blockedUsers.includes(userId)) {
        console.log(`Message not delivered: Recipient ${encryptedData.toUserId} has blocked sender ${userId}`);
        
        // Send a "blocked" notification back to sender
        socket.emit('message_blocked', {
          messageId: encryptedData.messageId,
          toUserId: encryptedData.toUserId,
          timestamp: new Date()
        });
        
        return; // Stop processing this message
      }
      
      // Check if the sender has blocked the recipient
      const sender = await User.findById(userId);
      if (sender && sender.blockedUsers && sender.blockedUsers.includes(encryptedData.toUserId)) {
        console.log(`Message not delivered: Sender ${userId} has blocked recipient ${encryptedData.toUserId}`);
        
        // Send an error back to sender
        socket.emit('message_error', {
          messageId: encryptedData.messageId,
          toUserId: encryptedData.toUserId,
          error: 'Cannot send message to blocked user',
          timestamp: new Date()
        });
        
        return; // Stop processing this message
      }
      
      // Check if recipient is online
      if (recipientSocket && recipientSocket.connected) {
        // Relay immediately
        console.log('Recipient is online, relaying message immediately');
        recipientSocket.emit('ephemeral_message', encryptedData);
        
        // Send delivery confirmation back to sender
        socket.emit('message_delivered', {
          messageId: encryptedData.messageId,
          toUserId: encryptedData.toUserId,
          timestamp: new Date()
        });

        console.log('Message delivered to recipient');
      } else {
        // Not online => store in DB so they can fetch offline
        console.log('Recipient is offline, storing message in database');
        const EphemeralMessage = require('./models/EphemeralMessage');
        const msg = new EphemeralMessage({
          messageId: encryptedData.messageId,
          toUserId: encryptedData.toUserId,
          fromUserId: userId,
          nonceHex: encryptedData.nonceHex,
          blockHash: encryptedData.blockHash,
          iv: encryptedData.iv,
          authTag: encryptedData.authTag,
          ciphertext: encryptedData.ciphertext,
          time: encryptedData.time || new Date().toISOString()
        });
        
        msg.save().then(() => {
          console.log('Ephemeral message stored for offline user:', encryptedData.toUserId);
          
          // Send storage confirmation back to sender
          socket.emit('message_stored', {
            messageId: encryptedData.messageId,
            toUserId: encryptedData.toUserId,
            timestamp: new Date()
          });
        }).catch(err => console.error('Store ephemeral error:', err));
      }
    } catch (err) {
      console.error('Error processing ephemeral message:', err);
      
      // Send error back to sender
      socket.emit('message_error', {
        messageId: encryptedData.messageId,
        toUserId: encryptedData.toUserId,
        error: 'Server error processing message',
        timestamp: new Date()
      });
    }
  });

  // Handle read receipts
  socket.on('message_read', (data) => {
    console.log('Read receipt from', userId, 'for message', data.messageId);
    
    // Relay to original sender (data.toUserId)
    const senderSocket = userSockets[data.toUserId];
    if (senderSocket && senderSocket.connected) {
      // Relay the read receipt
      senderSocket.emit('message_read', {
        messageId: data.messageId,
        toUserId: senderSocket.user ? senderSocket.user.userId : data.toUserId,
        fromUserId: userId,
        timestamp: new Date()
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);
    // Remove the socket from userSockets
    if (userSockets[userId] === socket) {
      console.log(`Removing user ${userId} from userSockets`);
      delete userSockets[userId];
      if (anonId) delete userSockets[anonId];
      userStatusMap[userId] = false; // Mark them offline
      if (anonId) userStatusMap[anonId] = false;
      broadcastStatus(userId, false);
    } else {
      console.log(`Socket ${socket.id} disconnected but was not the active socket for user ${userId}`);
    }
  });
});

/**
 * Broadcast user status to all their contacts
 */
async function broadcastStatus(userId, isOnline) {
  console.log(`Broadcasting status for ${userId}: ${isOnline ? 'online' : 'offline'}`);
  
  try {
    const User = require('./models/User');
    
    // Get the user to check their blocked list
    const user = await User.findById(userId);
    if (!user) {
      console.error(`User ${userId} not found when broadcasting status`);
      return;
    }
    
    // Find all sockets that should receive this update
    for (const [socketUserId, socket] of Object.entries(userSockets)) {
      if (socketUserId !== userId && socket && socket.connected) {
        try {
          // Check if this user is blocked by the status-changing user
          if (user.blockedUsers && user.blockedUsers.some(id => id.toString() === socketUserId)) {
            console.log(`Not sending status update to blocked user ${socketUserId}`);
            continue;
          }
          
          // Check if the status-changing user is blocked by this user
          const otherUser = await User.findById(socketUserId);
          if (otherUser && otherUser.blockedUsers && 
              otherUser.blockedUsers.some(id => id.toString() === userId)) {
            console.log(`Not sending status update to user ${socketUserId} who blocked ${userId}`);
            continue;
          }
          
          console.log(`Sending status update to user ${socketUserId}`);
          socket.emit('user_status', {
            userId: userId,
            status: isOnline ? 'online' : 'offline',
            lastSeen: new Date()
          });
        } catch (err) {
          console.error(`Error checking block status for user ${socketUserId}:`, err);
        }
      }
    }
  } catch (err) {
    console.error('Error in broadcastStatus:', err);
  }
}

/**
 * Cleanup routine for delivered messages
 * Runs periodically to remove messages that have been delivered
 */
async function cleanupDeliveredMessages() {
  try {
    const EphemeralMessage = require('./models/EphemeralMessage');
    
    // Find messages that have been delivered for more than 1 hour
    const oneHourAgo = new Date(Date.now() - (60 * 60 * 1000));
    
    const result = await EphemeralMessage.deleteMany({
      delivered: true,
      deliveredAt: { $lt: oneHourAgo }
    });
    
    if (result.deletedCount > 0) {
      console.log(`Cleaned up ${result.deletedCount} delivered messages`);
    }
  } catch (err) {
    console.error('Error cleaning up delivered messages:', err);
  }
}

// Run cleanup every hour
setInterval(cleanupDeliveredMessages, 60 * 60 * 1000);

// Also run once at startup
cleanupDeliveredMessages();

/**
 * Deliver any pending messages to a user who just came online
 */
async function deliverPendingMessages(userId, socket) {
  try {
    const EphemeralMessage = require('./models/EphemeralMessage');
    const User = require('./models/User');
    
    // Get the user to check their blocked list
    const user = await User.findById(userId);
    if (!user) {
      console.error(`User ${userId} not found when delivering pending messages`);
      return;
    }
    
    // Find all undelivered messages for this user, excluding those from blocked users
    const query = {
      toUserId: userId,
      delivered: false
    };
    
    // Add filter to exclude messages from blocked users
    if (user.blockedUsers && user.blockedUsers.length > 0) {
      query.fromUserId = { $nin: user.blockedUsers };
    }
    
    const pendingMessages = await EphemeralMessage.find(query).sort({ time: 1 });
    
    if (pendingMessages.length > 0) {
      console.log(`Delivering ${pendingMessages.length} pending messages to user ${userId}`);
      
      // Send each message to the user
      for (const msg of pendingMessages) {
        socket.emit('ephemeral_message', {
          messageId: msg.messageId,
          fromUserId: msg.fromUserId,
          toUserId: msg.toUserId,
          nonceHex: msg.nonceHex,
          blockHash: msg.blockHash,
          iv: msg.iv,
          authTag: msg.authTag,
          ciphertext: msg.ciphertext,
          time: msg.time
        });
        
        // Mark as delivered
        msg.delivered = true;
        msg.deliveredAt = new Date();
        await msg.save();
      }
      
      console.log(`Marked ${pendingMessages.length} messages as delivered for user ${userId}`);
    }
  } catch (err) {
    console.error('Error delivering pending messages:', err);
  }
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: config.isDev ? err.message : 'Internal Server Error'
  });
});

// Start the server
server.listen(config.port, config.host, () => {
  console.log(`Server listening on ${config.host}:${config.port} in ${config.NODE_ENV} mode`);
});







