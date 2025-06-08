const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, '..', 'perf_server.log');

function logPerf(entry) {
  try {
    fs.appendFileSync(logFile, JSON.stringify(entry) + '\n', 'utf8');
  } catch (e) {
    console.error('perfLogger write error', e);
  }
}

module.exports = { logPerf }; 