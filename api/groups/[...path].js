const mongoose = require('mongoose');
const groupsHandler = require('../../lib/routes/groups.js');

let isConnected = false;

async function connectToDatabase() {
  if (isConnected) {
    return;
  }

  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/beehive';

  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
    });

    isConnected = true;
    console.log('[Groups API] Connected to MongoDB');
  } catch (error) {
    console.error('[Groups API] MongoDB connection failed:', error);
    throw error;
  }
}

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, Cookie'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    await connectToDatabase();
    
    // Forward request to groups handler
    await groupsHandler(req, res);
  } catch (error) {
    console.error('[Groups API] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
