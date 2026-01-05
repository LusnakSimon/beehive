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
  //               visibility: 'private'|'public',
  //               device: { type: 'api', apiKey: '...', devEUI: '...' (optional for LoRaWAN) } }
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
          
          // Validate coordinates if present and not empty
          if (hive.coordinates) {
            const { lat, lng } = hive.coordinates;
            // Allow empty/null coordinates - they'll be cleaned up
            if (lat === '' || lat === null || lat === undefined) return true;
            if (lng === '' || lng === null || lng === undefined) return true;
            // If present and not empty, must be valid numbers
            const latNum = typeof lat === 'string' ? parseFloat(lat) : lat;
            const lngNum = typeof lng === 'string' ? parseFloat(lng) : lng;
            if (isNaN(latNum) || latNum < -90 || latNum > 90) {
              return false;
            }
            if (isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
              return false;
            }
          }
          
          // Validate visibility if present
          if (hive.visibility && !['private', 'public'].includes(hive.visibility)) {
            return false;
          }
          
          // Validate device if present
          if (hive.device) {
            // Validate device type: manual (user enters data) or api (device posts via API key)
            // Also allow legacy types for backward compatibility
            const validTypes = ['manual', 'api', 'esp32-wifi', 'lorawan'];
            if (hive.device.type && !validTypes.includes(hive.device.type)) {
              return false;
            }
            
            // Validate devEUI format (16 hex characters) - optional for LoRaWAN webhook auth
            // Allow empty string or undefined
            if (hive.device.devEUI && hive.device.devEUI !== '') {
              const devEUIRegex = /^[0-9A-Fa-f]{16}$/;
              if (!devEUIRegex.test(hive.device.devEUI)) {
                return false;
              }
            }
            
            // apiKey is auto-generated for api type devices (32 char hex)
            // No validation needed - it's managed by the system
            
            // Validate battery level (0-100)
            if (hive.device.batteryLevel !== undefined) {
              if (typeof hive.device.batteryLevel !== 'number' || 
                  hive.device.batteryLevel < 0 || 
                  hive.device.batteryLevel > 100) {
                return false;
              }
            }
          }
          
          return true;
        });
      },
      message: 'Invalid hive data: check coordinates, visibility, or device type (manual/api)'
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

// Pre-save hook to clean up hive data before validation
userSchema.pre('save', function(next) {
  if (this.ownedHives && Array.isArray(this.ownedHives)) {
    this.ownedHives = this.ownedHives.map(hive => {
      if (typeof hive === 'string') return hive;
      if (typeof hive !== 'object' || hive === null) return hive;
      
      // Clean up coordinates - remove if empty/invalid
      if (hive.coordinates) {
        const lat = hive.coordinates.lat;
        const lng = hive.coordinates.lng;
        
        // Remove coordinates if empty
        if (lat === '' || lat === null || lat === undefined ||
            lng === '' || lng === null || lng === undefined) {
          delete hive.coordinates;
        } else {
          // Convert strings to numbers
          const latNum = typeof lat === 'string' ? parseFloat(lat) : lat;
          const lngNum = typeof lng === 'string' ? parseFloat(lng) : lng;
          
          if (isNaN(latNum) || isNaN(lngNum)) {
            delete hive.coordinates;
          } else {
            hive.coordinates = { lat: latNum, lng: lngNum };
          }
        }
      }
      
      // Clean up device - remove empty devEUI
      if (hive.device) {
        if (hive.device.devEUI === '' || hive.device.devEUI === null) {
          delete hive.device.devEUI;
        }
        if (hive.device.deviceId === '' || hive.device.deviceId === null) {
          delete hive.device.deviceId;
        }
      }
      
      return hive;
    });
  }
  next();
});

// Index for faster lookups (email is already indexed via unique: true)
userSchema.index({ 'accounts.provider': 1, 'accounts.providerAccountId': 1 });
userSchema.index({ 'ownedHives.device.devEUI': 1 }); // Fast device lookup for LoRaWAN webhook
userSchema.index({ 'ownedHives.device.apiKey': 1 }); // Fast device lookup for WiFi API key

const User = mongoose.models.User || mongoose.model('User', userSchema);

// Helper to generate a secure API key (32 hex characters)
function generateDeviceApiKey() {
  const crypto = require('crypto');
  return crypto.randomBytes(16).toString('hex');
}

module.exports = User;
module.exports.generateDeviceApiKey = generateDeviceApiKey;
