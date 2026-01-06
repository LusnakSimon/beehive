const jwt = require('jsonwebtoken');
const { connectDB } = require('../lib/utils/db');

// Lazy load User model
let User;
function getUser() {
  if (!User) {
    User = require('../lib/models/User');
  }
  return User;
}

module.exports = async (req, res) => {
  const token = req.headers.cookie?.split('auth-token=')[1]?.split(';')[0];
  if (!token) {
    return res.json({ user: null });
  }

  try {
    const secret = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET;
    const decoded = jwt.verify(token, secret);
    
    // Fetch full user data from database to get ownedHives
    let ownedHives = [];
    try {
      await connectDB();
      const UserModel = getUser();
      const user = await UserModel.findById(decoded.id).lean();
      if (user) {
        ownedHives = user.ownedHives || [];
        // Debug: log what we got from DB
        console.log('📡 Session - ownedHives from DB:', JSON.stringify(ownedHives, null, 2));
      }
    } catch (dbErr) {
      console.error('Error fetching user hives:', dbErr);
      // Fall back to empty array if DB fails
    }
    
    return res.json({
      user: {
        id: decoded.id,
        email: decoded.email,
        name: decoded.name,
        image: decoded.image,
        provider: decoded.provider,
        role: decoded.role,
        ownedHives: ownedHives,
        profile: decoded.profile || {},
      },
    });
  } catch (err) {
    console.error('Session verification error:', err);
    return res.json({ user: null });
  }
};
