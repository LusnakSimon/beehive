const User = require('../../lib/models/User');
const { authenticateUser, requireAdmin } = require('../middleware/auth');

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    // Get user's hives - requires authentication
    return getUserHives(req, res);
  } else if (req.method === 'POST') {
    // Assign hive to user - requires authentication
    return assignHive(req, res);
  } else if (req.method === 'DELETE') {
    // Remove hive from user - requires authentication
    return removeHive(req, res);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
};

// GET /api/user/hives - Get all hives owned by the user
const getUserHives = async (req, res) => {
  try {
    await authenticateUser(req, res, async () => {
      const user = await User.findById(req.user.id);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.json({
        ownedHives: user.ownedHives,
        role: user.role
      });
    });
  } catch (error) {
    console.error('Error fetching user hives:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /api/user/hives - Assign hive to user
const assignHive = async (req, res) => {
  try {
    await authenticateUser(req, res, async () => {
      const { hiveId, userId } = req.body;

      if (!hiveId) {
        return res.status(400).json({ error: 'HiveId is required' });
      }

      // Regular users can only assign hives to themselves
      // Admins can assign hives to any user
      const targetUserId = req.user.role === 'admin' && userId ? userId : req.user.id;

      const user = await User.findById(targetUserId);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Check if hive is already assigned
      if (user.ownedHives.includes(hiveId)) {
        return res.status(400).json({ error: 'Hive already assigned to this user' });
      }

      // Add hive to user's owned hives
      user.ownedHives.push(hiveId);
      await user.save();

      return res.json({
        success: true,
        message: `Hive ${hiveId} assigned to user`,
        ownedHives: user.ownedHives
      });
    });
  } catch (error) {
    console.error('Error assigning hive:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// DELETE /api/user/hives - Remove hive from user
const removeHive = async (req, res) => {
  try {
    await authenticateUser(req, res, async () => {
      const { hiveId, userId } = req.query;

      if (!hiveId) {
        return res.status(400).json({ error: 'HiveId is required' });
      }

      // Regular users can only remove their own hives
      // Admins can remove hives from any user
      const targetUserId = req.user.role === 'admin' && userId ? userId : req.user.id;

      const user = await User.findById(targetUserId);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Remove hive from user's owned hives
      user.ownedHives = user.ownedHives.filter(id => id !== hiveId);
      await user.save();

      return res.json({
        success: true,
        message: `Hive ${hiveId} removed from user`,
        ownedHives: user.ownedHives
      });
    });
  } catch (error) {
    console.error('Error removing hive:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
