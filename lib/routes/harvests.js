const Harvest = require('../models/Harvest.js');
const { verifyAuth } = require('../utils/auth.js');

module.exports = async function handler(req, res) {
  const auth = verifyAuth(req);
  const { method } = req;
  
  if (!auth.authenticated) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Parse URL path
  let urlPath = req.url.split('?')[0];
  if (urlPath.startsWith('/api/harvests')) {
    urlPath = urlPath.replace('/api/harvests', '');
  }
  const pathParts = urlPath.split('/').filter(Boolean);

  // GET /api/harvests - Get all harvests for user (with optional hiveId filter)
  if (pathParts.length === 0 && method === 'GET') {
    try {
      const { hiveId, limit = 50, year } = req.query;
      
      const query = { userId: auth.user.id };
      if (hiveId) query.hiveId = hiveId;
      
      if (year) {
        const startDate = new Date(parseInt(year), 0, 1);
        const endDate = new Date(parseInt(year), 11, 31, 23, 59, 59);
        query.harvestDate = { $gte: startDate, $lte: endDate };
      }

      const harvests = await Harvest.find(query)
        .sort({ harvestDate: -1 })
        .limit(parseInt(limit));

      return res.json({
        success: true,
        harvests
      });
    } catch (error) {
      console.error('Error fetching harvests:', error);
      return res.status(500).json({ error: 'Failed to fetch harvests' });
    }
  }

  // GET /api/harvests/stats - Get harvest statistics
  if (pathParts[0] === 'stats' && method === 'GET') {
    try {
      const { hiveId, year } = req.query;
      const currentYear = year ? parseInt(year) : new Date().getFullYear();
      
      if (hiveId) {
        // Stats for specific hive
        const stats = await Harvest.getHiveStats(hiveId, currentYear);
        return res.json({ success: true, stats, year: currentYear });
      } else {
        // Stats for all user's hives
        const summary = await Harvest.getUserYearlySummary(auth.user.id, currentYear);
        return res.json({ success: true, summary, year: currentYear });
      }
    } catch (error) {
      console.error('Error fetching harvest stats:', error);
      return res.status(500).json({ error: 'Failed to fetch harvest stats' });
    }
  }

  // POST /api/harvests - Create new harvest record
  if (pathParts.length === 0 && method === 'POST') {
    try {
      const { hiveId, amount, unit, honeyType, quality, moistureContent, color, framesHarvested, weather, notes, harvestDate } = req.body;

      if (!hiveId) {
        return res.status(400).json({ error: 'Hive ID is required' });
      }
      if (amount === undefined || amount === null || amount < 0) {
        return res.status(400).json({ error: 'Valid harvest amount is required' });
      }

      const harvest = new Harvest({
        hiveId,
        userId: auth.user.id,
        amount: parseFloat(amount),
        unit: unit || 'kg',
        honeyType: honeyType || 'mixed',
        quality: quality || 'good',
        moistureContent: moistureContent ? parseFloat(moistureContent) : null,
        color: color || null,
        framesHarvested: framesHarvested ? parseInt(framesHarvested) : null,
        weather: weather || '',
        notes: notes || '',
        harvestDate: harvestDate ? new Date(harvestDate) : new Date()
      });

      await harvest.save();

      return res.json({
        success: true,
        message: 'Harvest recorded successfully',
        harvest
      });
    } catch (error) {
      console.error('Error creating harvest:', error);
      return res.status(500).json({ error: 'Failed to create harvest record' });
    }
  }

  // GET /api/harvests/:id - Get single harvest
  if (pathParts.length === 1 && method === 'GET') {
    try {
      const harvestId = pathParts[0];
      const harvest = await Harvest.findById(harvestId);
      
      if (!harvest) {
        return res.status(404).json({ error: 'Harvest not found' });
      }
      
      // Verify ownership
      if (harvest.userId !== auth.user.id) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      return res.json({ success: true, harvest });
    } catch (error) {
      console.error('Error fetching harvest:', error);
      return res.status(500).json({ error: 'Failed to fetch harvest' });
    }
  }

  // PATCH /api/harvests/:id - Update harvest
  if (pathParts.length === 1 && method === 'PATCH') {
    try {
      const harvestId = pathParts[0];
      const harvest = await Harvest.findById(harvestId);
      
      if (!harvest) {
        return res.status(404).json({ error: 'Harvest not found' });
      }
      
      // Verify ownership
      if (harvest.userId !== auth.user.id) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      const updates = req.body;
      const allowedUpdates = ['amount', 'unit', 'honeyType', 'quality', 'moistureContent', 'color', 'framesHarvested', 'weather', 'notes', 'harvestDate'];
      
      allowedUpdates.forEach(field => {
        if (updates[field] !== undefined) {
          if (field === 'harvestDate') {
            harvest[field] = new Date(updates[field]);
          } else if (field === 'amount' || field === 'moistureContent') {
            harvest[field] = parseFloat(updates[field]);
          } else if (field === 'framesHarvested') {
            harvest[field] = parseInt(updates[field]);
          } else {
            harvest[field] = updates[field];
          }
        }
      });

      await harvest.save();

      return res.json({
        success: true,
        message: 'Harvest updated successfully',
        harvest
      });
    } catch (error) {
      console.error('Error updating harvest:', error);
      return res.status(500).json({ error: 'Failed to update harvest' });
    }
  }

  // DELETE /api/harvests/:id - Delete harvest
  if (pathParts.length === 1 && method === 'DELETE') {
    try {
      const harvestId = pathParts[0];
      const harvest = await Harvest.findById(harvestId);
      
      if (!harvest) {
        return res.status(404).json({ error: 'Harvest not found' });
      }
      
      // Verify ownership
      if (harvest.userId !== auth.user.id) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      await Harvest.findByIdAndDelete(harvestId);

      return res.json({
        success: true,
        message: 'Harvest deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting harvest:', error);
      return res.status(500).json({ error: 'Failed to delete harvest' });
    }
  }

  return res.status(404).json({ error: 'Not found' });
};
