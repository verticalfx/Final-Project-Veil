// prototype-backend/test/auth.test.js

const request = require('supertest');
const { expect } = require('chai');

describe('Authentication API', function() {
  // Make sure your server is running on :4000 before you run this
  const api = request('http://localhost:4000');
  let otpRequestToken;

  it('POST /auth/start → 200 + X-OTP-Request-Token header', async function() {
    const res = await api
      .post('/auth/start')
      .send({ phoneNumber: '+441234567890' })
      .expect(200);

    expect(res.headers).to.have.property('x-otp-request-token');
    otpRequestToken = res.headers['x-otp-request-token'];
  });

  it('POST /auth/verify with invalid OTP → 400 error', async function() {
    const res = await api
      .post('/auth/verify')
      .send({
        phoneNumber: '+441234567890',
        otp: '000000',
        requestToken: otpRequestToken,
      })
      .expect(400);

    expect(res.body.error).to.match(/Invalid OTP|expired/);
  });
});
