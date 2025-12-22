const jwt = require('jsonwebtoken');
const { connectDB } = require('../../lib/utils/db.js');
const User = require('../../lib/models/User.js');

module.exports = async (req, res) => {
  const token = req.headers.cookie?.split('auth-token=')[1]?.split(';')[0];
  if (!token) {
    return res.json({ user: null });
  }

  try {
    const secret = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET;
    const decoded = jwt.verify(token, secret);

    // Connect to DB and fetch latest user record to return fresh ownedHives
    await connectDB();
    const dbUser = await User.findById(decoded.id).select('name email image role ownedHives');

    if (!dbUser) {
      return res.json({ user: null });
    }

    return res.json({
      user: {
        id: dbUser._id.toString(),
        email: dbUser.email,
        name: dbUser.name,
        image: dbUser.image,
        provider: decoded.provider,
        role: dbUser.role,
        ownedHives: dbUser.ownedHives || [],
      }
    });
  } catch (err) {
    console.error('Session error:', err);
    return res.json({ user: null });
  }
};
