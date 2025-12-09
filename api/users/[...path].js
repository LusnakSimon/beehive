const usersRoutes = require('../../lib/routes/users.js');
const { connectDB } = require('../../lib/utils/db.js');
const { setCorsHeaders } = require('../../lib/utils/cors.js');

module.exports = async (req, res) => {
  // Set CORS headers
  if (setCorsHeaders(req, res)) return;
  
  try {
    await connectDB();
    return usersRoutes(req, res);
  } catch (error) {
    console.error('Users API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
