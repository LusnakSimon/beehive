const mongoose = require('mongoose');
const Inspection = require('../models/Inspection.js');
const { verifyAuth, userOwnsHive } = require('../utils/auth.js');
const { validateInspectionChecklist, sanitizeString, isValidObjectId } = require('../utils/validation.js');

module.exports = async (req, res) => {
  // All inspection routes require authentication
  const auth = verifyAuth(req);
  if (!auth.authenticated) {
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Authentication required' 
    });
  }

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

  try {
    // POST /api/inspection/save
    if (basePath === '/save' && method === 'POST') {
      const body = req.body || {};
      const { checklist, notes, timestamp, hiveId } = body;
      
      // Validate checklist
      const validation = validateInspectionChecklist(checklist);
      if (!validation.valid) {
        return res.status(400).json({ 
          error: 'Validation failed',
          messages: validation.errors 
        });
      }
      
      const targetHiveId = hiveId || 'HIVE-001';
      
      // Verify user owns this hive
      if (!userOwnsHive(auth.user, targetHiveId)) {
        return res.status(403).json({ 
          error: 'Forbidden',
          message: 'You do not have access to this hive' 
        });
      }
      
      const inspection = new Inspection({
        checklist,
        notes: sanitizeString(notes || '', 2000),
        hiveId: targetHiveId,
        userId: auth.user.id,
        timestamp: timestamp ? new Date(timestamp) : new Date()
      });

      await inspection.save();

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
      const limit = Math.min(parseInt(url.searchParams.get('limit')) || 10, 100);
      const hiveId = url.searchParams.get('hiveId') || 'HIVE-001';
      
      // Verify user owns this hive
      if (!userOwnsHive(auth.user, hiveId)) {
        return res.status(403).json({ 
          error: 'Forbidden',
          message: 'You do not have access to this hive' 
        });
      }

      const inspections = await Inspection.find({ hiveId })
        .sort({ timestamp: -1 })
        .limit(limit)
        .select('-__v');

      return res.json(inspections);
    }

    // GET /api/inspection/stats
    if (basePath === '/stats' && method === 'GET') {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const hiveId = url.searchParams.get('hiveId') || 'HIVE-001';
      
      // Verify user owns this hive
      if (!userOwnsHive(auth.user, hiveId)) {
        return res.status(403).json({ 
          error: 'Forbidden',
          message: 'You do not have access to this hive' 
        });
      }
      
      const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const stats = await Inspection.aggregate([
        { $match: { hiveId, timestamp: { $gte: last30Days } } },
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
      const url = new URL(req.url, `http://${req.headers.host}`);
      const hiveId = url.searchParams.get('hiveId') || 'HIVE-001';
      
      // Verify user owns this hive
      if (!userOwnsHive(auth.user, hiveId)) {
        return res.status(403).json({ 
          error: 'Forbidden',
          message: 'You do not have access to this hive' 
        });
      }
      
      const latest = await Inspection.findOne({ hiveId })
        .sort({ timestamp: -1 })
        .select('-__v');

      if (!latest) {
        return res.json({ message: 'No inspections found' });
      }

      return res.json(latest);
    }

    // PUT /api/inspection/:id - Update inspection
    if (basePath.match(/^\/[a-f0-9]{24}$/) && method === 'PUT') {
      const inspectionId = basePath.substring(1);
      
      if (!isValidObjectId(inspectionId)) {
        return res.status(400).json({ error: 'Invalid inspection ID' });
      }
      
      // Find inspection first to check ownership
      const existingInspection = await Inspection.findById(inspectionId);
      if (!existingInspection) {
        return res.status(404).json({ error: 'Inspection not found' });
      }
      
      // Verify user owns the hive this inspection belongs to
      if (!userOwnsHive(auth.user, existingInspection.hiveId)) {
        return res.status(403).json({ 
          error: 'Forbidden',
          message: 'You do not have access to this inspection' 
        });
      }
      
      const body = req.body || {};
      const { checklist, notes } = body;
      
      // Validate checklist if provided
      if (checklist) {
        const validation = validateInspectionChecklist(checklist);
        if (!validation.valid) {
          return res.status(400).json({ 
            error: 'Validation failed',
            messages: validation.errors 
          });
        }
      }

      const inspection = await Inspection.findByIdAndUpdate(
        inspectionId,
        { 
          checklist: checklist || existingInspection.checklist,
          notes: notes !== undefined ? sanitizeString(notes, 2000) : existingInspection.notes
        },
        { new: true, runValidators: true }
      );

      return res.json({
        success: true,
        message: 'Inšpekcia úspešne aktualizovaná',
        inspection
      });
    }

    // DELETE /api/inspection/:id - Delete inspection
    if (basePath.match(/^\/[a-f0-9]{24}$/) && method === 'DELETE') {
      const inspectionId = basePath.substring(1);
      
      if (!isValidObjectId(inspectionId)) {
        return res.status(400).json({ error: 'Invalid inspection ID' });
      }
      
      // Find inspection first to check ownership
      const existingInspection = await Inspection.findById(inspectionId);
      if (!existingInspection) {
        return res.status(404).json({ error: 'Inspection not found' });
      }
      
      // Verify user owns the hive this inspection belongs to
      if (!userOwnsHive(auth.user, existingInspection.hiveId)) {
        return res.status(403).json({ 
          error: 'Forbidden',
          message: 'You do not have access to this inspection' 
        });
      }
      
      await Inspection.findByIdAndDelete(inspectionId);

      return res.json({
        success: true,
        message: 'Inšpekcia úspešne vymazaná'
      });
    }

    // Route not found
    res.status(404).json({ error: 'Inspection endpoint not found' });
  } catch (error) {
    console.error('Inspection route error:', error);
    res.status(500).json({
      error: 'Failed to process inspection request',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};
