const jwt = require('jsonwebtoken');

module.exports = async (req, res) => {
  const token = req.headers.cookie?.split('auth-token=')[1]?.split(';')[0];
  
  if (!token) {
    return res.json({ user: null });
  }

  try {
    const decoded = jwt.verify(token, process.env.NEXTAUTH_SECRET);
    res.json({
      user: {
        id: decoded.id,
        email: decoded.email,
        name: decoded.name,
        image: decoded.image,
        provider: decoded.provider,
        role: decoded.role,
        ownedHives: decoded.ownedHives || [],
      },
    });
  } catch (err) {
    res.json({ user: null });
  }
};
