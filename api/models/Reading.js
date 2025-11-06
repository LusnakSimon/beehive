import mongoose from 'mongoose'

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
})

// Index pre rýchle vyhľadávanie
readingSchema.index({ timestamp: -1 })
readingSchema.index({ hiveId: 1, timestamp: -1 })

export default mongoose.model('Reading', readingSchema)
