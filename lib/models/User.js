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
  // Owned hives - Mixed type to support both old (string array) and new (object array) formats
  // New format: { id: 'HIVE-001', name: 'Záhradný úľ', location: 'Záhrada A',
  //               color: '#fbbf24', coordinates: { lat: 48.716, lng: 21.261 },
  //               visibility: 'private'|'public' }
  // Old format: 'HIVE-001' (string)
  ownedHives: {
    type: [mongoose.Schema.Types.Mixed],
    default: [],
    validate: {
      validator: function(hives) {
        // Validate each hive object
        return hives.every(hive => {
          // Old format (string) is always valid
          if (typeof hive === 'string') return true;
          
          // New format validation
          if (typeof hive !== 'object') return false;
          
          // Validate coordinates if present
          if (hive.coordinates) {
            const { lat, lng } = hive.coordinates;
            if (lat !== undefined && (typeof lat !== 'number' || lat < -90 || lat > 90)) {
              return false;
            }
            if (lng !== undefined && (typeof lng !== 'number' || lng < -180 || lng > 180)) {
              return false;
            }
          }
          
          // Validate visibility if present
          if (hive.visibility && !['private', 'public'].includes(hive.visibility)) {
            return false;
          }
          
          return true;
        });
      },
      message: 'Invalid hive data: coordinates must be lat(-90 to 90), lng(-180 to 180), visibility must be private or public'
    }
  },
  // User profile information
  profile: {
    bio: {
      type: String,
      maxlength: 500,
      default: ''
    },
    location: {
      type: String,
      maxlength: 100,
      default: ''
    },
    experienceYears: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    profilePicture: {
      type: String,
      default: ''
    },
    coverPhoto: {
      type: String,
      default: ''
    },
    website: {
      type: String,
      maxlength: 200,
      default: ''
    },
    phone: {
      type: String,
      maxlength: 20,
      default: ''
    },
    isPublic: {
      type: Boolean,
      default: true  // Profile is public by default
    },
    showEmail: {
      type: Boolean,
      default: false  // Don't show email by default
    },
    showHiveLocations: {
      type: Boolean,
      default: true  // Show hive locations by default
    }
  },
  // User statistics
  stats: {
    totalHives: {
      type: Number,
      default: 0
    },
    publicHives: {
      type: Number,
      default: 0
    },
    friendsCount: {
      type: Number,
      default: 0
    },
    groupsCount: {
      type: Number,
      default: 0
    }
  },
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
