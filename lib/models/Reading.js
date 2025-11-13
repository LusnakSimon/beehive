const mongoose = require('mongoose');

const readingSchema = new mongoose.Schema({
  temperature: {
    type: Number,
    required: true
  },
  humidity: {
    type: Number,
    required: true
  },
  weight: {
    type: Number,
    required: true
  },
  battery: {
    type: Number,
    default: 100
  },
  batteryLevel: {
    type: Number,
    min: 0,
    max: 100
  },
  signalStrength: {
    type: Number  // RSSI in dBm (e.g., -80)
  },
  source: {
    type: String,
    enum: ['WiFi', 'LoRaWAN', 'Manual', 'Simulator'],
    default: 'WiFi'
  },
  hiveId: {
    type: String,
    default: 'HIVE-001'
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Index pre rýchle vyhľadávanie
readingSchema.index({ timestamp: -1 });
readingSchema.index({ hiveId: 1, timestamp: -1 });

module.exports = mongoose.models.Reading || mongoose.model('Reading', readingSchema);
