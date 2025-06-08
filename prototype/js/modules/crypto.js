/**
 * crypto.js - Cryptography functions for ephemeral messaging
 */

/**
 * Derive an ephemeral key from a block hash and nonce
 */
const deriveEphemeralKey = async (blockHash, nonceHex) => {
    console.log('DERIVE-CHECKPOINT 1: Starting deriveEphemeralKey', {
        blockHashType: typeof blockHash,
        blockHashLength: blockHash?.length,
        nonceHexType: typeof nonceHex,
        nonceHexLength: nonceHex?.length
    });

    try {
        // Get the hex string from the preload API
        const hexResult = await window.secureCrypto.deriveEphemeralKey(blockHash, nonceHex);
        
        // Convert the hex string back to an ArrayBuffer
        const buffer = new ArrayBuffer(hexResult.length / 2);
        const view = new Uint8Array(buffer);
        for (let i = 0; i < hexResult.length; i += 2) {
            view[i / 2] = parseInt(hexResult.substring(i, i + 2), 16);
        }
        
        console.log('DERIVE-CHECKPOINT 2: deriveEphemeralKey result', {
            resultType: 'ArrayBuffer',
            resultIsArrayBuffer: true,
            resultConstructorName: buffer.constructor.name,
            resultLength: buffer.byteLength
        });
        
        return buffer;
    } catch (error) {
        console.error('DERIVE-CHECKPOINT ERROR: Error in deriveEphemeralKey', error);
        throw error;
    }
};

/**
 * Get the ephemeral key as a hex string
 */

async function getEphemeralKeyHex(blockHash, nonceHex) {
    const derivedKey = await deriveEphemeralKey(blockHash, nonceHex);
    
    // If the API returns a CryptoKey, export it to an ArrayBuffer
    if (derivedKey instanceof CryptoKey) {
        const rawKey = await window.crypto.subtle.exportKey('raw', derivedKey);
        return bufferToHex(rawKey);
    }
    
    // If it returns an ArrayBuffer, convert it
    if (derivedKey instanceof ArrayBuffer) {
        return bufferToHex(derivedKey);
    }
    
    // If it's a string but not a valid hex key, throw an error
    if (typeof derivedKey === 'string') {
        if (derivedKey === '[object ArrayBuffer]') {
            throw new Error('deriveEphemeralKey returned an invalid key string.');
        }
        return derivedKey;
    }
    
    throw new Error('Unexpected ephemeral key type.');
}

/**
 * Encrypt data using AES-GCM
 */
const encryptAESGCM = (keyHex, plaintext) => {
    console.log('ENCRYPT-CHECKPOINT 1: Starting encryptAESGCM', {
        keyHexType: typeof keyHex,
        keyHexLength: keyHex?.length,
        plaintextType: typeof plaintext,
        plaintextLength: plaintext?.length
    });

    try {
        // Ensure the key is exactly 64 characters (32 bytes) in hex format
        if (!keyHex || typeof keyHex !== 'string') {
            throw new Error('Key must be a string');
        }

        // Log the key for debugging (first few characters only for security)
        console.log('ENCRYPT-CHECKPOINT 1.5: Key prefix:', keyHex.substring(0, 6) + '...');

        // Ensure the key is exactly 64 characters (32 bytes) in hex format
        if (keyHex.length !== 64) {
            console.log('ENCRYPT-CHECKPOINT 1.6: Adjusting key length from', keyHex.length, 'to 64 characters');

            // If the key is too short, pad it
            if (keyHex.length < 64) {
                while (keyHex.length < 64) {
                    keyHex += keyHex;
                }
                keyHex = keyHex.substring(0, 64);
            }
            // If the key is too long, truncate it
            else if (keyHex.length > 64) {
                keyHex = keyHex.substring(0, 64);
            }
        }

        console.log('ENCRYPT-CHECKPOINT 1.7: Final key length:', keyHex.length);

        const result = window.secureCrypto.encryptAESGCM(keyHex, plaintext);
        console.log('ENCRYPT-CHECKPOINT 2: encryptAESGCM result', {
            resultKeys: Object.keys(result),
            ivLength: result?.iv?.length,
            authTagLength: result?.authTag?.length,
            ciphertextLength: result?.ciphertext?.length
        });
        return result;
    } catch (error) {
        console.error('ENCRYPT-CHECKPOINT ERROR: Error in encryptAESGCM', error);
        throw error;
    }
};

