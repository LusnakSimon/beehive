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

const Inspection = mongoose.models.Inspection || mongoose.model('Inspection', inspectionSchema);

module.exports = async (req, res) => {
  const path = req.url || '';
  const method = req.method;

  try {
    // POST /api/inspection/save
    if (path === '/save' && method === 'POST') {
      // Vercel auto-parses body for JSON requests
      const body = req.body || {};
      const { checklist, notes, timestamp, hiveId } = body;
      
      if (!checklist) {
        return res.status(400).json({ error: 'Checklist is required' });
      }
      
      const inspection = new Inspection({
        checklist,
        notes: notes || '',
        hiveId: hiveId || 'HIVE-001',
        timestamp: timestamp || new Date()
      });

      await inspection.save();
      
      console.log('Inspection saved:', {
        id: inspection._id,
        timestamp: inspection.timestamp,
        hiveId: inspection.hiveId
      });

      return res.status(201).json({
        success: true,
        message: 'Inšpekcia úspešne uložená',
        inspection: {
          id: inspection._id,
          timestamp: inspection.timestamp
        }
      });
    }

    // GET /api/inspection/history
    if (path.startsWith('/history') && method === 'GET') {
      // Parse query parameters manually since req.url might not be a full URL
      const queryIndex = path.indexOf('?');
      const queryString = queryIndex > -1 ? path.substring(queryIndex + 1) : '';
      const searchParams = new URLSearchParams(queryString);
      
      const limit = parseInt(searchParams.get('limit')) || 10;
      const hiveId = searchParams.get('hiveId') || 'HIVE-001';

      const inspections = await Inspection.find({ hiveId })
        .sort({ timestamp: -1 })
        .limit(limit)
        .select('-__v');

      return res.json(inspections);
    }

    // GET /api/inspection/stats
    if (path === '/stats' && method === 'GET') {
      const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

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
      ]);

      const result = stats[0] || {
        totalInspections: 0,
        queenSeenCount: 0,
        eggsFoundCount: 0,
        pollenCount: 0,
        inspectionNeededCount: 0
      };

      return res.json(result);
    }

    // GET /api/inspection/latest
    if (path === '/latest' && method === 'GET') {
      const latest = await Inspection.findOne()
        .sort({ timestamp: -1 })
        .select('-__v');

      if (!latest) {
        return res.json({ message: 'No inspections found' });
      }

      return res.json(latest);
    }

    // Route not found
    res.status(404).json({ error: 'Inspection endpoint not found' });
  } catch (error) {
    console.error('Inspection route error:', error);
    res.status(500).json({
      error: 'Failed to process inspection request',
      message: error.message
    });
  }
};
