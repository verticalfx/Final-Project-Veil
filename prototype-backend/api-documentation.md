# API Documentation

Generated: 04/03/2025, 12:17:25

## Table of Contents

- [RESTful Endpoints](#restful-endpoints)
- [Socket.IO Events](#socketio-events)

## RESTful Endpoints

### AUTH Routes

#### POST /auth/start

##### Parameters

**Body Parameters:**

- `phoneNumber`

##### Success Responses

**Status Code:** 200

**Response Body:**
```json
{ message: 'User found. OTP sent.', needsRegistration: false, smsStatus: smsResult.success ? 'sent' : 'failed', // Only include OTP in demo mode ...(config.sms.demoMode && { otp }
```

**Status Code:** 200

**Response Body:**
```json
{ message: 'Phone not registered, register flow', needsRegistration: true, smsStatus: smsResult.success ? 'sent' : 'failed', // Only include OTP in demo mode ...(config.sms.demoMode && { otp }
```

##### Error Responses

**Status Code:** 400

**Response Body:**
```json
{ error: 'Phone number is required' }
```

**Status Code:** 500

**Response Body:**
```json
{ error: 'Server error: ' + err.message }
```

---

#### POST /auth/register

##### Parameters

**Body Parameters:**

- `phoneNumber`
- `username`
- `bio`
- `pfp`
- `otp`

##### Success Responses

**Status Code:** 200

**Response Body:**
```json
{ message: 'User registered successfully, please verify OTP', user: { _id: user._id, phoneNumber: user.phoneNumber, username: user.username, bio: user.bio, pfp: user.pfp, } }
```

**Status Code:** 200

**Response Body:**
```json
{ message: 'Login successful', user: { _id: user._id, phoneNumber: user.phoneNumber, username: user.username, bio: user.bio, pfp: user.pfp, }, token, }
```

##### Error Responses

**Status Code:** 400

**Response Body:**
```json
{ error: 'Phone number is required' }
```

**Status Code:** 400

**Response Body:**
```json
{ error: 'Username is required' }
```

**Status Code:** 400

**Response Body:**
```json
{ error: 'Phone number already registered' }
```

**Status Code:** 400

**Response Body:**
```json
{ error: 'Username already taken' }
```

**Status Code:** 500

**Response Body:**
```json
{ error: 'Server error: ' + err.message }
```

**Status Code:** 400

**Response Body:**
```json
{ error: 'Phone number and OTP are required' }
```

**Status Code:** 401

**Response Body:**
```json
{ error: 'Invalid or expired OTP' }
```

**Status Code:** 404

**Response Body:**
```json
{ error: 'User not found' }
```

---

#### POST /auth/verify

##### Parameters

**Body Parameters:**

- `phoneNumber`
- `otp`

##### Success Responses

**Status Code:** 200

**Response Body:**
```json
{ message: 'Login successful', user: { _id: user._id, phoneNumber: user.phoneNumber, username: user.username, bio: user.bio, pfp: user.pfp, }, token, }
```

##### Error Responses

**Status Code:** 400

**Response Body:**
```json
{ error: 'Phone number and OTP are required' }
```

**Status Code:** 401

**Response Body:**
```json
{ error: 'Invalid or expired OTP' }
```

**Status Code:** 404

**Response Body:**
```json
{ error: 'User not found' }
```

**Status Code:** 500

**Response Body:**
```json
{ error: 'Server error: ' + err.message }
```

---

### CONTACTS Routes

#### GET /contacts

##### Success Responses

**Status Code:** 200

**Response Body:**
```json
{ contacts: user.contacts.map(c => ({ _id: c._id, username: c.username, phoneNumber: c.phoneNumber, bio: c.bio, pfp: c.pfp, }
```

##### Error Responses

**Status Code:** 404

**Response Body:**
```json
{ error: 'User not found' }
```

**Status Code:** 500

**Response Body:**
```json
{ error: 'Server error' }
```

---

#### POST /contacts

##### Parameters

**Body Parameters:**

- `userId`
- `contactId`
- `sharePhoneNumber`

##### Success Responses

**Status Code:** 200

**Response Body:**
```json
{ contact: { _id: contactUser._id, username: contactUser.username, phoneNumber: contactUser.phoneNumber, bio: contactUser.bio, profilePicture: contactUser.profilePicture, } }
```

##### Error Responses

**Status Code:** 400

**Response Body:**
```json
{ error: 'Invalid user ID format' }
```

**Status Code:** 404

**Response Body:**
```json
{ error: 'User not found' }
```

**Status Code:** 400

**Response Body:**
```json
{ error: 'Already in contacts' }
```

---

#### DELETE /contacts/:contactId

##### Success Responses

**Status Code:** 200

**Response Body:**
```json
{ message: 'Contact removed successfully' }
```

**Status Code:** 200

**Response Body:**
```json
{ users: filteredUsers }
```

##### Error Responses

**Status Code:** 400

**Response Body:**
```json
{ error: 'Invalid contact ID' }
```

**Status Code:** 404

**Response Body:**
```json
{ error: 'User not found' }
```

**Status Code:** 404

**Response Body:**
```json
{ error: 'Contact not found in your contacts' }
```

**Status Code:** 500

**Response Body:**
```json
{ error: 'Server error' }
```

**Status Code:** 400

**Response Body:**
```json
{ error: 'Search term is required' }
```

**Status Code:** 400

**Response Body:**
```json
{ error: 'Invalid user ID' }
```

---

#### GET /contacts/search

##### Parameters

**Body Parameters:**

- `userId`
- `searchTerm`

##### Success Responses

**Status Code:** 200

**Response Body:**
```json
{ users: filteredUsers }
```

##### Error Responses

**Status Code:** 400

**Response Body:**
```json
{ error: 'Search term is required' }
```

**Status Code:** 400

**Response Body:**
```json
{ error: 'Invalid user ID' }
```

**Status Code:** 404

**Response Body:**
```json
{ error: 'User not found' }
```

**Status Code:** 500

**Response Body:**
```json
{ error: 'Server error' }
```

---

#### POST /contacts/search

##### Parameters

**Body Parameters:**

- `userId`
- `searchTerm`

##### Success Responses

**Status Code:** 200

**Response Body:**
```json
{ users: filteredUsers }
```

##### Error Responses

**Status Code:** 400

**Response Body:**
```json
{ error: 'Search term is required' }
```

**Status Code:** 400

**Response Body:**
```json
{ error: 'Invalid user ID' }
```

**Status Code:** 404

**Response Body:**
```json
{ error: 'User not found' }
```

**Status Code:** 500

**Response Body:**
```json
{ error: 'Server error' }
```

---

### MESSAGES Routes

#### GET /messages

##### Parameters

**Path Parameters:**

- `id`

**Body Parameters:**

- `messageId`
- `toUserId`
- `nonceHex`
- `blockHash`
- `iv`
- `authTag`
- `ciphertext`
- `time`
- `type = 'text'`
- `expiresAfterRead = 0`
- `fileMetadata = null`
- `messageIds`

##### Success Responses

**Status Code:** 200

**Response Body:**
```json
{ ephemeralMessages: msgs }
```

**Status Code:** 200

**Response Body:**
```json
{ messages: msgs, note: 'This endpoint is for debugging only and should be removed in production' }
```

**Status Code:** 200

**Response Body:**
```json
{ message: 'Message already exists', msgId: existingMsg._id, messageId: existingMsg.messageId }
```

**Status Code:** 200

**Response Body:**
```json
{ message: 'Ephemeral message stored', msgId: msg._id, messageId: msg.messageId }
```

**Status Code:** 200

**Response Body:**
```json
{ message: 'Message acknowledged', messageId: message.messageId }
```

**Status Code:** 200

**Response Body:**
```json
{ message: 'Messages marked as read', count: result.modifiedCount }
```

**Status Code:** 200

**Response Body:**
```json
{ message: 'Message deleted successfully' }
```

**Status Code:** 200

**Response Body:**
```json
{ message: 'Conversation deleted', count: result.deletedCount }
```

**Status Code:** 200

**Response Body:**
```json
{ message: 'Cleanup completed', deletedCount: result.deletedCount }
```

##### Error Responses

**Status Code:** 500

**Response Body:**
```json
{ error: 'Server error' }
```

**Status Code:** 400

**Response Body:**
```json
{ error: 'contactId is required' }
```

**Status Code:** 400

**Response Body:**
```json
{ error: 'Missing required fields' }
```

**Status Code:** 400

**Response Body:**
```json
{ error: 'messageId is required' }
```

**Status Code:** 404

**Response Body:**
```json
{ error: 'Message not found' }
```

**Status Code:** 403

**Response Body:**
```json
{ error: 'Not authorized to acknowledge this message' }
```

**Status Code:** 400

**Response Body:**
```json
{ error: 'messageIds array is required' }
```

**Status Code:** 403

**Response Body:**
```json
{ error: 'Not authorized to delete this message' }
```

**Status Code:** 403

**Response Body:**
```json
{ error: 'Admin access required' }
```

---

#### GET /messages/history

##### Success Responses

**Status Code:** 200

**Response Body:**
```json
{ messages: msgs, note: 'This endpoint is for debugging only and should be removed in production' }
```

##### Error Responses

**Status Code:** 400

**Response Body:**
```json
{ error: 'contactId is required' }
```

**Status Code:** 500

**Response Body:**
```json
{ error: 'Server error' }
```

---

#### POST /messages/store

##### Parameters

**Body Parameters:**

- `messageId`
- `toUserId`
- `nonceHex`
- `blockHash`
- `iv`
- `authTag`
- `ciphertext`
- `time`
- `type = 'text'`
- `expiresAfterRead = 0`
- `fileMetadata = null`

##### Success Responses

**Status Code:** 200

**Response Body:**
```json
{ message: 'Message already exists', msgId: existingMsg._id, messageId: existingMsg.messageId }
```

**Status Code:** 200

**Response Body:**
```json
{ message: 'Ephemeral message stored', msgId: msg._id, messageId: msg.messageId }
```

##### Error Responses

**Status Code:** 400

**Response Body:**
```json
{ error: 'Missing required fields' }
```

**Status Code:** 500

**Response Body:**
```json
{ error: 'Server error' }
```

---

#### POST /messages/ack

##### Parameters

**Body Parameters:**

- `messageId`

##### Success Responses

**Status Code:** 200

**Response Body:**
```json
{ message: 'Message acknowledged', messageId: message.messageId }
```

##### Error Responses

**Status Code:** 400

**Response Body:**
```json
{ error: 'messageId is required' }
```

**Status Code:** 404

**Response Body:**
```json
{ error: 'Message not found' }
```

**Status Code:** 403

**Response Body:**
```json
{ error: 'Not authorized to acknowledge this message' }
```

**Status Code:** 500

**Response Body:**
```json
{ error: 'Server error' }
```

---

#### POST /messages/read

##### Parameters

**Body Parameters:**

- `messageIds`

##### Success Responses

**Status Code:** 200

**Response Body:**
```json
{ message: 'Messages marked as read', count: result.modifiedCount }
```

##### Error Responses

**Status Code:** 400

**Response Body:**
```json
{ error: 'messageIds array is required' }
```

**Status Code:** 500

**Response Body:**
```json
{ error: 'Server error' }
```

---

#### DELETE /messages/:id

##### Parameters

**Path Parameters:**

- `id`

##### Success Responses

**Status Code:** 200

**Response Body:**
```json
{ message: 'Message deleted successfully' }
```

##### Error Responses

**Status Code:** 404

**Response Body:**
```json
{ error: 'Message not found' }
```

**Status Code:** 403

**Response Body:**
```json
{ error: 'Not authorized to delete this message' }
```

**Status Code:** 500

**Response Body:**
```json
{ error: 'Server error' }
```

---

#### DELETE /messages

##### Success Responses

**Status Code:** 200

**Response Body:**
```json
{ message: 'Conversation deleted', count: result.deletedCount }
```

##### Error Responses

**Status Code:** 400

**Response Body:**
```json
{ error: 'contactId is required' }
```

**Status Code:** 500

**Response Body:**
```json
{ error: 'Server error' }
```

---

#### POST /messages/cleanup

##### Success Responses

**Status Code:** 200

**Response Body:**
```json
{ message: 'Cleanup completed', deletedCount: result.deletedCount }
```

##### Error Responses

**Status Code:** 403

**Response Body:**
```json
{ error: 'Admin access required' }
```

**Status Code:** 500

**Response Body:**
```json
{ error: 'Server error' }
```

---

### USERS Routes

#### GET /users/:id

##### Parameters

**Path Parameters:**

- `id`

##### Success Responses

**Status Code:** 200

**Response Body:**
```json
{ _id: user._id, username: user.username, phoneNumber: user.phoneNumber, bio: user.bio, pfp: user.pfp }
```

##### Error Responses

**Status Code:** 400

**Response Body:**
```json
{ error: 'Invalid user ID format' }
```

**Status Code:** 404

**Response Body:**
```json
{ error: 'User not found' }
```

**Status Code:** 500

**Response Body:**
```json
{ error: 'Server error' }
```

---

#### GET /users/me

##### Success Responses

**Status Code:** 200

**Response Body:**
```json
{ _id: user._id, username: user.username, phoneNumber: user.phoneNumber, bio: user.bio, pfp: user.pfp, createdAt: user.createdAt, lastActive: user.lastActive }
```

##### Error Responses

**Status Code:** 404

**Response Body:**
```json
{ error: 'User not found' }
```

**Status Code:** 500

**Response Body:**
```json
{ error: 'Server error' }
```

---

#### PUT /users/me

##### Parameters

**Path Parameters:**

- `id`

**Body Parameters:**

- `username`
- `bio`
- `pfp`
- `password`
- `phoneNumberVisibility`

##### Success Responses

**Status Code:** 200

**Response Body:**
```json
{ message: 'Profile updated successfully', user: { _id: user._id, username: user.username, phoneNumber: user.phoneNumber, bio: user.bio, pfp: user.pfp } }
```

**Status Code:** 200

**Response Body:**
```json
{ message: 'Password updated successfully' }
```

**Status Code:** 200

**Response Body:**
```json
{ message: 'Account deactivated successfully' }
```

**Status Code:** 200

**Response Body:**
```json
{ message: 'Privacy settings updated successfully', user: { _id: user._id, username: user.username, phoneNumber: user.phoneNumber, bio: user.bio, pfp: user.pfp, privacySettings: user.privacySettings } }
```

##### Error Responses

**Status Code:** 404

**Response Body:**
```json
{ error: 'User not found' }
```

**Status Code:** 400

**Response Body:**
```json
{ error: 'Username already taken' }
```

**Status Code:** 500

**Response Body:**
```json
{ error: 'Server error' }
```

**Status Code:** 400

**Response Body:**
```json
{ error: 'Password must be at least 8 characters' }
```

**Status Code:** 400

**Response Body:**
```json
{ error: 'Invalid user ID format' }
```

**Status Code:** 400

**Response Body:**
```json
{ error: 'Invalid phone number visibility setting' }
```

---

#### PUT /users/me/password

##### Parameters

**Path Parameters:**

- `id`

**Body Parameters:**

- `password`
- `phoneNumberVisibility`

##### Success Responses

**Status Code:** 200

**Response Body:**
```json
{ message: 'Password updated successfully' }
```

**Status Code:** 200

**Response Body:**
```json
{ message: 'Account deactivated successfully' }
```

**Status Code:** 200

**Response Body:**
```json
{ message: 'Privacy settings updated successfully', user: { _id: user._id, username: user.username, phoneNumber: user.phoneNumber, bio: user.bio, pfp: user.pfp, privacySettings: user.privacySettings } }
```

##### Error Responses

**Status Code:** 400

**Response Body:**
```json
{ error: 'Password must be at least 8 characters' }
```

**Status Code:** 404

**Response Body:**
```json
{ error: 'User not found' }
```

**Status Code:** 500

**Response Body:**
```json
{ error: 'Server error' }
```

**Status Code:** 400

**Response Body:**
```json
{ error: 'Invalid user ID format' }
```

**Status Code:** 400

**Response Body:**
```json
{ error: 'Invalid phone number visibility setting' }
```

---

#### DELETE /users/me

##### Success Responses

**Status Code:** 200

**Response Body:**
```json
{ message: 'Account deactivated successfully' }
```

##### Error Responses

**Status Code:** 404

**Response Body:**
```json
{ error: 'User not found' }
```

**Status Code:** 500

**Response Body:**
```json
{ error: 'Server error' }
```

---

#### PUT /users/:id/privacy

##### Parameters

**Path Parameters:**

- `id`

**Body Parameters:**

- `phoneNumberVisibility`

##### Success Responses

**Status Code:** 200

**Response Body:**
```json
{ message: 'Privacy settings updated successfully', user: { _id: user._id, username: user.username, phoneNumber: user.phoneNumber, bio: user.bio, pfp: user.pfp, privacySettings: user.privacySettings } }
```

##### Error Responses

**Status Code:** 400

**Response Body:**
```json
{ error: 'Invalid user ID format' }
```

**Status Code:** 400

**Response Body:**
```json
{ error: 'Invalid phone number visibility setting' }
```

**Status Code:** 404

**Response Body:**
```json
{ error: 'User not found' }
```

**Status Code:** 500

**Response Body:**
```json
{ error: 'Server error' }
```

---

## Socket.IO Events

### Incoming Events (Client to Server)

#### `registerUser`

---

#### `userStatus`

##### Parameters

- `data`

---

#### `ephemeral_message`

##### Parameters

- `encryptedData`

##### May Emit

- `message_delivered` (to sender)
- `message_stored` (to sender)

---

#### `message_read`

##### Parameters

- `data`

##### May Emit

- `user_status` (to sender)
- `ephemeral_message` (to sender)

---

#### `disconnect`

---

