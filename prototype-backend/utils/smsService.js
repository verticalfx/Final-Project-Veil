/**
 * SMS Service Utility
 * Handles sending SMS messages in both production and demo modes
 */

const axios = require('axios');
const config = require('../config');

/**
 * Send an SMS message
 * @param {string} phoneNumber - The recipient's phone number
 * @param {string} message - The message content
 * @returns {Promise<Object>} - Response object with success status and details
 */
async function sendSMS(phoneNumber, message) {
  // In demo mode, just log the message and return success
  if (config.sms.demoMode) {
    console.log(`[DEMO SMS] To: ${phoneNumber}, Message: ${message}`);
    return {
      success: true,
      demo: true,
      message: 'SMS sent in demo mode (not actually sent)',
      phoneNumber,
      messageContent: message
    };
  }

  // In production mode with SMS enabled, send the actual SMS
  if (config.sms.enabled) {
    try {
      // Prepare data for API call
      const data = {
        api_key: config.sms.apiKey,
        from: config.sms.callerId,
        to: phoneNumber,
        message: message
      };

      // Make API request
      const response = await axios.get(config.sms.apiUrl, { params: data });
      
      console.log(`SMS sent to ${phoneNumber}, Response:`, response.data);
      
      return {
        success: true,
        demo: false,
        apiResponse: response.data,
        phoneNumber,
        messageContent: message
      };
    } catch (error) {
      console.error('Error sending SMS:', error.message);
      return {
        success: false,
        demo: false,
        error: error.message,
        phoneNumber,
        messageContent: message
      };
    }
  }

  // SMS is disabled in production mode
  console.log(`[SMS DISABLED] Would send to: ${phoneNumber}, Message: ${message}`);
  return {
    success: false,
    demo: false,
    message: 'SMS sending is disabled in configuration',
    phoneNumber,
    messageContent: message
  };
}

/**
 * Send an OTP message
 * @param {string} phoneNumber - The recipient's phone number
 * @param {string} otp - The OTP code
 * @returns {Promise<Object>} - Response object with success status and details
 */
async function sendOTP(phoneNumber, otp) {
  const message = `Your Veil verification code is: ${otp}. This code will expire in 5 minutes.`;
  return sendSMS(phoneNumber, message);
}

module.exports = {
  sendSMS,
  sendOTP
}; 