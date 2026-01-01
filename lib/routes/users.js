const mongoose = require('mongoose');
const User = require('../models/User.js');
const jwt = require('jsonwebtoken');
const { verifyAuth } = require('../utils/auth.js');
const { escapeRegex, isValidObjectId, sanitizeString } = require('../utils/validation.js');
const { rateLimit } = require('../utils/rateLimit.js');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Helper function to upload base64 image to Cloudinary
async function uploadBase64ToCloudinary(base64String, folder = 'beehive/hives') {
  const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;
  const useCloudinary = isServerless && process.env.CLOUDINARY_CLOUD_NAME;
  
  if (!useCloudinary) {
    // In local dev, just return the base64 (not ideal but works)
    return base64String;
  }
  
  // Check if it's a data URL
  if (!base64String.startsWith('data:image/')) {
    // Already a URL, return as-is
    return base64String;
  }
  
  try {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    });
    
    const result = await cloudinary.uploader.upload(base64String, {
      folder: folder,
      resource_type: 'image',
      transformation: [
        { width: 800, height: 600, crop: 'limit' }, // Limit max dimensions
        { quality: 'auto:good' } // Optimize quality
      ]
    });
    
    return result.secure_url;
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    // Return null on error - don't save broken data
    return null;
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

      // Setup multer/cloudinary storage similar to other upload endpoints
      const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;
      const useCloudinary = isServerless && process.env.CLOUDINARY_CLOUD_NAME;

      // Configure Cloudinary only if needed
      if (useCloudinary) {
        cloudinary.config({
          cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
          api_key: process.env.CLOUDINARY_API_KEY,
          api_secret: process.env.CLOUDINARY_API_SECRET
        });
      }

      let storage;
      if (useCloudinary) {
        storage = new CloudinaryStorage({
          cloudinary: cloudinary,
          params: {
            folder: 'beehive/hives',
            allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
            resource_type: 'image'
          }
        });
      } else {
        storage = multer.diskStorage({
          destination: async function (req, file, cb) {
            const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'hives');
            try { await fs.mkdir(uploadDir, { recursive: true }); cb(null, uploadDir); } catch (e) { cb(e); }
          },
          filename: function (req, file, cb) {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const ext = path.extname(file.originalname);
            const nameWithoutExt = path.basename(file.originalname, ext);
            const safeName = nameWithoutExt.replace(/[^a-zA-Z0-9]/g, '_');
            cb(null, safeName + '-' + uniqueSuffix + ext);
          }
        });
      }

      const upload = multer({
        storage,
        limits: { fileSize: 5 * 1024 * 1024 }, // 5MB for hive images
        fileFilter: function (req, file, cb) {
          const allowed = ['image/jpeg', 'image/png', 'image/webp'];
          if (allowed.includes(file.mimetype)) cb(null, true); else cb(new Error('Invalid image type'));
        }
      });

      // If multipart/form-data, parse file first
      if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
        return new Promise((resolve) => {
          upload.single('image')(req, res, async (err) => {
            if (err instanceof multer.MulterError) {
              if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'Image too large (max 5MB)' });
              return res.status(400).json({ error: 'Upload error: ' + err.message });
            } else if (err) {
              return res.status(400).json({ error: err.message });
            }

            try {
              // Fields come as strings in multipart - parse where needed
              const body = req.body || {};
              let { name, location, color, coordinates, visibility, device } = body;
              if (!name) return res.status(400).json({ error: 'Hive name required' });

              try {
                if (typeof coordinates === 'string' && coordinates) coordinates = JSON.parse(coordinates);
              } catch (e) { coordinates = undefined; }
              try {
                if (typeof device === 'string' && device) device = JSON.parse(device);
              } catch (e) { device = undefined; }

              // Validate device similar to JSON path
              if (device) {
                const validTypes = ['manual', 'esp32-wifi', 'esp32-lorawan', 'esp32-lte'];
                if (device.type && !validTypes.includes(device.type)) {
                  return res.status(400).json({ error: 'Invalid device type' });
                }
                if (device.type === 'esp32-lorawan' && device.devEUI) {
                  if (!/^[0-9A-Fa-f]{16}$/.test(device.devEUI)) {
                    return res.status(400).json({ error: 'DevEUI must be 16 hexadecimal characters' });
                  }
                  const existingUser = await User.findOne({ 'ownedHives.device.devEUI': device.devEUI.toUpperCase() });
                  if (existingUser) {
                    return res.status(409).json({ error: 'This DevEUI is already assigned to another hive' });
                  }
                }
              }

              // Generate unique hive ID
              const allUsers = await User.find({}, 'ownedHives');
              const allHives = allUsers.flatMap(u => u.ownedHives || []);
              const hiveNumbers = allHives
                .map(h => { const hiveId = typeof h === 'string' ? h : h?.id; if (!hiveId || typeof hiveId !== 'string') return NaN; return parseInt(hiveId.replace('HIVE-', '')); })
                .filter(n => !isNaN(n));
              const maxNumber = hiveNumbers.length > 0 ? Math.max(...hiveNumbers) : 0;
              const newHiveId = `HIVE-${String(maxNumber + 1).padStart(3, '0')}`;

              const user = await User.findById(auth.user.id);
              if (!user) return res.status(404).json({ error: 'User not found' });

              const newHive = {
                id: newHiveId,
                name: name,
                location: location || '',
                color: color || '#fbbf24',
                visibility: visibility || 'private'
              };

              if (device && device.type) {
                newHive.device = { type: device.type };
                if (device.type === 'esp32-lorawan' && device.devEUI) newHive.device.devEUI = device.devEUI.toUpperCase();
              }

              if (coordinates && coordinates.lat != null && coordinates.lng != null) newHive.coordinates = coordinates;

              // Add uploaded image if present
              if (req.file) {
                if (useCloudinary) newHive.image = req.file.path; else newHive.image = `/uploads/hives/${req.file.filename}`;
              }

              user.ownedHives.push(newHive);
              await user.save();

              // Update JWT cookie
              const secret = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET;
              const newToken = jwt.sign({ id: user._id.toString(), email: user.email, name: user.name, image: user.image, role: user.role, ownedHives: user.ownedHives }, secret, { expiresIn: '30d' });
              res.setHeader('Set-Cookie', `auth-token=${newToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`);

              return resolve(res.json({ success: true, message: 'Hive created successfully', hive: newHive, refreshRequired: true }));
            } catch (error) {
              console.error('Error creating hive (multipart):', error);
              return resolve(res.status(500).json({ error: 'Failed to create hive' }));
            }
          });
        });
      }

      // Fallback JSON path (existing behavior)
      const { name, location, color, coordinates, visibility, device } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Hive name required' });
      }
      
      // Validate device if provided
      if (device) {
        const validTypes = ['manual', 'esp32-wifi', 'esp32-lorawan', 'esp32-lte'];
        if (device.type && !validTypes.includes(device.type)) {
          return res.status(400).json({ error: 'Invalid device type' });
        }
        
        // Check devEUI for LoRaWAN devices
        if (device.type === 'esp32-lorawan') {
          if (!device.devEUI) {
            return res.status(400).json({ error: 'DevEUI required for LoRaWAN devices' });
          }
          
          // Validate devEUI format (16 hex chars)
          if (!/^[0-9A-Fa-f]{16}$/.test(device.devEUI)) {
            return res.status(400).json({ error: 'DevEUI must be 16 hexadecimal characters' });
          }
          
          // Check if devEUI already exists
          const existingUser = await User.findOne({ 
            'ownedHives.device.devEUI': device.devEUI.toUpperCase() 
          });
          
          if (existingUser) {
            return res.status(409).json({ 
              error: 'This DevEUI is already assigned to another hive',
              conflictingHive: existingUser.ownedHives.find(h => 
                h.device?.devEUI === device.devEUI.toUpperCase()
              )?.id
            });
          }
        }
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

      // Handle image (base64 data URL or external URL) - upload to Cloudinary if base64
      if (req.body.image) {
        const imageUrl = await uploadBase64ToCloudinary(req.body.image);
        if (imageUrl) {
          newHive.image = imageUrl;
        }
      }

      // Add device configuration if provided
      if (device && device.type) {
        newHive.device = {
          type: device.type
        };
        
        // Add devEUI for LoRaWAN devices
        if (device.type === 'esp32-lorawan' && device.devEUI) {
          newHive.device.devEUI = device.devEUI.toUpperCase();
          newHive.device.lastSeen = null;
          newHive.device.signalStrength = null;
          newHive.device.batteryLevel = null;
        }
      }

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

    // GET /api/users/:userId/profile - Get user profile
    if (basePath.match(/^\/[^/]+\/profile$/) && method === 'GET') {
      const targetUserId = basePath.split('/')[1];
      
      try {
        const targetUser = await User.findById(targetUserId);
        
        if (!targetUser) {
          return res.status(404).json({ error: 'User not found' });
        }

        // Check if profile is public or if it's the user's own profile
        const isOwnProfile = auth.authenticated && auth.user.id === targetUserId;
        const isPublic = targetUser.profile?.isPublic !== false;

        if (!isOwnProfile && !isPublic) {
          return res.status(403).json({ error: 'This profile is private' });
        }

        // Prepare user data
        const userData = {
          id: targetUser._id,
          name: targetUser.name,
          email: isOwnProfile || targetUser.profile?.showEmail ? targetUser.email : undefined,
          image: targetUser.image,
          createdAt: targetUser.createdAt,
          profile: targetUser.profile || {},
          stats: targetUser.stats || {
            totalHives: 0,
            publicHives: 0,
            friendsCount: 0,
            groupsCount: 0
          }
        };

        // Get hives - show all if own profile, only public if viewing others
        let hives = [];
        if (targetUser.ownedHives && targetUser.ownedHives.length > 0) {
          hives = targetUser.ownedHives
            .filter(hive => {
              if (typeof hive === 'string') return false; // Skip old format
              if (isOwnProfile) return true; // Show all hives if own profile
              return hive.visibility === 'public'; // Only public for others
            })
            .map(hive => ({
              id: hive.id,
              name: hive.name,
              location: hive.location,
              color: hive.color,
              coordinates: hive.coordinates,
              visibility: hive.visibility
            }));
        }

        return res.json({
          success: true,
          user: userData,
          hives: hives
        });
      } catch (error) {
        console.error('Error fetching profile:', error);
        return res.status(500).json({ error: 'Failed to fetch profile' });
      }
    }

    // GET /api/users/search - Search for users
    if (basePath === '/search' && method === 'GET') {
      // Rate limit search
      if (rateLimit(req, res, 'search')) return;
      
      try {
        const { q = '', location = '', minExperience = 0, maxExperience = 100, limit = 20 } = req.query;
        
        // Build search query
        const searchQuery = {
          'profile.isPublic': { $ne: false } // Only public profiles
        };

        // Text search on name (sanitize to prevent ReDoS)
        if (q) {
          searchQuery.name = { $regex: escapeRegex(q), $options: 'i' };
        }

        // Location filter (sanitize to prevent ReDoS)
        if (location) {
          searchQuery['profile.location'] = { $regex: escapeRegex(location), $options: 'i' };
        }

        // Experience range filter
        if (minExperience > 0 || maxExperience < 100) {
          searchQuery['profile.experienceYears'] = {
            $gte: parseInt(minExperience) || 0,
            $lte: parseInt(maxExperience) || 100
          };
        }

        // Exclude current user from results
        if (auth.authenticated) {
          searchQuery._id = { $ne: auth.user.id };
        }

        const users = await User.find(searchQuery)
          .select('name email image profile stats createdAt')
          .limit(parseInt(limit))
          .sort({ 'stats.friendsCount': -1, 'stats.totalHives': -1 });

        return res.json({
          success: true,
          users: users.map(u => ({
            id: u._id,
            name: u.name,
            email: u.profile?.showEmail ? u.email : undefined,
            image: u.image,
            profile: u.profile || {},
            stats: u.stats || {},
            createdAt: u.createdAt
          }))
        });
      } catch (error) {
        console.error('Error searching users:', error);
        return res.status(500).json({ error: 'Failed to search users' });
      }
    }

    // PATCH /api/users/me/profile - Update own profile
    if (basePath === '/me/profile' && method === 'PATCH') {
      if (!auth.authenticated) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      try {
        const updates = req.body;
        const user = await User.findById(auth.user.id);
        
        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }

        // Initialize profile object if it doesn't exist
        if (!user.profile) {
          user.profile = {};
        }

        // Update profile fields
        if (updates.bio !== undefined) user.profile.bio = updates.bio;
        if (updates.location !== undefined) user.profile.location = updates.location;
        if (updates.experienceYears !== undefined) user.profile.experienceYears = updates.experienceYears;
        if (updates.website !== undefined) user.profile.website = updates.website;
        if (updates.phone !== undefined) user.profile.phone = updates.phone;
        if (updates.isPublic !== undefined) user.profile.isPublic = updates.isPublic;
        if (updates.showEmail !== undefined) user.profile.showEmail = updates.showEmail;
        if (updates.showHiveLocations !== undefined) user.profile.showHiveLocations = updates.showHiveLocations;

        await user.save();

        // Create new JWT with updated profile
        const secret = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET;
        const newToken = jwt.sign(
          {
            id: user._id.toString(),
            email: user.email,
            name: user.name,
            image: user.image,
            role: user.role,
            ownedHives: user.ownedHives,
            profile: user.profile
          },
          secret,
          { expiresIn: '30d' }
        );

        res.setHeader('Set-Cookie', `auth-token=${newToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`);

        return res.json({
          success: true,
          message: 'Profile updated successfully',
          user: {
            id: user._id,
            email: user.email,
            name: user.name,
            image: user.image,
            profile: user.profile
          }
        });
      } catch (error) {
        console.error('Error updating profile:', error);
        return res.status(500).json({ error: 'Failed to update profile' });
      }
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

      // Support multipart/form-data image upload for hive update
      const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;
      const useCloudinary = isServerless && process.env.CLOUDINARY_CLOUD_NAME;

      if (useCloudinary) {
        cloudinary.config({
          cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
          api_key: process.env.CLOUDINARY_API_KEY,
          api_secret: process.env.CLOUDINARY_API_SECRET
        });
      }

      let storage;
      if (useCloudinary) {
        storage = new CloudinaryStorage({
          cloudinary: cloudinary,
          params: {
            folder: 'beehive/hives',
            allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
            resource_type: 'image'
          }
        });
      } else {
        storage = multer.diskStorage({
          destination: async function (req, file, cb) {
            const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'hives');
            try { await fs.mkdir(uploadDir, { recursive: true }); cb(null, uploadDir); } catch (e) { cb(e); }
          },
          filename: function (req, file, cb) {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const ext = path.extname(file.originalname);
            const nameWithoutExt = path.basename(file.originalname, ext);
            const safeName = nameWithoutExt.replace(/[^a-zA-Z0-9]/g, '_');
            cb(null, safeName + '-' + uniqueSuffix + ext);
          }
        });
      }

      const upload = multer({
        storage,
        limits: { fileSize: 5 * 1024 * 1024 },
        fileFilter: function (req, file, cb) {
          const allowed = ['image/jpeg', 'image/png', 'image/webp'];
          if (allowed.includes(file.mimetype)) cb(null, true); else cb(new Error('Invalid image type'));
        }
      });

      if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
        return new Promise((resolve) => {
          upload.single('image')(req, res, async (err) => {
            if (err instanceof multer.MulterError) {
              if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'Image too large (max 5MB)' });
              return res.status(400).json({ error: 'Upload error: ' + err.message });
            } else if (err) {
              return res.status(400).json({ error: err.message });
            }

            try {
              const user = await User.findById(auth.user.id);
              if (!user) return res.status(404).json({ error: 'User not found' });

              const hiveIndex = user.ownedHives.findIndex(h => { const hId = typeof h === 'string' ? h : h.id; return hId === hiveId; });
              if (hiveIndex === -1) return res.status(404).json({ error: 'Hive not found' });

              // Parse fields from multipart body
              const body = req.body || {};
              let updates = body;
              try { if (typeof body.coordinates === 'string') updates.coordinates = JSON.parse(body.coordinates); } catch (e) { /* ignore */ }
              try { if (typeof body.device === 'string') updates.device = JSON.parse(body.device); } catch (e) { /* ignore */ }

              // Apply updates
              if (updates.name) user.ownedHives[hiveIndex].name = updates.name;
              if (updates.location !== undefined) user.ownedHives[hiveIndex].location = updates.location;
              if (updates.color) user.ownedHives[hiveIndex].color = updates.color;
              if (updates.coordinates && updates.coordinates.lat != null && updates.coordinates.lng != null) user.ownedHives[hiveIndex].coordinates = updates.coordinates;
              else if (updates.coordinates === null) delete user.ownedHives[hiveIndex].coordinates;
              if (updates.visibility !== undefined) user.ownedHives[hiveIndex].visibility = updates.visibility;

              // Device updates
              if (updates.device) {
                if (!user.ownedHives[hiveIndex].device) user.ownedHives[hiveIndex].device = {};
                if (updates.device.type) user.ownedHives[hiveIndex].device.type = updates.device.type;
                if (updates.device.devEUI) user.ownedHives[hiveIndex].device.devEUI = updates.device.devEUI.toUpperCase();
              }

              // Image file
              if (req.file) {
                if (useCloudinary) user.ownedHives[hiveIndex].image = req.file.path; else user.ownedHives[hiveIndex].image = `/uploads/hives/${req.file.filename}`;
              }

              await user.save();

              const secret = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET;
              const newToken = jwt.sign({ id: user._id.toString(), email: user.email, name: user.name, image: user.image, role: user.role, ownedHives: user.ownedHives }, secret, { expiresIn: '30d' });
              res.setHeader('Set-Cookie', `auth-token=${newToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`);

              return resolve(res.json({ success: true, message: 'Hive updated successfully', hive: user.ownedHives[hiveIndex], refreshRequired: true }));
            } catch (error) {
              console.error('Error updating hive (multipart):', error);
              return resolve(res.status(500).json({ error: 'Failed to update hive' }));
            }
          });
        });
      }

      // JSON path (existing behavior)
      const updates = req.body;
      console.log('📝 PATCH hive request:');
      console.log('  Hive ID:', hiveId);
      console.log('  Updates:', JSON.stringify(updates, null, 2));
      console.log('  Visibility in updates:', updates.visibility, '(type:', typeof updates.visibility + ')');

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

      console.log('📍 Found hive at index:', hiveIndex);
      console.log('📍 Current visibility:', user.ownedHives[hiveIndex].visibility);

      // Update hive properties
      if (updates.name) user.ownedHives[hiveIndex].name = updates.name;
      if (updates.location !== undefined) user.ownedHives[hiveIndex].location = updates.location;
      if (updates.color) user.ownedHives[hiveIndex].color = updates.color;
      
      // Handle image update (base64 data URL or Cloudinary URL) - upload to Cloudinary if base64
      if (updates.image !== undefined) {
        if (updates.image === null || updates.image === '') {
          // Allow explicit removal of image
          delete user.ownedHives[hiveIndex].image;
        } else {
          // Upload base64 to Cloudinary for proper persistence
          const imageUrl = await uploadBase64ToCloudinary(updates.image);
          if (imageUrl) {
            user.ownedHives[hiveIndex].image = imageUrl;
          }
        }
      }
      
      // Only update coordinates if they are valid (have lat and lng)
      if (updates.coordinates && updates.coordinates.lat != null && updates.coordinates.lng != null) {
        user.ownedHives[hiveIndex].coordinates = updates.coordinates;
      } else if (updates.coordinates === null) {
        // Allow explicit removal of coordinates
        delete user.ownedHives[hiveIndex].coordinates;
      }
      
      if (updates.visibility !== undefined) {
        console.log('✅ Updating visibility from', user.ownedHives[hiveIndex].visibility, 'to', updates.visibility);
        user.ownedHives[hiveIndex].visibility = updates.visibility;
      } else {
        console.log('⚠️ Visibility not in updates - not updating');
      }
      
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
      
      const payload = jwt.verify(token, process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET);
      
      if (payload.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }
      
      // Don't allow deleting yourself
      if (userId === payload.id) {
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
