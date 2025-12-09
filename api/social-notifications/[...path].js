const handler = require('../../lib/routes/social-notifications.js');
const { connectDB } = require('../../lib/utils/db.js');
const { setCorsHeaders } = require('../../lib/utils/cors.js');

module.exports = async function(req, res) {
  // Set CORS headers
  if (setCorsHeaders(req, res)) return;

  try {
    await connectDB();
    return await handler(req, res);
  } catch (error) {
    console.error('Social notifications API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
