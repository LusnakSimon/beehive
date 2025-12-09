const sensorRoutes = require('../../lib/routes/sensor.js');
const { connectDB } = require('../../lib/utils/db.js');
const { setPublicCorsHeaders } = require('../../lib/utils/cors.js');

module.exports = async (req, res) => {
  // Set CORS headers - public for IoT devices
  if (setPublicCorsHeaders(req, res)) return;
  
  try {
    await connectDB();
    return sensorRoutes(req, res);
  } catch (error) {
    console.error('Sensor API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
