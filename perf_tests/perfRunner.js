const io = require('socket.io-client');
const fs = require('fs');
const path = require('path');

if (process.argv.length < 4) {
  console.log('Usage: node perfRunner.js <JWT> <USER_ID>');
  process.exit(1);
}

const token = process.argv[2];
const userId = process.argv[3];
const target = 'http://localhost:4000';

const socket = io(target, { auth: { token }, transports: ['websocket'] });

const outFile = path.join(__dirname, 'perf_client_cli.log');

function log(entry) {
  fs.appendFileSync(outFile, JSON.stringify(entry) + '\n');
}

socket.on('connect', () => {
  console.log('Connected, starting burst test…');
  burstTest(100, 10);
});

socket.on('ephemeral_message', (msg) => {
  if (msg.t0Epoch) {
    const rtt = Date.now() - msg.t0Epoch;
    log({ type: 'relay', rttMs: rtt, id: msg.messageId });
  }
});

function sendOnce() {
  const payload = {
    messageId: cryptoUUID(),
    toUserId: userId,
    nonceHex: '00',
    blockHash: '00',
    iv: '00',
    authTag: '00',
    ciphertext: '00',
    t0Epoch: Date.now()
  };
  socket.emit('ephemeral_message', payload);
}

function burstTest(count, delayMs) {
  let sent = 0;
  const id = setInterval(() => {
    sendOnce();
    sent++;
    console.log(`Sent ${sent} of ${count}`);
    if (sent >= count) clearInterval(id);
  }, delayMs);
}

function cryptoUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
} 