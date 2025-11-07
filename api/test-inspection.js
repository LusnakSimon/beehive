const mongoose = require('mongoose');

let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('MONGODB_URI not found in environment variables');
    }
    cached.promise = mongoose.connect(uri, {
      bufferCommands: false,
      maxPoolSize: 10,
    });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  try {
    // Test MongoDB connection
    await connectDB();
    
    // Test model loading
    const Inspection = require('../lib/models/Inspection.js');
    
    // Try to count documents
    const count = await Inspection.countDocuments();
    
    return res.json({
      success: true,
      message: 'MongoDB connection works',
      count,
      mongooseState: mongoose.connection.readyState,
      hasMongoUri: !!process.env.MONGODB_URI,
      reqUrl: req.url,
      reqMethod: req.method
    });
  } catch (error) {
    console.error('Test endpoint error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
      hasMongoUri: !!process.env.MONGODB_URI
    });
  }
};
// Force redeploy - Fri Nov  7 04:40:31 PM UTC 2025