/**
 * Decrypt data using AES-GCM
 */
const decryptAESGCM = (keyHex, ivHex, authTagHex, ciphertextHex) => {
    console.log('DECRYPT-AES-CHECKPOINT 1: Starting decryptAESGCM', {
        keyHexLength: keyHex?.length,
        ivHexLength: ivHex?.length,
        authTagHexLength: authTagHex?.length,
        ciphertextHexLength: ciphertextHex?.length
    });

    try {
        // Ensure the key is exactly 64 characters (32 bytes) in hex format
        if (!keyHex || typeof keyHex !== 'string') {
            throw new Error('Key must be a string');
        }

        // Log the key for debugging (first few characters only for security)
        console.log('DECRYPT-AES-CHECKPOINT 1.5: Key prefix:', keyHex.substring(0, 6) + '...');

        // Ensure the key is exactly 64 characters (32 bytes) in hex format
        if (keyHex.length !== 64) {
            console.log('DECRYPT-AES-CHECKPOINT 1.6: Adjusting key length from', keyHex.length, 'to 64 characters');

            // If the key is too short, pad it
            if (keyHex.length < 64) {
                while (keyHex.length < 64) {
                    keyHex += keyHex;
                }
                keyHex = keyHex.substring(0, 64);
            }
            // If the key is too long, truncate it
            else if (keyHex.length > 64) {
                keyHex = keyHex.substring(0, 64);
            }
        }

        console.log('DECRYPT-AES-CHECKPOINT 1.7: Final key length:', keyHex.length);

        return window.secureCrypto.decryptAESGCM(keyHex, ivHex, authTagHex, ciphertextHex);
    } catch (error) {
        console.error('DECRYPT-AES-CHECKPOINT ERROR: Error in decryptAESGCM', error);
        throw error;
    }
};

/**
 * Get the latest EOS block hash
 */
async function getEOSBlockHash() {
    const endpoint = 'https://eos.greymass.com/v1/chain/get_info';
    const response = await fetch(endpoint, { method: 'POST' });
    const data = await response.json();
    return data.head_block_id;
}

/**
 * Encrypt a message using ephemeral encryption
 */
async function ephemeralEncrypt(blockHash, nonceHex, plaintext) {
    try {
        console.log('CHECKPOINT 1: Starting encryption with params:', {
            blockHashLength: blockHash?.length,
            nonceHexType: typeof nonceHex,
            nonceHexLength: nonceHex?.length,
            plaintextLength: plaintext?.length
        });

        // Derive the ephemeral key from the blockHash and nonce
        console.log('CHECKPOINT 2: About to derive ephemeral key');
        let keyHex = await getEphemeralKeyHex(blockHash, nonceHex);
        console.log('CHECKPOINT 3: Derived ephemeral key hex:', typeof keyHex, keyHex?.length);

        // Check if the key is valid before proceeding
        if (!keyHex || typeof keyHex !== 'string') {
            console.error('CHECKPOINT 6-ERROR: Invalid ephemeral key generated:', typeof keyHex, keyHex);
            throw new Error(`Failed to generate a valid encryption key: ${keyHex}`);
        }

        // Check if the key has the correct length (should be 64 characters for a 256-bit key in hex)
        if (keyHex.length !== 64) {
            console.log('CHECKPOINT 7: Key length adjustment needed:', keyHex.length);
            // If the key is too short, pad it
            if (keyHex.length < 64) {
                while (keyHex.length < 64) {
                    keyHex += keyHex;
                }
                keyHex = keyHex.substring(0, 64);
            } else if (keyHex.length > 64) {
                keyHex = keyHex.substring(0, 64);
            }
        }
        console.log('CHECKPOINT 7: Key is valid, proceeding with encryption');

        // Encrypt the message
        const { iv, authTag, ciphertext } = encryptAESGCM(keyHex, plaintext);
        console.log('CHECKPOINT 8: Message encrypted successfully');

        // Return the encrypted data in the format expected by sendEphemeralMessage
        return {
            encryptedText: ciphertext,
            nonce: nonceHex,
            blockHash,
            iv,
            authTag,
            time: Date.now()
        };
    } catch (error) {
        console.error('CHECKPOINT ERROR: Encryption error:', error);
        throw error;
    }
}

