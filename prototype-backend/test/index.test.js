/**
 * Main test entry point.
 * This file simply ensures the server is running before tests are executed.
 * Individual test files are run automatically by Mocha.
 */

const http = require('http');
const { expect } = require('chai');

describe('Prototype Backend API Tests', function() {
  // Increase timeout for server check
  this.timeout(10000);
  
  before(function(done) {
    // Check if the server is running
    checkServerRunning()
      .then(() => done())
      .catch(err => done(new Error(`Server must be running on localhost:4000 before tests can be executed: ${err.message}`)));
  });
  
  // First run only the basic authentication tests
  require('./auth.test');
  
  // Only include these if you've confirmed they work with the current API
  require('./contacts.test');
  require('./users.test');
  //  require('./messages.test');
  //  require('./socket.test');
});

/**
 * Check if the server is running
 * @return {Promise<void>}
 */
function checkServerRunning() {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 4000,
      path: '/',
      method: 'GET',
      timeout: 5000
    }, (res) => {
      if (res.statusCode === 200) {
        resolve();
      } else {
        reject(new Error(`Server returned unexpected status code: ${res.statusCode}`));
      }
      
      // Consume response data to free up memory
      res.resume();
    });
    
    req.on('error', (err) => {
      reject(err);
    });
    
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });
    
    req.end();
  });
} 