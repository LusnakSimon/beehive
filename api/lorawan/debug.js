const { connectDB } = require('../../lib/utils/db.js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow in development or with secret
  const isAllowed = 
    process.env.NODE_ENV === 'development' || 
    req.headers['x-debug-key'] === process.env.DEBUG_KEY;
  
  if (!isAllowed) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const diagnostics = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production',
    mongodbUri: process.env.MONGODB_URI ? 
      `mongodb+srv://***:***@${process.env.MONGODB_URI.split('@')[1]?.split('/')[0] || 'unknown'}` : 
      'NOT SET',
    dbConnection: null,
    error: null
  };

  try {
    await connectDB();
    diagnostics.dbConnection = 'SUCCESS';
    
    // Quick test query
    const mongoose = require('mongoose');
    const collections = await mongoose.connection.db.listCollections().toArray();
    diagnostics.collections = collections.map(c => c.name);
    
  } catch (error) {
    diagnostics.dbConnection = 'FAILED';
    diagnostics.error = {
      name: error.name,
      message: error.message,
      code: error.code
    };
  }

  res.status(200).json(diagnostics);
};
