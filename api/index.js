const mongoose = require('mongoose');

// Import route handlers
const sensorRoutes = require('../lib/routes/sensor.js');
const esp32Routes = require('../lib/routes/esp32.js');
const lorawanRoutes = require('../lib/routes/lorawan.js');
const inspectionRoutes = require('../lib/routes/inspection.js');
const notificationsRoutes = require('../lib/routes/notifications.js');
const adminRoutes = require('../lib/routes/admin.js');
const testDataRoutes = require('../lib/routes/testData.js');
const usersRoutes = require('../lib/routes/users.js');

// MongoDB connection cache
let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn) return cached.conn;
  
  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      maxPoolSize: 10,
    };
    cached.promise = mongoose.connect(process.env.MONGODB_URI, opts);
  }
  
  cached.conn = await cached.promise;
  return cached.conn;
}

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Parse body for POST/PUT/PATCH requests
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    if (!req.body) {
      try {
        const buffers = [];
        for await (const chunk of req) {
          buffers.push(chunk);
        }
        const data = Buffer.concat(buffers).toString();
        req.body = data ? JSON.parse(data) : {};
      } catch (e) {
        req.body = {};
      }
    }
  }
  
  try {
    await connectDB();
    
    // Route based on URL path
    const path = req.url.replace('/api', '');
    
    if (path.startsWith('/sensor')) {
      req.url = path.replace('/sensor', '');
      return sensorRoutes(req, res);
    } else if (path.startsWith('/esp32')) {
      req.url = path.replace('/esp32', '');
      return esp32Routes(req, res);
    } else if (path.startsWith('/lorawan')) {
      req.url = path.replace('/lorawan', '');
      return lorawanRoutes(req, res);
    } else if (path.startsWith('/inspection')) {
      req.url = path.replace('/inspection', '');
      return inspectionRoutes(req, res);
    } else if (path.startsWith('/notifications')) {
      req.url = path.replace('/notifications', '');
      return notificationsRoutes(req, res);
    } else if (path.startsWith('/admin')) {
      req.url = path.replace('/admin', '');
      return adminRoutes(req, res);
    } else if (path.startsWith('/users')) {
      req.url = path.replace('/users', '');
      return usersRoutes(req, res);
    } else if (path.startsWith('/test')) {
      req.url = path.replace('/test', '');
      return testDataRoutes(req, res);
    } else {
      return res.status(404).json({ error: 'Not found' });
    }
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