function bufferToHex(buffer) {
    return Array.from(new Uint8Array(buffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
}

/**
 * Decrypt a message using ephemeral encryption
 */
async function ephemeralDecrypt(encryptedData) {
    try {
        console.log('DECRYPT-CHECKPOINT 1: Starting decryption with data:', {
            hasBlockHash: !!encryptedData.blockHash,
            hasNonce: !!encryptedData.nonce || !!encryptedData.nonceHex,
            hasIv: !!encryptedData.iv,
            hasAuthTag: !!encryptedData.authTag,
            hasEncryptedText: !!encryptedData.encryptedText || !!encryptedData.ciphertext
        });

        // Normalize parameter names
        const blockHash = encryptedData.blockHash;
        const nonce = encryptedData.nonce || encryptedData.nonceHex;
        const iv = encryptedData.iv;
        const authTag = encryptedData.authTag;
        const encryptedText = encryptedData.encryptedText || encryptedData.ciphertext;

        if (!blockHash || !nonce || !iv || !authTag || !encryptedText) {
            console.error('DECRYPT-CHECKPOINT ERROR: Missing required encryption data', {
                blockHash: !!blockHash,
                nonce: !!nonce,
                iv: !!iv,
                authTag: !!authTag,
                encryptedText: !!encryptedText
            });
            throw new Error('Missing required encryption data');
        }

        // Derive the ephemeral key
        console.log('DECRYPT-CHECKPOINT 2: Deriving ephemeral key');
        const keyHex = await getEphemeralKeyHex(blockHash, nonce);
        console.log('DECRYPT-CHECKPOINT 3: Derived key hex:', typeof keyHex, keyHex?.length);

        // Check if the key is valid
        if (!keyHex || typeof keyHex !== 'string') {
            console.error('DECRYPT-CHECKPOINT ERROR: Invalid ephemeral key for decryption:', typeof keyHex, keyHex);
            throw new Error('Failed to generate a valid decryption key');
        }

        // Check if the key has the correct length (should be 64 characters for a 256-bit key in hex)
        let finalKeyHex = keyHex;
        if (finalKeyHex.length !== 64) {
            console.log('DECRYPT-CHECKPOINT 3.5: Key length is incorrect, padding or truncating to correct length');

            // If the key is too short, pad it to 64 characters
            if (finalKeyHex.length < 64) {
                // Pad with zeros or repeat the key
                while (finalKeyHex.length < 64) {
                    finalKeyHex += finalKeyHex;
                }
                finalKeyHex = finalKeyHex.substring(0, 64);
            }
            // If the key is too long, truncate it
            else if (finalKeyHex.length > 64) {
                finalKeyHex = finalKeyHex.substring(0, 64);
            }

            console.log('DECRYPT-CHECKPOINT 3.6: Adjusted key length:', finalKeyHex.length);
        }

        console.log('DECRYPT-CHECKPOINT 4: Decrypting message');
        // Decrypt the message
        const plaintext = decryptAESGCM(finalKeyHex, iv, authTag, encryptedText);
        console.log('DECRYPT-CHECKPOINT 5: Decryption successful');

        return plaintext;
    } catch (error) {
        console.error('DECRYPT-CHECKPOINT ERROR: Decryption error:', error);
        throw error;
    }
}

// Export functions
export {
    deriveEphemeralKey,
    encryptAESGCM,
    decryptAESGCM,
    getEOSBlockHash,
    ephemeralEncrypt,
    ephemeralDecrypt
}; 