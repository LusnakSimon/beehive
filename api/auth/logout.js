module.exports = async (req, res) => {
  // Support clearing the auth cookie
  res.setHeader('Set-Cookie', 'auth-token=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
  return res.json({ success: true, message: 'Logged out successfully' });
};
