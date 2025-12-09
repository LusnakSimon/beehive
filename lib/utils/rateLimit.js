/**
 * Simple in-memory rate limiter for serverless environments
 * Note: This resets on cold starts - for production, use Redis/Upstash
 */

// Store: { key: { count: number, resetTime: number } }
const store = new Map();

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of store.entries()) {
    if (now > value.resetTime) {
      store.delete(key);
    }
  }
}, 60000); // Clean every minute

/**
 * Rate limit configuration
 */
const LIMITS = {
  auth: { windowMs: 15 * 60 * 1000, max: 10 },      // 10 auth attempts per 15 min
  api: { windowMs: 60 * 1000, max: 100 },           // 100 requests per minute
  sensor: { windowMs: 60 * 1000, max: 60 },         // 60 sensor posts per minute (1/sec)
  friendRequest: { windowMs: 60 * 60 * 1000, max: 20 }, // 20 friend requests per hour
  message: { windowMs: 60 * 1000, max: 30 },        // 30 messages per minute
  search: { windowMs: 60 * 1000, max: 30 },         // 30 searches per minute
};

/**
 * Check rate limit
 * @param {string} key - Unique identifier (e.g., IP + endpoint)
 * @param {string} limitType - Type of limit from LIMITS
 * @returns {{ allowed: boolean, remaining: number, resetIn: number }}
 */
function checkRateLimit(key, limitType = 'api') {
  const config = LIMITS[limitType] || LIMITS.api;
  const now = Date.now();
  
  let record = store.get(key);
  
  if (!record || now > record.resetTime) {
    // Create new record
    record = {
      count: 1,
      resetTime: now + config.windowMs
    };
    store.set(key, record);
    return { 
      allowed: true, 
      remaining: config.max - 1,
      resetIn: Math.ceil(config.windowMs / 1000)
    };
  }
  
  // Increment count
  record.count++;
  
  if (record.count > config.max) {
    return { 
      allowed: false, 
      remaining: 0,
      resetIn: Math.ceil((record.resetTime - now) / 1000)
    };
  }
  
  return { 
    allowed: true, 
    remaining: config.max - record.count,
    resetIn: Math.ceil((record.resetTime - now) / 1000)
  };
}

/**
 * Get client IP from request (handles proxies)
 * @param {Request} req
 * @returns {string}
 */
function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         'unknown';
}

/**
 * Rate limit middleware
 * @param {Request} req
 * @param {Response} res
 * @param {string} limitType
 * @returns {boolean} - Returns true if rate limited (request handled)
 */
function rateLimit(req, res, limitType = 'api') {
  const ip = getClientIP(req);
  const key = `${ip}:${limitType}`;
  
  const result = checkRateLimit(key, limitType);
  
  // Set rate limit headers
  res.setHeader('X-RateLimit-Remaining', result.remaining);
  res.setHeader('X-RateLimit-Reset', result.resetIn);
  
  if (!result.allowed) {
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: result.resetIn
    });
    return true;
  }
  
  return false;
}

module.exports = {
  checkRateLimit,
  getClientIP,
  rateLimit,
  LIMITS
};
