// prototype-backend/test/auth.test.js

const request = require('supertest');
const { expect } = require('chai');

describe('Authentication API', function() {
  // Increase timeout for API calls
  this.timeout(5000);
  
  // Make sure your server is running on :4000 before you run this
  const api = request('http://localhost:4000');
  let otpRequestToken;
  let authToken;
  let userId;
  const testPhone = '+441234567890';

  describe('Basic Authentication Flow', function() {
    it('POST /auth/start → 200 + X-OTP-Request-Token header', async function() {
      const res = await api
        .post('/auth/start')
        .send({ phoneNumber: testPhone })
        .expect(200);

      expect(res.headers).to.have.property('x-otp-request-token');
      otpRequestToken = res.headers['x-otp-request-token'];
      
      // In development/test mode, the OTP should be returned in the response
      expect(res.body).to.have.property('otp');
    });

    it('POST /auth/verify with OTP → 200 + token', async function() {
      // Get the OTP from the previous response
      const startRes = await api
        .post('/auth/start')
        .send({ phoneNumber: testPhone })
        .expect(200);
      
      const demoOtp = startRes.body.otp;
      const reqToken = startRes.headers['x-otp-request-token'];
      
      // If this is the first time this phone is used, register a user first
      if (startRes.body.needsRegistration) {
        await api
          .post('/auth/register')
          .send({
            phoneNumber: testPhone,
            username: 'testuser' + Math.floor(Math.random() * 10000)
          })
          .expect(200);
      }
      
      const res = await api
        .post('/auth/verify')
        .set('X-OTP-Request-Token', reqToken)
        .send({
          phoneNumber: testPhone,
          otp: demoOtp
        })
        .expect(200);
      
      expect(res.body).to.have.property('token');
      expect(res.body).to.have.property('user');
      
      authToken = res.body.token;
      userId = res.body.user.anonId;
    });

    it('POST /auth/verify with invalid OTP → 400 error', async function() {
      // Request a fresh OTP so the server has an entry in otpStore
      const freshStart = await api
        .post('/auth/start')
        .send({ phoneNumber: testPhone })
        .expect(200);

      const freshToken = freshStart.headers['x-otp-request-token'];

      const res = await api
        .post('/auth/verify')
        .set('X-OTP-Request-Token', freshToken)
        .send({
          phoneNumber: testPhone,
          otp: '000000' // deliberately wrong
        })
        .expect(400);

      expect(res.body.error).to.match(/Invalid OTP|request token|expired/);
    });
  });

  describe('Error Cases', function() {
    it('POST /auth/verify with missing OTP → 400', async function() {
      const res = await api
        .post('/auth/verify')
        .set('X-OTP-Request-Token', otpRequestToken)
        .send({
          phoneNumber: testPhone
          // Missing OTP
        })
        .expect(400);
      
      expect(res.body).to.have.property('error');
    });
    
    it('POST /auth/verify with missing request token → 400', async function() {
      // Don't set the X-OTP-Request-Token header
      const res = await api
        .post('/auth/verify')
        .send({
          phoneNumber: testPhone,
          otp: '123456'
        })
        .expect(400);
      
      expect(res.body).to.have.property('error');
    });
  });
});
