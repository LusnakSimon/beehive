const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  image: {
    type: String
  },
  emailVerified: {
    type: Date
  },
  // OAuth provider accounts
  accounts: [{
    provider: String,      // 'google' | 'github'
    providerAccountId: String,
    type: String,          // 'oauth'
    access_token: String,
    refresh_token: String,
    expires_at: Number,
    token_type: String,
    scope: String,
    id_token: String
  }],
  // Owned hives
  ownedHives: [{
    id: { type: String, required: true },      // 'HIVE-001'
    name: { type: String, required: true },    // 'Záhradný úľ'
    location: { type: String, default: '' },   // 'Záhrada A'
    color: { type: String, default: '#fbbf24' }, // '#3b82f6'
    coordinates: {
      lat: { type: Number },  // Latitude
      lng: { type: Number }   // Longitude
    },
    visibility: {
      type: String,
      enum: ['private', 'public'],
      default: 'private'  // private = len vlastník, public = všetci užívatelia
    }
  }],
  // Role for future admin features
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date,
    default: Date.now
  }
});

// Index for faster lookups
userSchema.index({ email: 1 });
userSchema.index({ 'accounts.provider': 1, 'accounts.providerAccountId': 1 });

const User = mongoose.models.User || mongoose.model('User', userSchema);

module.exports = User;
