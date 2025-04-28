const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/prototype-chat')
  .then(() => {
    console.log('Connected to MongoDB');
    
    // Create a model with an empty schema to query all fields
    const EphemeralMessage = mongoose.model('ephemeralmessages', new mongoose.Schema({}, { strict: false }));
    
    // Find all messages
    return EphemeralMessage.find({})
      .then(messages => {
        console.log('Total messages found:', messages.length);
        console.log(JSON.stringify(messages, null, 2));
        
        // Find undelivered messages
        return EphemeralMessage.find({ delivered: false })
          .then(undeliveredMessages => {
            console.log('\nUndelivered messages:', undeliveredMessages.length);
            console.log(JSON.stringify(undeliveredMessages, null, 2));
          });
      })
      .finally(() => {
        mongoose.disconnect();
        console.log('Disconnected from MongoDB');
      });
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }); 