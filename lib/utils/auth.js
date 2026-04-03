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
        name: userData.name,
        ownedHives: userData.ownedHives || userData.hiveIds || []
      }
    };
  } catch (err) {
    // Token expired or invalid
    return { authenticated: false, user: null };
  }
}

/**
 * Check if user owns a specific hive
 * @param {object} user - User object from verifyAuth
 * @param {string} hiveId - Hive ID to check
 * @returns {boolean}
 */
function userOwnsHive(user, hiveId) {
  if (!user || !hiveId) return false;
  
  // Handle case where ownedHives is undefined or not an array
  const hives = user.ownedHives || [];
  if (!Array.isArray(hives)) return false;
  
  return hives.some(h => {
    const id = typeof h === 'string' ? h : h?.id;
    return id === hiveId;
  });
}

module.exports = {
  verifyAuth,
  userOwnsHive
};
