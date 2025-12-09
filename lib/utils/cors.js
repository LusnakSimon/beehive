/**
 * Get allowed CORS origins based on environment
 * @returns {string[]}
 */
function getAllowedOrigins() {
  const origins = [
    'https://sbeehive.vercel.app',
    'https://ebeehive.vercel.app',
    process.env.NEXTAUTH_URL,
  ].filter(Boolean);

  // Add localhost in development
  if (process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV === 'development') {
    origins.push('http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:3000');
  }

  return origins;
}

/**
 * Set CORS headers on response
 * @param {Request} req
 * @param {Response} res
 * @returns {boolean} - Returns true if this was a preflight request that was handled
 */
function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  const allowedOrigins = getAllowedOrigins();
  
  // Check if origin is allowed
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    // Same-origin requests or non-browser clients
    res.setHeader('Access-Control-Allow-Origin', allowedOrigins[0] || '*');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  
  return false;
}

/**
 * Set CORS headers for public endpoints (IoT devices, webhooks)
 * More permissive for ESP32 and LoRaWAN devices
 * @param {Request} req
 * @param {Response} res
 * @returns {boolean}
 */
function setPublicCorsHeaders(req, res) {
  // IoT devices and webhooks may not send origin header
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  
  return false;
}

module.exports = {
  getAllowedOrigins,
  setCorsHeaders,
  setPublicCorsHeaders
};
