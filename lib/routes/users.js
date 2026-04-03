const mongoose = require('mongoose');
const User = require('../models/User.js');
const { generateDeviceApiKey } = require('../models/User.js');
const jwt = require('jsonwebtoken');
const { verifyAuth } = require('../utils/auth.js');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Helper to create minimal JWT (avoid cookie size overflow)
function createUserToken(user) {
  const secret = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET;
  const hiveIds = (user.ownedHives || []).map(h => typeof h === 'string' ? h : h?.id).filter(Boolean);
  return jwt.sign({
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    image: user.image,
    hiveIds: hiveIds
  }, secret, { expiresIn: '30d' });
}

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
              let { name, location, color, coordinates, device } = body;
              if (!name) return res.status(400).json({ error: 'Hive name required' });

              try {
                if (typeof coordinates === 'string' && coordinates) coordinates = JSON.parse(coordinates);
              } catch (e) { coordinates = undefined; }
              try {
                if (typeof device === 'string' && device) device = JSON.parse(device);
              } catch (e) { device = undefined; }

              // Validate device
              if (device) {
                const validTypes = ['api', 'esp32-wifi'];
                if (device.type && !validTypes.includes(device.type)) {
                  return res.status(400).json({ error: 'Invalid device type. Use api or esp32-wifi.' });
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
                color: color || '#fbbf24'
              };

              if (device && device.type) {
                newHive.device = { type: device.type };
                // Auto-generate API key for api type devices
                if (device.type === 'api') {
                  newHive.device.apiKey = generateDeviceApiKey();
                }
              }

              // Only add coordinates if they are valid numbers
              if (coordinates && coordinates.lat != null && coordinates.lng != null) {
                const lat = typeof coordinates.lat === 'string' ? parseFloat(coordinates.lat) : coordinates.lat;
                const lng = typeof coordinates.lng === 'string' ? parseFloat(coordinates.lng) : coordinates.lng;
                if (!isNaN(lat) && !isNaN(lng) && lat !== '' && lng !== '') {
                  newHive.coordinates = { lat, lng };
                }
              }

              // Add uploaded image if present
              if (req.file) {
                if (useCloudinary) newHive.image = req.file.path; else newHive.image = `/uploads/hives/${req.file.filename}`;
              }

              user.ownedHives.push(newHive);
              user.markModified('ownedHives'); // Required for Mixed type arrays
              await user.save();

              // Update JWT cookie with minimal data
              const newToken = createUserToken(user);
              res.setHeader('Set-Cookie', `auth-token=${newToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`);

              return resolve(res.json({ success: true, message: 'Hive created successfully', hive: newHive, refreshRequired: true }));
            } catch (error) {
              console.error('Error creating hive (multipart):', error);
              return resolve(res.status(500).json({ error: 'Failed to create hive', details: process.env.NODE_ENV === 'development' ? error.message : undefined }));
            }
          });
        });
      }

      // Fallback JSON path (existing behavior)
      const { name, location, color, coordinates, device } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Hive name required' });
      }
      
      // Validate device if provided
      if (device) {
        const validTypes = ['api', 'esp32-wifi'];
        if (device.type && !validTypes.includes(device.type)) {
          return res.status(400).json({ error: 'Invalid device type. Use api or esp32-wifi.' });
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
        color: color || '#fbbf24'
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
        
        // Auto-generate API key for api type devices
        if (device.type === 'api') {
          newHive.device.apiKey = generateDeviceApiKey();
        }
      }

      // Only add coordinates if they are valid numbers
      if (coordinates && coordinates.lat != null && coordinates.lng != null) {
        const lat = typeof coordinates.lat === 'string' ? parseFloat(coordinates.lat) : coordinates.lat;
        const lng = typeof coordinates.lng === 'string' ? parseFloat(coordinates.lng) : coordinates.lng;
        if (!isNaN(lat) && !isNaN(lng) && lat !== '' && lng !== '') {
          newHive.coordinates = { lat, lng };
        }
      }

      user.ownedHives.push(newHive);
      
      try {
        user.markModified('ownedHives'); // Required for Mixed type arrays
        await user.save();
      } catch (saveError) {
        console.error('Save error:', saveError.message);
        return res.status(400).json({ 
          error: 'Validation failed',
          details: process.env.NODE_ENV === 'development' ? saveError.message : undefined
        });
      }

      // Create new JWT token with minimal data
      const newToken = createUserToken(user);

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
      user.markModified('ownedHives'); // Required for Mixed type arrays
      await user.save();

      // Create new JWT token with minimal data
      const newToken = createUserToken(user);

      // Update cookie
      res.setHeader('Set-Cookie', `auth-token=${newToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`);

      return res.json({
        success: true,
        message: 'Hive removed successfully',
        refreshRequired: true
      });
    }

    // GET /api/users/hives/map - Get user's hives for map view
    if (basePath === '/hives/map' && method === 'GET') {
      if (!auth.authenticated) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const user = await User.findById(auth.user.id, 'name ownedHives');
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      const hives = [];
      if (user.ownedHives && user.ownedHives.length > 0) {
        user.ownedHives.forEach(hive => {
          if (typeof hive !== 'object' || !hive.coordinates?.lat || !hive.coordinates?.lng) return;
          hives.push({
            id: hive.id,
            name: hive.name,
            location: hive.location,
            color: hive.color,
            coordinates: hive.coordinates,
            isOwner: true
          });
        });
      }

      return res.json({
        success: true,
        hives
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

              // Device updates
              if (updates.device) {
                if (!user.ownedHives[hiveIndex].device) user.ownedHives[hiveIndex].device = {};
                if (updates.device.type) {
                  user.ownedHives[hiveIndex].device.type = updates.device.type;
                  // Auto-generate API key when switching to api type and no key exists
                  if (updates.device.type === 'api' && !user.ownedHives[hiveIndex].device.apiKey) {
                    user.ownedHives[hiveIndex].device.apiKey = generateDeviceApiKey();
                  }
                }
              }

              // Ensure coordinates are valid numbers or remove them
              if (user.ownedHives[hiveIndex].coordinates) {
                const coords = user.ownedHives[hiveIndex].coordinates;
                const lat = typeof coords.lat === 'string' ? parseFloat(coords.lat) : coords.lat;
                const lng = typeof coords.lng === 'string' ? parseFloat(coords.lng) : coords.lng;
                
                if (isNaN(lat) || isNaN(lng) || lat === null || lng === null) {
                  delete user.ownedHives[hiveIndex].coordinates;
                } else {
                  user.ownedHives[hiveIndex].coordinates = { lat, lng };
                }
              }

              // Image file
              if (req.file) {
                if (useCloudinary) user.ownedHives[hiveIndex].image = req.file.path; else user.ownedHives[hiveIndex].image = `/uploads/hives/${req.file.filename}`;
              }

              user.markModified('ownedHives'); // Required for Mixed type arrays
              await user.save();

              const newToken = createUserToken(user);
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
      
      // Device updates
      if (updates.device) {
        if (!user.ownedHives[hiveIndex].device) user.ownedHives[hiveIndex].device = {};
        
        if (updates.device.type) {
          user.ownedHives[hiveIndex].device.type = updates.device.type;
          // Auto-generate API key when switching to api type and no key exists
          if (updates.device.type === 'api' && !user.ownedHives[hiveIndex].device.apiKey) {
            user.ownedHives[hiveIndex].device.apiKey = generateDeviceApiKey();
          }
        }
      }
      
      // Ensure coordinates are valid numbers or remove them
      if (user.ownedHives[hiveIndex].coordinates) {
        const coords = user.ownedHives[hiveIndex].coordinates;
        const lat = typeof coords.lat === 'string' ? parseFloat(coords.lat) : coords.lat;
        const lng = typeof coords.lng === 'string' ? parseFloat(coords.lng) : coords.lng;
        
        if (isNaN(lat) || isNaN(lng) || lat === null || lng === null) {
          // Remove invalid coordinates
          delete user.ownedHives[hiveIndex].coordinates;
        } else {
          // Ensure they're stored as numbers
          user.ownedHives[hiveIndex].coordinates = { lat, lng };
        }
      }
      
      try {
        user.markModified('ownedHives'); // Required for Mixed type arrays
        await user.save();
      } catch (saveError) {
        console.error('❌ Save error:', saveError.message);
        if (saveError.errors) {
          console.error('❌ Validation errors:', JSON.stringify(saveError.errors, null, 2));
        }
        return res.status(400).json({ 
          error: 'Validation failed',
          details: process.env.NODE_ENV === 'development' ? saveError.message : undefined
        });
      }

      // Create new JWT token with minimal data
      const newToken = createUserToken(user);

      // Update cookie
      res.setHeader('Set-Cookie', `auth-token=${newToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`);

      return res.json({
        success: true,
        message: 'Hive updated successfully',
        hive: user.ownedHives[hiveIndex],
        refreshRequired: true
      });
    }

    // GET /api/users/me - Get current user info
    if (path === '/me' && method === 'GET') {
      if (!auth.authenticated) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const user = await User.findOne({ email: auth.user.email })
        .select('name email image ownedHives');

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.json(user);
    }

    // POST /api/users/me/hives/:hiveId/generate-api-key - Generate new API key for device
    if (basePath.match(/^\/me\/hives\/[^/]+\/generate-api-key$/) && method === 'POST') {
      if (!auth.authenticated) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const pathParts = basePath.split('/');
      const hiveId = pathParts[3]; // /me/hives/:hiveId/generate-api-key

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

      // Ensure device object exists
      if (!user.ownedHives[hiveIndex].device) {
        user.ownedHives[hiveIndex].device = {};
      }

      // Check if device type supports API keys
      const deviceType = user.ownedHives[hiveIndex].device.type || 'api';
      if (deviceType !== 'api') {
        return res.status(400).json({ 
          error: 'API keys are only supported for API devices',
          message: 'Change device type to API first'
        });
      }

      // Generate new API key
      const newApiKey = generateDeviceApiKey();
      user.ownedHives[hiveIndex].device.apiKey = newApiKey;
      
      user.markModified('ownedHives'); // Required for Mixed type arrays
      await user.save();

      // Update JWT token with minimal data
      const newToken = createUserToken(user);

      res.setHeader('Set-Cookie', `auth-token=${newToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`);

      return res.json({
        success: true,
        message: 'API key generated successfully',
        apiKey: newApiKey,
        hive: user.ownedHives[hiveIndex],
        refreshRequired: true
      });
    }

    // Route not found
    res.status(404).json({ error: 'Users endpoint not found' });
  } catch (error) {
    console.error('Users route error:', error);
    res.status(500).json({
      error: 'Failed to process users request',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};
