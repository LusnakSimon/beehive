import express from 'express'
import mongoose from 'mongoose'

const router = express.Router()

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
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
})

inspectionSchema.index({ timestamp: -1 })
inspectionSchema.index({ hiveId: 1, timestamp: -1 })

const Inspection = mongoose.model('Inspection', inspectionSchema)

// POST /api/inspection/save - Uložiť novú inšpekciu
router.post('/save', async (req, res) => {
  try {
    const { checklist, notes, timestamp } = req.body

    const inspection = new Inspection({
      checklist,
      notes: notes || '',
      timestamp: timestamp || new Date()
    })

    await inspection.save()

    console.log('Inspection saved:', {
      timestamp: inspection.timestamp,
      checklist: inspection.checklist
    })

    res.status(201).json({
      success: true,
      message: 'Inšpekcia úspešne uložená',
      inspection: {
        id: inspection._id,
        timestamp: inspection.timestamp
      }
    })
  } catch (error) {
    console.error('Error saving inspection:', error)
    res.status(500).json({
      error: 'Failed to save inspection',
      message: error.message
    })
  }
})

// GET /api/inspection/history?limit=10 - História inšpekcií
router.get('/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10
    const hiveId = req.query.hiveId || 'HIVE-001'

    const inspections = await Inspection.find({ hiveId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .select('-__v -hiveId')

    res.json(inspections)
  } catch (error) {
    console.error('Error fetching inspection history:', error)
    res.status(500).json({ error: 'Failed to fetch history' })
  }
})

// GET /api/inspection/stats - Štatistiky inšpekcií
router.get('/stats', async (req, res) => {
  try {
    const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const stats = await Inspection.aggregate([
      { $match: { timestamp: { $gte: last30Days } } },
      {
        $group: {
          _id: null,
          totalInspections: { $sum: 1 },
          queenSeenCount: {
            $sum: { $cond: ['$checklist.queenSeen', 1, 0] }
          },
          eggsFoundCount: {
            $sum: { $cond: ['$checklist.eggs', 1, 0] }
          },
          pollenCount: {
            $sum: { $cond: ['$checklist.pollen', 1, 0] }
          },
          inspectionNeededCount: {
            $sum: { $cond: ['$checklist.inspectionNeeded', 1, 0] }
          }
        }
      }
    ])

    const result = stats[0] || {
      totalInspections: 0,
      queenSeenCount: 0,
      eggsFoundCount: 0,
      pollenCount: 0,
      inspectionNeededCount: 0
    }

    res.json(result)
  } catch (error) {
    console.error('Error calculating inspection stats:', error)
    res.status(500).json({ error: 'Failed to calculate stats' })
  }
})

// GET /api/inspection/latest - Posledná inšpekcia
router.get('/latest', async (req, res) => {
  try {
    const latest = await Inspection.findOne()
      .sort({ timestamp: -1 })
      .select('-__v')

    if (!latest) {
      return res.json({ message: 'No inspections found' })
    }

    res.json(latest)
  } catch (error) {
    console.error('Error fetching latest inspection:', error)
    res.status(500).json({ error: 'Failed to fetch latest inspection' })
  }
})

export default router
