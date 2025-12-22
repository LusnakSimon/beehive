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
    // Try to connect to DB and fetch latest user record to return fresh ownedHives.
    // If DB is not available (e.g., during local dev without MONGODB_URI),
    // fall back to the decoded token payload so session checks (OAuth flows)
    // continue to work.
    try {
      await connectDB();
      const dbUser = await User.findById(decoded.id).select('name email image role ownedHives');

      if (dbUser) {
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
      }
      // If user not found in DB, fall through to return decoded payload below
    } catch (dbErr) {
      console.warn('Session DB lookup failed, falling back to token payload:', dbErr && dbErr.message);
    }

    // Fallback: return user info from the decoded token (keeps OAuth login working
    // even when DB cannot be reached).
    return res.json({
      user: {
        id: decoded.id,
        email: decoded.email,
        name: decoded.name,
        image: decoded.image,
        provider: decoded.provider,
        role: decoded.role,
        ownedHives: decoded.ownedHives || [],
      }
    });
  } catch (err) {
    console.error('Session error:', err);
    return res.json({ user: null });
  }
};
