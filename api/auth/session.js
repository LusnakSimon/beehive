const User = require('../../models/User');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get session token from cookies
    const token = req.cookies?.['next-auth.session-token'] || 
                  req.cookies?.['__Secure-next-auth.session-token'];

    if (!token) {
      return res.json({ user: null });
    }

    // For now, return a mock session
    // In production, you'd verify the JWT token
    const jwt = require('jsonwebtoken');
    const secret = process.env.NEXTAUTH_SECRET;
    
    try {
      const decoded = jwt.verify(token, secret);
      const user = await User.findById(decoded.id);
      
      if (!user) {
        return res.json({ user: null });
      }

      return res.json({
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
          ownedHives: user.ownedHives
        }
      });
    } catch (error) {
      return res.json({ user: null });
    }
  } catch (error) {
    console.error('Session check error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
