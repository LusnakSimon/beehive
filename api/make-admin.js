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
    
    // Find user by email
    const user = await User.findOne({ email: 'simonlusnak@gmail.com' });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found. Please log in first via Google OAuth.'
      });
    }
    
    // Update role to admin
    user.role = 'admin';
    
    // Add default hive if none assigned
    if (!user.ownedHives || user.ownedHives.length === 0) {
      user.ownedHives = ['HIVE-001'];
    }
    
    await user.save();
    
    return res.json({
      success: true,
      message: 'Admin role granted successfully!',
      user: {
        email: user.email,
        name: user.name,
        role: user.role,
        ownedHives: user.ownedHives
      }
    });
  } catch (error) {
    console.error('Make admin error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
