// preload.js
const { contextBridge, ipcRenderer } = require('electron');
const crypto = require('crypto');

// Expose protected methods that allow the renderer process to use
// specific Node.js APIs without exposing the entire Node.js API
contextBridge.exposeInMainWorld(
  'electron',
  {
    // App info
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    
    // Filesystem operations (limited)
    saveData: (key, data) => {
      if (typeof key !== 'string' || !key) {
        throw new Error('Invalid key');
      }
      
      // Sanitize the key to prevent path traversal
      const sanitizedKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
      
      return ipcRenderer.invoke('save-data', sanitizedKey, data);
    },
    
    loadData: (key) => {
      if (typeof key !== 'string' || !key) {
        throw new Error('Invalid key');
      }
      
      // Sanitize the key to prevent path traversal
      const sanitizedKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
      
      return ipcRenderer.invoke('load-data', sanitizedKey);
    }
  }
);

// Expose crypto functions securely
contextBridge.exposeInMainWorld(
  'secureCrypto',
  {
    // Generate a random buffer
    getRandomBytes: (size) => {
      if (typeof size !== 'number' || size <= 0 || size > 1024) {
        throw new Error('Invalid size');
      }
      
      return crypto.randomBytes(size).toString('hex');
    },
    
    // Hash data using SHA-256
    sha256: (data) => {
      if (!data) {
        throw new Error('Data is required');
      }
      
      return crypto.createHash('sha256').update(data).digest('hex');
    },
    
    // Derive an ephemeral key from a block hash and nonce
    deriveEphemeralKey: async (blockHash, nonceHex) => {
      if (!blockHash || !nonceHex) {
        throw new Error('Block hash and nonce are required');
      }
      
      const hashBuf = Buffer.from(blockHash, 'hex');
      const nonce = Buffer.from(nonceHex, 'hex');
      
      return new Promise((resolve, reject) => {
        crypto.hkdf(
          'sha256',
          nonce,     // salt
          hashBuf,   // info
          '',        // no extra info
          32,        // length of derived key in bytes
          (err, derivedKey) => {
            if (err) return reject(err);
            resolve(derivedKey.toString('hex'));
          }
        );
      });
    },
    
    // Encrypt data using AES-GCM
    encryptAESGCM: (keyHex, plaintext) => {
      if (!keyHex || !plaintext) {
        throw new Error('Key and plaintext are required');
      }
      
      const key = Buffer.from(keyHex, 'hex');
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      
      const encrypted = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final()
      ]);
      
      const authTag = cipher.getAuthTag();
      
      return {
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        ciphertext: encrypted.toString('hex')
      };
    },
    
    // Decrypt data using AES-GCM
    decryptAESGCM: (keyHex, ivHex, authTagHex, ciphertextHex) => {
      if (!keyHex || !ivHex || !authTagHex || !ciphertextHex) {
        throw new Error('Key, IV, auth tag, and ciphertext are required');
      }
      
      try {
        const key = Buffer.from(keyHex, 'hex');
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        const ciphertext = Buffer.from(ciphertextHex, 'hex');
        
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(authTag);
        
        const decrypted = Buffer.concat([
          decipher.update(ciphertext),
          decipher.final()
        ]);
        
        return decrypted.toString('utf8');
      } catch (error) {
        throw new Error('Decryption failed: ' + error.message);
      }
    }
  }
); 