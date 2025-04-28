// prototype-backend/test/messages.test.js
const ioClient = require('socket.io-client');
const request  = require('supertest');
const { expect } = require('chai');

describe('Socket.IO messaging', function() {
  this.timeout(10000);
  let api, tokenA, tokenB, userA, userB, clientA, clientB;

  before(async () => {
    api = request('http://localhost:4000');

    // Register+verify two demo users (using demoMode OTP in body.otp)
    const phoneA = '+44123451111';
    const startA = await api.post('/auth/start').send({ phoneNumber: phoneA }).expect(200);
    const demoOtpA = startA.body.otp;
    // extract from `header` (alias for headers) or via .get():
    const reqTokenA = startA.header['x-otp-request-token'] || startA.get('X-OTP-Request-Token');
    
    const verifyA = await api.post('/auth/verify').send({
      phoneNumber: phoneA,
      otp: demoOtpA,
      requestToken: reqTokenA
    }).expect(200);
    tokenA = verifyA.body.token;
    userA  = { anonId: verifyA.body.user.anonId, _id: verifyA.body.user._id };

    const phoneB = '+44123452222';
    const startB = await api.post('/auth/start').send({ phoneNumber: phoneB }).expect(200);
    const demoOtpB = startB.body.otp;
    const reqTokenB = startB.header['x-otp-request-token'] || startB.get('X-OTP-Request-Token');

    const verifyB = await api.post('/auth/verify').send({
      phoneNumber: phoneB,
      otp: demoOtpB,
      requestToken: reqTokenB
    }).expect(200);
    tokenB = verifyB.body.token;
    userB  = { anonId: verifyB.body.user.anonId, _id: verifyB.body.user._id };
  });

  after(() => {
    if (clientA) clientA.disconnect();
    if (clientB) clientB.disconnect();
  });

  it('should relay messages in real time when recipient is online', (done) => {
    clientB = ioClient('http://localhost:4000', { auth: { token: tokenB } });
    clientA = ioClient('http://localhost:4000', { auth: { token: tokenA } });

    clientB.on('ephemeral_message', msg => {
      expect(msg).to.have.property('ciphertext');
      expect(msg.toUserId).to.equal(userB._id);
      done();
    });

    clientB.on('connect', () => {
      const payload = {
        messageId:    'msg1',
        toUserId:     userB._id,
        fromUserId:   userA._id,
        nonceHex:     '00',
        blockHash:    '00',
        iv:           '00',
        authTag:      '00',
        ciphertext:   'deadbeef',
        time:         new Date().toISOString(),
        expiresAfterRead: true
      };
      clientA.emit('ephemeral_message', payload);
    });
  });

  it('should store messages when recipient is offline', (done) => {
    // Disconnect B so they're offline
    clientB.disconnect();

    clientA = ioClient('http://localhost:4000', { auth: { token: tokenA }});
    clientA.on('message_stored', ack => {
      expect(ack).to.have.property('messageId', 'msg2');
      done();
    });

    clientA.on('connect', () => {
      const payload = {
        messageId:    'msg2',
        toUserId:     userB._id,
        fromUserId:   userA._id,
        nonceHex:     '00',
        blockHash:    '00',
        iv:           '00',
        authTag:      '00',
        ciphertext:   'cafebabe',
        time:         new Date().toISOString(),
        expiresAfterRead: true
      };
      clientA.emit('ephemeral_message', payload);
    });
  });
});
