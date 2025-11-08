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
    await connectDB();
    
    const User = require('../lib/models/User.js');
    
    // Get all users
    const users = await User.find({}).select('email name role ownedHives');
    
    return res.json({
      success: true,
      count: users.length,
      users: users.map(u => ({
        email: u.email,
        name: u.name,
        role: u.role || 'user',
        ownedHives: u.ownedHives || []
      }))
    });
  } catch (error) {
    console.error('Debug users error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
