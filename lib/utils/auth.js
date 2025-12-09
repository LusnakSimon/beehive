const jwt = require('jsonwebtoken');

/**
 * Verify JWT token from cookie or Authorization header
 * @param {Request} req - Express request object
 * @returns {{ authenticated: boolean, user: object|null }}
 */
function verifyAuth(req) {
  // Try to get token from cookie first, then Authorization header
  let token = null;
  
  // Parse cookie header manually for Vercel serverless
  const cookieHeader = req.headers.cookie || '';
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(c => {
      const [key, ...val] = c.trim().split('=');
      return [key, val.join('=')];
    })
  );
  
  token = cookies['auth-token'];
  
  // Fallback to Authorization header
  if (!token && req.headers.authorization) {
    const authHeader = req.headers.authorization;
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }
  
  if (!token) {
    return { authenticated: false, user: null };
  }

  try {
    const secret = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET;
    if (!secret) {
      console.error('JWT secret not configured');
      return { authenticated: false, user: null };
    }
    
    const decoded = jwt.verify(token, secret);
    
    // JWT can have user data directly or nested in 'user' field
    const userData = decoded.user || decoded;
    
    return { 
      authenticated: true, 
      user: {
        id: userData.id || userData.userId || userData._id,
        email: userData.email,
        role: userData.role || 'user',
        name: userData.name,
        ownedHives: userData.ownedHives || []
      }
    };
  } catch (err) {
    // Token expired or invalid
    return { authenticated: false, user: null };
  }
}

/**
 * Middleware to require authentication
 * @param {Request} req
 * @param {Response} res
 * @returns {object|null} - Returns user object if authenticated, sends 401 and returns null otherwise
 */
function requireAuth(req, res) {
  const auth = verifyAuth(req);
  
  if (!auth.authenticated) {
    res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Authentication required' 
    });
    return null;
  }
  
  return auth.user;
}

/**
 * Middleware to require admin role
 * @param {Request} req
 * @param {Response} res
 * @returns {object|null} - Returns user object if admin, sends error and returns null otherwise
 */
function requireAdmin(req, res) {
  const user = requireAuth(req, res);
  
  if (!user) return null; // Already sent 401
  
  if (user.role !== 'admin') {
    res.status(403).json({ 
      error: 'Forbidden',
      message: 'Admin access required' 
    });
    return null;
  }
  
  return user;
}

/**
 * Check if user owns a specific hive
 * @param {object} user - User object from verifyAuth
 * @param {string} hiveId - Hive ID to check
 * @returns {boolean}
 */
function userOwnsHive(user, hiveId) {
  if (!user || !hiveId) return false;
  if (user.role === 'admin') return true; // Admins have access to all
  
  return user.ownedHives.some(h => {
    const id = typeof h === 'string' ? h : h?.id;
    return id === hiveId;
  });
}

module.exports = {
  verifyAuth,
  requireAuth,
  requireAdmin,
  userOwnsHive
};
