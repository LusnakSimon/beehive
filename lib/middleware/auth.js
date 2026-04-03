const jwt = require('jsonwebtoken');

// Middleware to verify JWT token from NextAuth
const authenticateUser = async (req, res, next) => {
  try {
    // Get token from cookies or Authorization header
    const token = req.cookies?.['next-auth.session-token'] || 
                  req.cookies?.['__Secure-next-auth.session-token'] ||
                  req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Musíš byť prihlásený pre prístup k tejto funkcii' 
      });
    }

    // Verify token
    const secret = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET;
    const decoded = jwt.verify(token, secret);

    // Attach user info to request
    req.user = {
      id: decoded.id,
      email: decoded.email,
      ownedHives: decoded.ownedHives || []
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Neplatný alebo expirovaný token' 
    });
  }
};

// Middleware to check if user owns the hive
const authorizeHiveAccess = (req, res, next) => {
  const hiveId = req.query.hiveId || req.body.hiveId;
  
  if (!hiveId) {
    return res.status(400).json({ 
      error: 'Bad Request',
      message: 'HiveId je povinný parameter' 
    });
  }

  // Check if user owns this hive
  if (!req.user.ownedHives.includes(hiveId)) {
    return res.status(403).json({ 
      error: 'Forbidden',
      message: 'Nemáš prístup k tomuto úľu' 
    });
  }

  next();
};

module.exports = {
  authenticateUser,
  authorizeHiveAccess
};
