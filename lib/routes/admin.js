const Reading = require('../models/Reading.js');
const User = require('../models/User.js');
const { requireAdmin } = require('../utils/auth.js');
const { isValidHiveId } = require('../utils/validation.js');

/**
 * Admin routes handler - all routes require admin authentication
 */
module.exports = async (req, res) => {
  // All admin routes require admin authentication
  const user = requireAdmin(req, res);
  if (!user) return; // Response already sent
  
  const method = req.method;
  
  // Normalize path
  let path = req.url || '';
  if (path.startsWith('/api/admin')) {
    path = path.replace('/api/admin', '');
  }
  if (path && !path.startsWith('/')) {
    path = '/' + path;
  }
  const basePath = path.split('?')[0];
  
  try {
    // Parse query params
    const url = new URL(req.url, `http://${req.headers.host}`);
    
    /**
     * DELETE /api/admin/readings?hiveId=HIVE-001&olderThan=2024-11-06
     * Clear old readings for a specific hive
     */
    if (basePath === '/readings' && method === 'DELETE') {
      const hiveId = url.searchParams.get('hiveId');
      const olderThan = url.searchParams.get('olderThan');
      const all = url.searchParams.get('all');
      
      let filter = {};
      
      if (all === 'true') {
        // Delete ALL readings (use with caution!)
        filter = {};
      } else if (hiveId && olderThan) {
        // Delete specific hive older than date
        filter = {
          hiveId,
          timestamp: { $lt: new Date(olderThan) }
        };
      } else if (hiveId) {
        // Delete ALL readings for specific hive
        if (!isValidHiveId(hiveId)) {
          return res.status(400).json({ error: 'Invalid hive ID format' });
        }
        filter = { hiveId };
      } else if (olderThan) {
        // Delete ALL readings older than date
        const date = new Date(olderThan);
        if (isNaN(date.getTime())) {
          return res.status(400).json({ error: 'Invalid date format' });
        }
        filter = {
          timestamp: { $lt: date }
        };
      } else {
        return res.status(400).json({ 
          error: 'Provide at least one parameter: hiveId, olderThan, or all=true' 
        });
      }
      
      const result = await Reading.deleteMany(filter);
      
      return res.json({
        success: true,
        message: `Deleted ${result.deletedCount} readings`,
        deletedCount: result.deletedCount,
        filter
      });
    }

    /**
     * GET /api/admin/stats
     * Get database statistics
     */
    if (basePath === '/stats' && method === 'GET') {
      const totalReadings = await Reading.countDocuments();
      const totalUsers = await User.countDocuments();
      const hives = await Reading.distinct('hiveId');
      
      const hiveStats = await Promise.all(
        hives.map(async (hiveId) => {
          const count = await Reading.countDocuments({ hiveId });
          const latest = await Reading.findOne({ hiveId }).sort({ timestamp: -1 });
          const oldest = await Reading.findOne({ hiveId }).sort({ timestamp: 1 });
          
          return {
            hiveId,
            count,
            latestReading: latest?.timestamp,
            oldestReading: oldest?.timestamp
          };
        })
      );
      
      return res.json({
        totalReadings,
        totalUsers,
        totalHives: hives.length,
        hives: hiveStats
      });
    }
    
    /**
     * GET /api/admin/users
     * Get all users (admin only)
     */
    if (basePath === '/users' && method === 'GET') {
      const users = await User.find()
        .select('name email image role ownedHives createdAt lastLogin')
        .sort({ createdAt: -1 });
      
      return res.json({
        success: true,
        count: users.length,
        users
      });
    }
    
    /**
     * PATCH /api/admin/users/:id/role
     * Update user role
     */
    if (basePath.match(/^\/users\/[a-f0-9]{24}\/role$/) && method === 'PATCH') {
      const userId = basePath.split('/')[2];
      const { role } = req.body || {};
      
      if (!role || !['user', 'admin'].includes(role)) {
        return res.status(400).json({ error: 'Valid role required (user or admin)' });
      }
      
      // Prevent admin from demoting themselves
      if (userId === user.id && role !== 'admin') {
        return res.status(400).json({ error: 'Cannot demote yourself' });
      }
      
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { role },
        { new: true }
      ).select('name email role');
      
      if (!updatedUser) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      return res.json({
        success: true,
        message: `User role updated to ${role}`,
        user: updatedUser
      });
    }
    
    // Route not found
    return res.status(404).json({ error: 'Admin endpoint not found' });
    
  } catch (error) {
    console.error('Admin route error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
