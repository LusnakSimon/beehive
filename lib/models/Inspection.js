const mongoose = require('mongoose');

// Inspection Schema
const inspectionSchema = new mongoose.Schema({
  checklist: {
    pollen: { type: Boolean, default: false },
    capped: { type: Boolean, default: false },
    opened: { type: Boolean, default: false },
    eggs: { type: Boolean, default: false },
    queenSeen: { type: Boolean, default: false },
    queenbeeCell: { type: Boolean, default: false },
    queenbeeCellCapped: { type: Boolean, default: false },
    inspectionNeeded: { type: Boolean, default: false }
  },
  notes: {
    type: String,
    default: ''
  },
  hiveId: {
    type: String,
    default: 'HIVE-001'
  },
  userId: {
    type: String,
    required: false
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

inspectionSchema.index({ timestamp: -1 });
inspectionSchema.index({ hiveId: 1, timestamp: -1 });
inspectionSchema.index({ userId: 1, timestamp: -1 });

module.exports = mongoose.models.Inspection || mongoose.model('Inspection', inspectionSchema);
