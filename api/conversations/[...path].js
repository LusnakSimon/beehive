const conversationsRoutes = require('../../lib/routes/conversations.js');
const { connectDB } = require('../../lib/utils/db.js');
const { setCorsHeaders } = require('../../lib/utils/cors.js');

module.exports = async (req, res) => {
  // Set CORS headers
  if (setCorsHeaders(req, res)) return;
  
  try {
    await connectDB();
    return await conversationsRoutes(req, res);
  } catch (error) {
    console.error('Conversations API Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
