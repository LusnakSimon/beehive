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
  //               device: { type: 'api', apiKey: '...' } }
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
          
          // Validate device if present
          if (hive.device) {
            const validTypes = ['api', 'esp32-wifi'];
            if (hive.device.type && !validTypes.includes(hive.device.type)) {
              return false;
            }
            
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
      message: 'Invalid hive data: check coordinates or device type (api/esp32-wifi)'
    }
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
      
      // Clean up device - remove empty deviceId
      if (hive.device) {
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
userSchema.index({ 'ownedHives.device.apiKey': 1 }); // Fast device lookup for API key

const User = mongoose.models.User || mongoose.model('User', userSchema);

// Helper to generate a secure API key (32 hex characters)
function generateDeviceApiKey() {
  const crypto = require('crypto');
  return crypto.randomBytes(16).toString('hex');
}

module.exports = User;
module.exports.generateDeviceApiKey = generateDeviceApiKey;
