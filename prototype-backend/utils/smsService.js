/**
 * SMS Service Utility
 * Handles sending SMS messages in both production and demo modes
 */

const axios = require('axios');
const config = require('../config');

/**
 * Format phone number to E.164 format
 * @param {string} phoneNumber 
 * @returns {string}
 */
function formatPhoneNumber(phoneNumber) {
  // Remove all non-digit characters except leading +
  let formatted = phoneNumber.replace(/[^\d+]/g, '');
  // Ensure it starts with +
  if (!formatted.startsWith('+')) {
    formatted = '+' + formatted;
  }
  return formatted;
}

/**
 * Send an SMS message
 * @param {string} phoneNumber - The recipient's phone number
 * @param {string} message - The message content
 * @returns {Promise<Object>} - Response object with success status and details
 */
async function sendSMS(phoneNumber, message) {
  const formattedPhone = formatPhoneNumber(phoneNumber);

  // In demo mode, just log the message and return success
  if (config.sms.demoMode) {
    console.log(`[DEMO SMS] To: ${formattedPhone}, Message: ${message}`);
    return {
      success: true,
      demo: true,
      message: 'SMS sent in demo mode (not actually sent)',
      phoneNumber: formattedPhone,
      messageContent: message
    };
  }

  // In production mode with SMS enabled, send the actual SMS
  if (config.sms.enabled) {
    try {
      // Validate API configuration
      if (!config.sms.apiKey) {
        throw new Error('SMS_API_KEY is not configured');
      }

      const response = await axios.get(config.sms.apiUrl, {
        params: {
          api_key: config.sms.apiKey,
          from: 'veilapp',
          to: formattedPhone,
          message: message
        }
      });

      console.log('Response:', response.data);

      if (response.data && response.data.success) {
        return {
          success: true,
          demo: false,
          apiResponse: response.data,
          phoneNumber: formattedPhone,
          messageContent: message,
          cost: response.data.cost
        };
      } else {
        throw new Error(`API returned unsuccessful response: ${JSON.stringify(response.data)}`);
      }
    } catch (error) {
      console.log(error);
      
      console.error('SMS Error:', {
        error: error.message,
        phone: formattedPhone,
        response: error.response?.data
      });

      return {
        success: false,
        demo: false,
        error: error.response?.data?.message || error.message,
        errorCode: error.response?.status || 500,
        phoneNumber: formattedPhone,
        retryable: error.response?.status >= 500 || error.code === 'ECONNABORTED'
      };
    }
  }

  // SMS is disabled
  return {
    success: false,
    demo: false,
    error: 'SMS sending is disabled',
    phoneNumber: formattedPhone,
    retryable: false
  };
}

/**
 * Send an OTP message
 * @param {string} phoneNumber - The recipient's phone number
 * @param {string} otp - The OTP code
 * @returns {Promise<Object>} - Response object with success status and details
 */
async function sendOTP(phoneNumber, otp) {
  // Validate OTP format
  if (!/^\d{6}$/.test(otp)) {
    return {
      success: false,
      error: 'Invalid OTP format',
      retryable: false
    };
  }

  const message = `Your Veil verification code is: ${otp}. Valid for 5 minutes. DO NOT share this code with anyone.`;
  
  // Try sending up to 3 times if retryable error occurs
  let attempts = 0;
  const maxAttempts = 3;
  
  while (attempts < maxAttempts) {
    attempts++;
    const result = await sendSMS(phoneNumber, message);
    
    if (result.success || !result.retryable) {
      return result;
    }
    
    if (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000 * attempts)); // Exponential backoff
    }
  }
  
  return {
    success: false,
    error: 'Failed to send OTP after multiple attempts',
    retryable: false
  };
}

module.exports = {
  sendSMS,
  sendOTP
}; 