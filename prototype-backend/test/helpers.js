const request = require('supertest');

/**
 * Helper to authenticate a test user
 * @param {string} phoneNumber - Phone number to use (defaults to a random test number)
 * @return {Promise<Object>} - Authentication data including token, user and request objects
 */
async function authenticateTestUser(phoneNumber = `+44123456${Math.floor(Math.random() * 9000) + 1000}`) {
  const api = request('http://localhost:4000');
  
  // Start the authentication process
  const startRes = await api
    .post('/auth/start')
    .send({ phoneNumber })
    .expect(200);
  
  const demoOtp = startRes.body.otp;
  const requestToken = startRes.headers['x-otp-request-token'];
  
  // If this is a new phone number, register a user first
  if (startRes.body.needsRegistration) {
    await api
      .post('/auth/register')
      .send({
        phoneNumber,
        username: 'testuser' + Math.floor(Math.random() * 10000)
      })
      .expect(200);
  }
  
  // Verify the OTP
  const verifyRes = await api
    .post('/auth/verify')
    .set('X-OTP-Request-Token', requestToken)
    .send({
      phoneNumber,
      otp: demoOtp,
      requestToken // for fallback
    })
    .expect(200);
  
  const authToken = verifyRes.body.token;
  const user = verifyRes.body.user;
  
  return {
    token: authToken,
    user,
    phoneNumber,
    api,
    // Helper function to make authenticated requests
    async request(method, path, data = null) {
      const req = api[method](path)
        .set('Authorization', `Bearer ${authToken}`);
      
      if (data && (method === 'post' || method === 'put')) {
        req.send(data);
      }
      
      return req;
    }
  };
}

/**
 * Create a socket.io client connected to the server
 * @param {string} token - Authentication token
 * @return {SocketIOClient.Socket} - Connected socket.io client
 */
function createSocketClient(token) {
  const ioClient = require('socket.io-client');
  return ioClient('http://localhost:4000', { 
    auth: { token },
    reconnection: false
  });
}

/**
 * Wait for a specific amount of time
 * @param {number} ms - Milliseconds to wait
 * @return {Promise<void>}
 */
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  authenticateTestUser,
  createSocketClient,
  wait
}; 