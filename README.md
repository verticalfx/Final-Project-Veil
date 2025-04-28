# Veil - Ephemeral E2EE Messaging Application

Veil is a secure messaging application that uses end-to-end encryption (E2EE) with ephemeral keys derived from blockchain randomness. Messages are designed to be temporary and can self-destruct after being read.

## Features

- **End-to-End Encryption**: All messages are encrypted using AES-256-GCM
- **Ephemeral Keys**: Encryption keys are derived from blockchain block hashes and random nonces
- **Self-Destructing Messages**: Messages can be set to auto-delete after being read
- **Offline Message Storage**: Messages are stored encrypted on the server if the recipient is offline
- **Real-Time Communication**: Uses Socket.IO for instant message delivery
- **Contact Management**: Add and manage contacts securely
- **User Authentication**: Secure authentication with JWT and OTP verification
- **SMS Verification**: OTP codes can be sent via SMS in production mode
- **Cross-Platform**: Built with Electron for desktop support on Windows, macOS, and Linux

## Architecture

The application consists of two main components:

1. **Frontend (Electron App)**
   - User interface built with HTML, CSS, and JavaScript
   - Electron for cross-platform desktop support
   - Socket.IO client for real-time communication
   - Secure cryptographic operations

2. **Backend (Node.js Server)**
   - Express.js REST API
   - Socket.IO for real-time messaging
   - MongoDB for data storage
   - JWT authentication
   - Rate limiting and security headers

## Security Features

- AES-256-GCM encryption for message content
- HKDF key derivation from blockchain entropy
- JWT-based authentication
- OTP verification for login with SMS delivery
- Rate limiting to prevent brute force attacks
- Content Security Policy (CSP) headers
- Secure Electron configuration with context isolation
- Input validation and sanitization

## Getting Started

### Prerequisites

- Node.js 16+
- MongoDB 4.4+
- npm or yarn

### Installation

#### Backend Setup

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/veil.git
   cd veil
   ```

2. Install backend dependencies:
   ```
   cd prototype-backend
   npm install
   ```

3. Create a `.env` file based on `.env.example`:
   ```
   cp .env.example .env
   ```

4. Start MongoDB:
   ```
   mongod --dbpath /path/to/data/directory
   ```

5. Start the backend server:
   ```
   npm run dev
   ```

#### Frontend Setup

1. Install frontend dependencies:
   ```
   cd ../prototype
   npm install
   ```

2. Start the Electron app in development mode:
   ```
   npm run dev
   ```

### Building for Production

1. Build the frontend:
   ```
   cd prototype
   npm run build
   ```

2. The packaged application will be available in the `dist` directory.

## Development

### Project Structure

```
veil/
├── prototype/                 # Frontend (Electron app)
│   ├── src/                   # Source code
│   │   ├── cryptoUtils.js     # Cryptographic utilities
│   │   └── blockchain.js      # Blockchain integration
│   ├── index.html             # Main HTML file
│   ├── main.js                # Electron main process
│   ├── preload.js             # Secure preload script
│   ├── renderer.js            # Renderer process
│   └── front-end.js           # Frontend logic
│
└── prototype-backend/         # Backend (Node.js server)
    ├── config.js              # Configuration
    ├── cryptoUtils.js         # Cryptographic utilities
    ├── middleware/            # Express middleware
    │   └── auth.js            # Authentication middleware
    ├── models/                # Mongoose models
    │   ├── User.js            # User model
    │   └── EphemeralMessage.js # Message model
    ├── routes/                # API routes
    │   ├── auth.js            # Authentication routes
    │   ├── contacts.js        # Contact management routes
    │   ├── messages.js        # Message handling routes
    │   └── users.js           # User management routes
    └── server.js              # Main server file
```

## API Documentation

### Authentication

- `POST /auth/start`: Start authentication with phone number
- `POST /auth/register`: Register a new user
- `POST /auth/verify`: Verify OTP and login

### Users

- `GET /users/:id`: Get a user's public profile
- `GET /users/me`: Get the authenticated user's profile
- `PUT /users/me`: Update the authenticated user's profile
- `DELETE /users/me`: Deactivate the user's account

### Contacts

- `GET /contacts`: Get the user's contact list
- `POST /contacts/add`: Add a contact
- `DELETE /contacts/:contactId`: Remove a contact
- `GET /contacts/search`: Search for users

### Messages

- `GET /messages`: Get ephemeral messages for the user
- `POST /messages/store`: Store an ephemeral message
- `POST /messages/read`: Mark messages as read
- `DELETE /messages/:id`: Delete a specific message
- `DELETE /messages?contactId=...`: Delete all messages in a conversation

## Socket.IO Events

### Client to Server

- `registerUser`: Register a socket with a user ID
- `userStatus`: Update user online status
- `sendEphemeralMessage`: Send an encrypted message

### Server to Client

- `newEphemeralMessage`: Receive a new encrypted message
- `userStatusChange`: Notification of user status change

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [Electron](https://www.electronjs.org/)
- [Socket.IO](https://socket.io/)
- [Express.js](https://expressjs.com/)
- [MongoDB](https://www.mongodb.com/)
- [EOS Blockchain](https://eos.io/) for providing block hash entropy

### Configuration

The application can be configured using environment variables or the `.env` file:

#### Backend Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `4000` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://127.0.0.1:27017/prototype` |
| `JWT_SECRET` | Secret for JWT signing | `your-secret-key-change-in-production` |
| `JWT_EXPIRES_IN` | JWT expiration time | `1d` |
| `OTP_EXPIRES_IN` | OTP expiration time in seconds | `300` (5 minutes) |
| `SMS_ENABLED` | Enable SMS sending | `false` |
| `SMS_API_URL` | SMS API URL | `https://api.guesswhosback.in/api/v1/sms` | 
| `SMS_API_KEY` | SMS API key | (default key) |
| `SMS_CALLER_ID` | SMS sender ID | `VEILAPP` |
| `DEMO_MODE` | Enable demo mode | `true` |
| `DEMO_OTP` | Default OTP for demo mode | `1111` | 