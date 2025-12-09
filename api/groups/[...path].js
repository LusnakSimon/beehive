const groupsHandler = require('../../lib/routes/groups.js');
const { connectDB } = require('../../lib/utils/db.js');
const { setCorsHeaders } = require('../../lib/utils/cors.js');

module.exports = async (req, res) => {
  // Set CORS headers
  if (setCorsHeaders(req, res)) return;

  try {
    await connectDB();
    
    // Forward request to groups handler
    await groupsHandler(req, res);
  } catch (error) {
    console.error('[Groups API] Error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
