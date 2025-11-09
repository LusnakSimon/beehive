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
    
    // JWT can have user data directly or nested in 'user' field
    const userData = decoded.user || decoded;
    
    return { 
      authenticated: true, 
      user: {
        id: userData.id,
        email: userData.email,
        role: userData.role || 'user'
      }
    };
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

    // POST /api/users/me/hives - Create new hive for current user
    if (basePath === '/me/hives' && method === 'POST') {
      if (!auth.authenticated) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { name, location, color, coordinates, visibility } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Hive name required' });
      }

      // Generate unique hive ID
      const allUsers = await User.find({}, 'ownedHives');
      const allHives = allUsers.flatMap(u => u.ownedHives || []);
      const hiveNumbers = allHives
        .map(h => {
          const hiveId = typeof h === 'string' ? h : h?.id;
          if (!hiveId || typeof hiveId !== 'string') return NaN;
          return parseInt(hiveId.replace('HIVE-', ''));
        })
        .filter(n => !isNaN(n));
      const maxNumber = hiveNumbers.length > 0 ? Math.max(...hiveNumbers) : 0;
      const newHiveId = `HIVE-${String(maxNumber + 1).padStart(3, '0')}`;

      // Add hive to user
      const user = await User.findById(auth.user.id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const newHive = {
        id: newHiveId,
        name: name,
        location: location || '',
        color: color || '#fbbf24',
        visibility: visibility || 'private'
      };

      // Only add coordinates if they are valid
      if (coordinates && coordinates.lat != null && coordinates.lng != null) {
        newHive.coordinates = coordinates;
      }

      console.log('🐝 Creating new hive:', JSON.stringify(newHive, null, 2));

      user.ownedHives.push(newHive);
      await user.save();

      // Create new JWT token with updated hives
      const secret = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET;
      const newToken = jwt.sign(
        {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          ownedHives: user.ownedHives
        },
        secret,
        { expiresIn: '30d' }
      );

      // Update cookie
      res.setHeader('Set-Cookie', `auth-token=${newToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`);

      return res.json({
        success: true,
        message: 'Hive created successfully',
        hive: newHive,
        refreshRequired: true
      });
    }

    // DELETE /api/users/me/hives/:hiveId - Remove hive from current user
    if (basePath.match(/^\/me\/hives\/[^/]+$/) && method === 'DELETE') {
      if (!auth.authenticated) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const hiveId = basePath.split('/').pop();
      
      const user = await User.findById(auth.user.id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (user.ownedHives.length === 1) {
        return res.status(400).json({ error: 'Cannot delete last hive' });
      }

      user.ownedHives = user.ownedHives.filter(h => {
        const hId = typeof h === 'string' ? h : h?.id;
        return hId !== hiveId;
      });
      await user.save();

      // Create new JWT token with updated hives
      const secret = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET;
      const newToken = jwt.sign(
        {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          ownedHives: user.ownedHives
        },
        secret,
        { expiresIn: '30d' }
      );

      // Update cookie
      res.setHeader('Set-Cookie', `auth-token=${newToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`);

      return res.json({
        success: true,
        message: 'Hive removed successfully',
        refreshRequired: true
      });
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

      // Check if user already has this hive (handle both formats)
      const hasHive = user.ownedHives.some(h => {
        const hId = typeof h === 'string' ? h : h?.id;
        return hId === hiveId;
      });

      if (!hasHive) {
        // Add as object with default metadata
        user.ownedHives.push({
          id: hiveId,
          name: `Úľ ${hiveId.replace('HIVE-', '')}`,
          location: '',
          color: '#fbbf24'
        });
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

      user.ownedHives = user.ownedHives.filter(h => {
        const hId = typeof h === 'string' ? h : h?.id;
        return hId !== hiveId;
      });
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

    // GET /api/users/hives/map - Get all hives for map view
    if (basePath === '/hives/map' && method === 'GET') {
      if (!auth.authenticated) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Get all users with their hives
      const users = await User.find({}, 'name ownedHives');
      
      const allHives = [];
      
      users.forEach(user => {
        if (user.ownedHives && user.ownedHives.length > 0) {
          user.ownedHives.forEach(hive => {
            // Only include hives with coordinates
            if (hive.coordinates && hive.coordinates.lat && hive.coordinates.lng) {
              // Check visibility: show if public OR if it belongs to current user
              const isOwner = user._id.toString() === auth.user.id;
              if (hive.visibility === 'public' || isOwner) {
                allHives.push({
                  id: hive.id,
                  name: hive.name,
                  location: hive.location,
                  color: hive.color,
                  coordinates: hive.coordinates,
                  visibility: hive.visibility,
                  owner: {
                    id: user._id,
                    name: isOwner ? user.name : (hive.visibility === 'public' ? user.name : 'Anonymous')
                  },
                  isOwner: isOwner
                });
              }
            } else if (user._id.toString() === auth.user.id) {
              console.log(`⚠️ User's hive "${hive.name}" (${hive.id}) has no valid coordinates:`, hive.coordinates);
            }
          });
        }
      });

      console.log(`📍 Map API returning ${allHives.length} hives (user: ${auth.user.email})`);

      return res.json({
        success: true,
        hives: allHives
      });
    }

    // PATCH /api/users/me/hives/:hiveId - Update hive details
    if (basePath.match(/^\/me\/hives\/[^/]+$/) && method === 'PATCH') {
      if (!auth.authenticated) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const hiveId = basePath.split('/').pop();
      const updates = req.body;

      const user = await User.findById(auth.user.id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const hiveIndex = user.ownedHives.findIndex(h => {
        const hId = typeof h === 'string' ? h : h.id;
        return hId === hiveId;
      });

      if (hiveIndex === -1) {
        return res.status(404).json({ error: 'Hive not found' });
      }

      // Update hive properties
      if (updates.name) user.ownedHives[hiveIndex].name = updates.name;
      if (updates.location !== undefined) user.ownedHives[hiveIndex].location = updates.location;
      if (updates.color) user.ownedHives[hiveIndex].color = updates.color;
      
      // Only update coordinates if they are valid (have lat and lng)
      if (updates.coordinates && updates.coordinates.lat != null && updates.coordinates.lng != null) {
        user.ownedHives[hiveIndex].coordinates = updates.coordinates;
      } else if (updates.coordinates === null) {
        // Allow explicit removal of coordinates
        delete user.ownedHives[hiveIndex].coordinates;
      }
      
      if (updates.visibility !== undefined) user.ownedHives[hiveIndex].visibility = updates.visibility;
      
      console.log('✏️ Updated hive:', JSON.stringify(user.ownedHives[hiveIndex], null, 2));
      
      await user.save();      // Create new JWT token with updated hives
      const secret = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET;
      const newToken = jwt.sign(
        {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          ownedHives: user.ownedHives
        },
        secret,
        { expiresIn: '30d' }
      );

      // Update cookie
      res.setHeader('Set-Cookie', `auth-token=${newToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`);

      return res.json({
        success: true,
        message: 'Hive updated successfully',
        hive: user.ownedHives[hiveIndex],
        refreshRequired: true
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
    
    // DELETE /api/users/:userId - Delete user (admin only)
    if (basePath.match(/^\/[^/]+$/) && method === 'DELETE') {
      const userId = basePath.substring(1);
      
      // Verify admin role
      const token = req.headers.cookie?.split('auth-token=')[1]?.split(';')[0];
      if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const auth = jwt.verify(token, process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET);
      
      if (auth.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }
      
      // Don't allow deleting yourself
      if (userId === auth.user.id) {
        return res.status(400).json({ error: 'Cannot delete your own account' });
      }
      
      const user = await User.findByIdAndDelete(userId);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      return res.json({ 
        success: true, 
        message: 'User deleted successfully',
        deletedUser: {
          id: user._id,
          email: user.email,
          name: user.name
        }
      });
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
