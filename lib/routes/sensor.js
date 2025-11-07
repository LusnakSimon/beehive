const Reading = require('../models/Reading.js');

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
      const now = new Date();
      let startDate;

      switch (range) {
        case '6h':
          startDate = new Date(now - 6 * 60 * 60 * 1000);
          break;
        case '24h':
          startDate = new Date(now - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          startDate = new Date(now - 90 * 24 * 60 * 60 * 1000);
          break;
        case '180d':
          startDate = new Date(now - 180 * 24 * 60 * 60 * 1000);
          break;
        case '365d':
          startDate = new Date(now - 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now - 24 * 60 * 60 * 1000);
      }

      const readings = await Reading.find({
        hiveId,
        timestamp: { $gte: startDate }
      }).sort({ timestamp: 1 }).select('-__v');

      return res.json(readings);
    }

    // GET /api/sensor/stats - Sensor statistics
    if (basePath === '/stats' && method === 'GET') {
      const range = url.searchParams.get('range') || '24h';
      const now = new Date();
      let startDate;

      switch (range) {
        case '6h':
          startDate = new Date(now - 6 * 60 * 60 * 1000);
          break;
        case '24h':
          startDate = new Date(now - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          startDate = new Date(now - 90 * 24 * 60 * 60 * 1000);
          break;
        case '180d':
          startDate = new Date(now - 180 * 24 * 60 * 60 * 1000);
          break;
        case '365d':
          startDate = new Date(now - 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now - 24 * 60 * 60 * 1000);
      }
      
      const stats = await Reading.aggregate([
        { $match: { hiveId, timestamp: { $gte: startDate } } },
        {
          $group: {
            _id: null,
            temperature: {
              avg: { $avg: '$temperature' },
              min: { $min: '$temperature' },
              max: { $max: '$temperature' }
            },
            humidity: {
              avg: { $avg: '$humidity' },
              min: { $min: '$humidity' },
              max: { $max: '$humidity' }
            },
            weight: {
              avg: { $avg: '$weight' },
              min: { $min: '$weight' },
              max: { $max: '$weight' }
            },
            battery: {
              avg: { $avg: '$battery' },
              min: { $min: '$battery' }
            },
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
        temperature: result.temperature,
        humidity: result.humidity,
        weight: result.weight,
        battery: result.battery,
        count: result.count,
        range,
        startDate
      });
    }

    // Route not found
    res.status(404).json({ error: 'Sensor endpoint not found' });
  } catch (error) {
    console.error('Sensor route error:', error);
    res.status(500).json({
      error: 'Failed to process sensor request',
      message: error.message
    });
  }
};
