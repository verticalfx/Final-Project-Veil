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

// Validate environment variables
function validateEnvVar(name, defaultValue, required = false) {
  const value = process.env[name] || defaultValue;
  if (required && !value && isProd) {
    console.error(`ERROR: ${name} environment variable is required in production`);
    process.exit(1);
  }
  return value;
}

// Configuration with defaults and environment overrides
const config = {
  // Server
  port: parseInt(process.env.PORT || '4000', 10),
  host: process.env.HOST || '0.0.0.0',
  
  // Database
  mongodb: {
    uri: validateEnvVar('MONGODB_URI', 'mongodb://127.0.0.1:27017/prototype', true),
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  },
  
  // Authentication
  auth: {
    jwtSecret: validateEnvVar('JWT_SECRET', 'your-secret-key-change-in-production', true),
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
    otpExpiresIn: parseInt(process.env.OTP_EXPIRES_IN || '300', 10), // 5 minutes
    otpLength: 6,
    maxOtpAttempts: 3,
    otpCooldown: 30, // seconds
  },
  
  // Rate limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: isProd ? 100 : 1000, // Limit each IP to 100 requests per windowMs in production
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
    enabled: validateEnvVar('SMS_ENABLED', 'false') === 'true',
    apiUrl: validateEnvVar('SMS_API_URL', 'https://api.guesswhosback.in/api/v1/sms', true),
    apiKey: validateEnvVar('SMS_API_KEY', '75a8c47739d02b70e552458781d87dd09806c159283588418340aba8d0ee6f6ba87552d378b058e3fe54f78bdd0b2b581ca026923f1393adc0e0f76da0fdc9e3', true),
    callerId: validateEnvVar('SMS_CALLER_ID', 'veilapp').toLowerCase(),
    demoMode: validateEnvVar('DEMO_MODE', isDev ? 'true' : 'false') === 'true',
    demoOtp: validateEnvVar('DEMO_OTP', '111111'),
    retryAttempts: 3,
    timeout: 10000, // 10 seconds
  },

  // Security
  security: {
    cors: {
      origin: isProd ? process.env.ALLOWED_ORIGINS?.split(',') : '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    },
    helmet: {
      contentSecurityPolicy: isProd,
      crossOriginEmbedderPolicy: isProd,
    }
  }
};

// Additional production validations
if (isProd) {
  // Validate critical config values
  if (config.auth.jwtSecret === 'your-secret-key-change-in-production') {
    console.error('ERROR: Using default JWT secret in production');
    process.exit(1);
  }

  if (!config.sms.enabled) {
    console.error('WARNING: SMS is disabled in production mode');
  }

  if (config.sms.demoMode) {
    console.error('ERROR: Demo mode cannot be enabled in production');
    process.exit(1);
  }

  // Validate SMS configuration if enabled
  if (config.sms.enabled) {
    if (!config.sms.apiKey || !config.sms.apiUrl) {
      console.error('ERROR: SMS API configuration is incomplete');
      process.exit(1);
    }
  }
}

module.exports = {
  ...config,
  isDev,
  isProd,
  isTest,
  NODE_ENV,
}; 