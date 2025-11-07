const mongoose = require('mongoose');
const Inspection = require('../models/Inspection.js');

module.exports = async (req, res) => {
  // Debug logging
  console.log('Inspection route called:', {
    url: req.url,
    method: req.method,
    body: req.body
  });
  
  // In Vercel catch-all, URL might be /save or /api/inspection/save or just save
  let path = req.url || '';
  
  // Normalize path - remove /api/inspection prefix if present
  if (path.startsWith('/api/inspection')) {
    path = path.replace('/api/inspection', '');
  }
  
  // Ensure path starts with /
  if (path && !path.startsWith('/')) {
    path = '/' + path;
  }
  
  // Extract base path without query string
  const basePath = path.split('?')[0];
  const method = req.method;
  
  console.log('Normalized path:', { original: req.url, basePath, method });

  try {
    // POST /api/inspection/save
    if (basePath === '/save' && method === 'POST') {
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
    if (basePath === '/history' && method === 'GET') {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const limit = parseInt(url.searchParams.get('limit')) || 10;
      const hiveId = url.searchParams.get('hiveId') || 'HIVE-001';

      const inspections = await Inspection.find({ hiveId })
        .sort({ timestamp: -1 })
        .limit(limit)
        .select('-__v');

      return res.json(inspections);
    }

    // GET /api/inspection/stats
    if (basePath === '/stats' && method === 'GET') {
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
    if (basePath === '/latest' && method === 'GET') {
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
