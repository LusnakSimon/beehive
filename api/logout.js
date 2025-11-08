module.exports = async (req, res) => {
  // Support both GET and POST
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }
  
  // Clear the auth cookie
  res.setHeader('Set-Cookie', 'auth-token=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
  res.json({ success: true, message: 'Logged out successfully' });
};
