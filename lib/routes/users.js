const mongoose = require('mongoose');
const User = require('../models/User.js');
const jwt = require('jsonwebtoken');

// Verify JWT token from cookie
function verifyAuth(req) {
  const token = req.headers.cookie?.split('auth-token=')[1]?.split(';')[0];
  
  if (!token) {
    return { authenticated: false, user: null };
  }

  try {
    const secret = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET;
    const decoded = jwt.verify(token, secret);
    return { authenticated: true, user: decoded };
  } catch (err) {
    return { authenticated: false, user: null };
  }
}

module.exports = async (req, res) => {
  // Normalize path - remove /api/users prefix if present
  let path = req.url || '';
  if (path.startsWith('/api/users')) {
    path = path.replace('/api/users', '');
  }
  
  // Ensure path starts with / if not empty
  if (path && !path.startsWith('/')) {
    path = '/' + path;
  }
  
  // Extract base path without query string
  const basePath = path.split('?')[0];
  const method = req.method;
  const auth = verifyAuth(req);

  try {
    // GET /api/users - List all users (admin only)
    if (basePath === '' || basePath === '/' && method === 'GET') {
      if (!auth.authenticated || auth.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const users = await User.find()
        .select('name email image ownedHives role createdAt lastLogin')
        .sort({ createdAt: -1 });

      return res.json(users);
    }

    // POST /api/users/:userId/hives - Assign hive to user (admin only)
    if (basePath.match(/^\/[^/]+\/hives$/) && method === 'POST') {
      if (!auth.authenticated || auth.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const userId = basePath.split('/')[1];
      const { hiveId } = req.body;

      if (!hiveId) {
        return res.status(400).json({ error: 'Hive ID required' });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (!user.ownedHives.includes(hiveId)) {
        user.ownedHives.push(hiveId);
        await user.save();
      }

      return res.json({
        success: true,
        message: 'Hive assigned successfully',
        user: {
          id: user._id,
          name: user.name,
          ownedHives: user.ownedHives
        }
      });
    }

    // DELETE /api/users/:userId/hives/:hiveId - Remove hive from user (admin only)
    if (basePath.match(/^\/[^/]+\/hives\/[^/]+$/) && method === 'DELETE') {
      if (!auth.authenticated || auth.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const [, userId, , hiveId] = basePath.split('/');

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      user.ownedHives = user.ownedHives.filter(h => h !== hiveId);
      await user.save();

      return res.json({
        success: true,
        message: 'Hive removed successfully',
        user: {
          id: user._id,
          name: user.name,
          ownedHives: user.ownedHives
        }
      });
    }

    // PATCH /api/users/:userId/role - Update user role (admin only)
    if (basePath.match(/^\/[^/]+\/role$/) && method === 'PATCH') {
      if (!auth.authenticated || auth.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const userId = basePath.split('/')[1];
      const { role } = req.body;

      if (!role || !['user', 'admin'].includes(role)) {
        return res.status(400).json({ error: 'Valid role required (user or admin)' });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      user.role = role;
      await user.save();

      return res.json({
        success: true,
        message: 'User role updated',
        user: {
          id: user._id,
          name: user.name,
          role: user.role
        }
      });
    }

    // GET /api/users/me - Get current user info
    if (path === '/me' && method === 'GET') {
      if (!auth.authenticated) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const user = await User.findOne({ email: auth.user.email })
        .select('name email image ownedHives role');

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.json(user);
    }

    // Route not found
    res.status(404).json({ error: 'Users endpoint not found' });
  } catch (error) {
    console.error('Users route error:', error);
    res.status(500).json({
      error: 'Failed to process users request',
      message: error.message
    });
  }
};
