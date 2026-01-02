const mongoose = require('mongoose');

// Harvest Schema - Track honey harvests from hives
const harvestSchema = new mongoose.Schema({
  hiveId: {
    type: String,
    required: true,
    index: true
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  // Harvest details
  amount: {
    type: Number,
    required: true,
    min: 0,
    max: 500 // Max 500kg per harvest (reasonable limit)
  },
  unit: {
    type: String,
    enum: ['kg', 'lb', 'frames'],
    default: 'kg'
  },
  // Honey type/quality
  honeyType: {
    type: String,
    enum: ['flower', 'acacia', 'linden', 'forest', 'sunflower', 'rapeseed', 'chestnut', 'mixed', 'other'],
    default: 'mixed'
  },
  quality: {
    type: String,
    enum: ['excellent', 'good', 'average', 'poor'],
    default: 'good'
  },
  // Moisture content (important for honey quality)
  moistureContent: {
    type: Number,
    min: 10,
    max: 30,
    default: null
  },
  // Color (Pfund scale or descriptive)
  color: {
    type: String,
    enum: ['water-white', 'extra-white', 'white', 'extra-light-amber', 'light-amber', 'amber', 'dark-amber'],
    default: null
  },
  // Frames harvested (optional)
  framesHarvested: {
    type: Number,
    min: 0,
    max: 50,
    default: null
  },
  // Weather conditions during harvest
  weather: {
    type: String,
    default: ''
  },
  // Notes
  notes: {
    type: String,
    maxlength: 1000,
    default: ''
  },
  // Date of harvest
  harvestDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  // Record creation timestamp
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
harvestSchema.index({ hiveId: 1, harvestDate: -1 });
harvestSchema.index({ userId: 1, harvestDate: -1 });
harvestSchema.index({ harvestDate: -1 });

// Static method to get harvest stats for a hive
harvestSchema.statics.getHiveStats = async function(hiveId, year) {
  const startDate = year ? new Date(year, 0, 1) : new Date(0);
  const endDate = year ? new Date(year, 11, 31, 23, 59, 59) : new Date();
  
  const stats = await this.aggregate([
    {
      $match: {
        hiveId,
        harvestDate: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: '$amount' },
        harvestCount: { $sum: 1 },
        avgAmount: { $avg: '$amount' },
        maxAmount: { $max: '$amount' },
        minAmount: { $min: '$amount' }
      }
    }
  ]);
  
  return stats[0] || { totalAmount: 0, harvestCount: 0, avgAmount: 0, maxAmount: 0, minAmount: 0 };
};

// Static method to get yearly harvest summary for a user
harvestSchema.statics.getUserYearlySummary = async function(userId, year) {
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31, 23, 59, 59);
  
  const summary = await this.aggregate([
    {
      $match: {
        userId,
        harvestDate: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: '$hiveId',
        totalAmount: { $sum: '$amount' },
        harvestCount: { $sum: 1 },
        honeyTypes: { $addToSet: '$honeyType' }
      }
    },
    {
      $group: {
        _id: null,
        byHive: { $push: { hiveId: '$_id', totalAmount: '$totalAmount', harvestCount: '$harvestCount', honeyTypes: '$honeyTypes' } },
        grandTotal: { $sum: '$totalAmount' },
        totalHarvests: { $sum: '$harvestCount' }
      }
    }
  ]);
  
  return summary[0] || { byHive: [], grandTotal: 0, totalHarvests: 0 };
};

module.exports = mongoose.models.Harvest || mongoose.model('Harvest', harvestSchema);
