// config.js - Environment configuration
const path = require('path');
const fs = require('fs');

// Try to load .env file if it exists
try {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
  }
} catch (error) {
  console.warn('Error loading .env file:', error.message);
}

// Environment detection
const NODE_ENV = process.env.NODE_ENV || 'development';
const isDev = NODE_ENV === 'development';
const isProd = NODE_ENV === 'production';
const isTest = NODE_ENV === 'test';

// Configuration with defaults and environment overrides
const config = {
  // Server
  port: parseInt(process.env.PORT || '4000', 10),
  host: process.env.HOST || '0.0.0.0',
  
  // Database
  db: {
    uri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/prototype',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    },
  },
  
  // Authentication
  auth: {
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN,
    otpExpiresIn: process.env.OTP_EXPIRES_IN,
  },
  
  // Rate limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10), // limit each IP to 100 requests per windowMs
  },
  
  // CORS
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-OTP-Request-Token'],
    exposedHeaders: ['X-OTP-Request-Token'],
  },
  
  // Logging
  logging: {
    level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
    format: isDev ? 'dev' : 'combined',
  },
  
  // SMS API Configuration
  sms: {
    enabled: process.env.SMS_ENABLED === 'true' || false, // Default to disabled
    apiUrl: process.env.SMS_API_URL,
    apiKey: process.env.SMS_API_KEY,
    callerId: process.env.SMS_CALLER_ID,
    demoMode: process.env.DEMO_MODE !== 'false',
    demoOtp: process.env.DEMO_OTP,
  },
};

// Validate critical config values in production
if (isProd) {
  if (config.auth.jwtSecret === 'your-secret-key-change-in-production') {
    console.error('WARNING: Using default JWT secret in production. Set JWT_SECRET environment variable.');
    process.exit(1);
  }
}

module.exports = {
  ...config,
  isDev,
  isProd,
  isTest,
  NODE_ENV,
}; 