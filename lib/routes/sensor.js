const Reading = require('../models/Reading.js');
const User = require('../models/User.js');
const { verifyAuth, userOwnsHive } = require('../utils/auth.js');
const { validateSensorReading } = require('../utils/validation.js');
const { rateLimit } = require('../utils/rateLimit.js');

// Validate device API key - checks if the provided API key matches a device for the specified hive
async function validateDeviceApiKey(apiKey, hiveId) {
  if (!apiKey || !hiveId) return { valid: false }
  
  try {
    // Find user who owns this hive with this device API key
    const user = await User.findOne({
      'ownedHives': {
        $elemMatch: {
          'id': hiveId,
          'device.apiKey': apiKey
        }
      }
    })
    
    if (user) {
      return { valid: true, userId: user._id, source: 'API' }
    }
  } catch (error) {
    console.error('Error validating device API key:', error)
  }
  
  return { valid: false }
}

// Legacy global API key (for backward compatibility during transition)
const LEGACY_API_KEY = process.env.ESP32_API_KEY;
function validateLegacyApiKey(req) {
  const apiKey = req.headers['x-api-key'];
  if (!LEGACY_API_KEY) return false;
  return apiKey === LEGACY_API_KEY;
}

// Helper to parse date range
function getStartDate(range) {
  const now = new Date();
  const ranges = {
    '6h': 6 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
    '90d': 90 * 24 * 60 * 60 * 1000,
    '180d': 180 * 24 * 60 * 60 * 1000,
    '365d': 365 * 24 * 60 * 60 * 1000,
  };
  const ms = ranges[range] || ranges['24h'];
  return new Date(now - ms);
}

