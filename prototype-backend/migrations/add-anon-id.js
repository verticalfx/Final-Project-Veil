const mongoose = require('mongoose');
const crypto = require('crypto');
const config = require('../config');

/**
 * Generate a Telegram-style anonymous ID
 * Format: 888XXXXXXX (where X is a digit)
 * @returns {string} The generated anonymous ID
 */
function generateTelegramStyleAnonId() {
  // Generate 7 random digits
  const min = 0;
  const max = 9999999;
  const randomNum = Math.floor(min + Math.random() * (max - min + 1))
    .toString()
    .padStart(7, '0');
  
  return `888${randomNum}`;
}

async function migrateUsers() {
  try {
    // Connect to MongoDB
    await mongoose.connect(config.db.uri, config.db.options);
    console.log('Connected to MongoDB');

    // Get the User model directly from mongoose to avoid validation issues
    const User = mongoose.model('User');

    // Find all users without an anonId
    const users = await User.find({ anonId: { $exists: false } });
    console.log(`Found ${users.length} users without an anonId`);

    // Keep track of generated anonIds to ensure uniqueness
    const generatedAnonIds = new Set();

    // Update each user with a unique anonId
    for (const user of users) {
      // Generate a unique Telegram-style anonymous ID
      let anonId;
      do {
        anonId = generateTelegramStyleAnonId();
      } while (generatedAnonIds.has(anonId));
      
      // Add to set of generated IDs
      generatedAnonIds.add(anonId);
      
      // Update the user directly in the database to bypass validation
      await User.updateOne(
        { _id: user._id },
        { $set: { anonId: anonId } }
      );
      
      console.log(`Updated user ${user._id} with anonId ${anonId}`);
    }

    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    // Close the MongoDB connection
    await mongoose.connection.close();
    console.log('Disconnected from MongoDB');
  }
}

// Run the migration
migrateUsers(); 