module.exports = async (req, res) => {
  try {
    const method = req.method;
    
    // Normalize path - remove /api/sensor prefix if present
    let path = req.url || '';
    if (path.startsWith('/api/sensor')) {
      path = path.replace('/api/sensor', '');
    }
    
    // Ensure path starts with /
    if (path && !path.startsWith('/')) {
      path = '/' + path;
    }
    
    // Split query string from base path
    const basePath = path.split('?')[0];
    
    // Parse query parameters
    const url = new URL(req.url, `http://${req.headers.host}`);
    const hiveId = url.searchParams.get('hiveId') || 'HIVE-001';
    
    // POST /api/sensor - Save new sensor reading (for IoT devices)
    // This endpoint allows device-specific API key OR user auth (for manual entries)
    if (method === 'POST') {
      // Rate limit sensor posts
      if (rateLimit(req, res, 'sensor')) return;
      
      const body = req.body || {};
      const targetHiveId = body.hiveId || hiveId;
      const providedApiKey = req.headers['x-api-key'];
      
      // Try device-specific API key first
      const deviceAuth = await validateDeviceApiKey(providedApiKey, targetHiveId);
      
      // Fallback to legacy global API key (for backward compatibility)
      const hasLegacyKey = validateLegacyApiKey(req);
      
      // Check user authentication
      const auth = verifyAuth(req);
      
      // Must have either valid device API key, legacy key, or be authenticated user
      if (!deviceAuth.valid && !hasLegacyKey && !auth.authenticated) {
        return res.status(401).json({ 
          error: 'Unauthorized',
          message: 'Valid device API key or authentication required' 
        });
      }
      
      // Validate sensor data
      const validation = validateSensorReading(body);
      if (!validation.valid) {
        return res.status(400).json({ 
          error: 'Validation failed',
          messages: validation.errors 
        });
      }
      
      // If authenticated user (not device), verify they own the hive
      if (!deviceAuth.valid && !hasLegacyKey && auth.authenticated) {
        if (!userOwnsHive(auth.user, targetHiveId)) {
          return res.status(403).json({ 
            error: 'Forbidden',
            message: 'You do not have access to this hive' 
          });
        }
      }
      
      // Determine source based on auth method
      let source = 'Manual';
      if (deviceAuth.valid) {
        source = 'API';
      } else if (hasLegacyKey) {
        source = 'API'; // Legacy key is still API-based
      }
      
      const reading = new Reading({
        temperature: validation.data.temperature,
        humidity: validation.data.humidity,
        weight: validation.data.weight,
        battery: validation.data.battery,
        hiveId: targetHiveId,
        source: source,
        metadata: body.metadata || {}
      });
      
      await reading.save();
      
      return res.status(201).json({
        success: true,
        message: 'Reading saved successfully',
        reading: {
          id: reading._id,
          temperature: reading.temperature,
          humidity: reading.humidity,
          weight: reading.weight,
          battery: reading.battery,
          hiveId: reading.hiveId,
          timestamp: reading.timestamp
        }
      });
    }
    
    // All GET endpoints require authentication
    const auth = verifyAuth(req);
    if (!auth.authenticated) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Authentication required' 
      });
    }
    
    // Verify user owns the hive they're querying
    if (!userOwnsHive(auth.user, hiveId)) {
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'You do not have access to this hive' 
      });
    }
    
    // GET /api/sensor/latest - Latest sensor reading
    if (basePath === '/latest' && method === 'GET') {
      const latest = await Reading.findOne({ hiveId }).sort({ timestamp: -1 });
      
      if (!latest) {
        return res.json({
          temperature: 0,
          humidity: 0,
          weight: 0,
          battery: 0,
          lastUpdate: null,
          metadata: null
        });
      }

      return res.json({
        temperature: latest.temperature,
        humidity: latest.humidity,
        weight: latest.weight,
        battery: latest.battery,
        lastUpdate: latest.timestamp,
        metadata: latest.metadata || null
      });
    }

    // GET /api/sensor/history - Historical sensor readings
    if (basePath === '/history' && method === 'GET') {
      const range = url.searchParams.get('range') || '24h';
      const startDate = getStartDate(range);

      const readings = await Reading.find({
        hiveId,
        timestamp: { $gte: startDate }
      }).sort({ timestamp: 1 }).select('-__v');

      return res.json(readings);
    }

    // GET /api/sensor/stats - Sensor statistics
    if (basePath === '/stats' && method === 'GET') {
      const range = url.searchParams.get('range') || '24h';
      const startDate = getStartDate(range);
      
      const stats = await Reading.aggregate([
        { $match: { hiveId, timestamp: { $gte: startDate } } },
        {
          $group: {
            _id: null,
            tempAvg: { $avg: '$temperature' },
            tempMin: { $min: '$temperature' },
            tempMax: { $max: '$temperature' },
            humidityAvg: { $avg: '$humidity' },
            humidityMin: { $min: '$humidity' },
            humidityMax: { $max: '$humidity' },
            weightAvg: { $avg: '$weight' },
            weightMin: { $min: '$weight' },
            weightMax: { $max: '$weight' },
            batteryAvg: { $avg: '$battery' },
            batteryMin: { $min: '$battery' },
            count: { $sum: 1 }
          }
        }
      ]);

      if (stats.length === 0) {
        return res.json({
          temperature: { avg: 0, min: 0, max: 0 },
          humidity: { avg: 0, min: 0, max: 0 },
          weight: { avg: 0, min: 0, max: 0 },
          battery: { avg: 0, min: 0 },
          count: 0
        });
      }

      const result = stats[0];
      return res.json({
        temperature: { avg: result.tempAvg, min: result.tempMin, max: result.tempMax },
        humidity: { avg: result.humidityAvg, min: result.humidityMin, max: result.humidityMax },
        weight: { avg: result.weightAvg, min: result.weightMin, max: result.weightMax },
        battery: { avg: result.batteryAvg, min: result.batteryMin },
        count: result.count,
        range,
        startDate
      });
    }

    // Route not found
    res.status(404).json({ error: 'Sensor endpoint not found' });
  } catch (error) {
    console.error('Sensor route error:', error.message, error.stack);
    res.status(500).json({
      error: 'Failed to process sensor request',
      message: error.message || 'Internal server error'
    });
  }
};
