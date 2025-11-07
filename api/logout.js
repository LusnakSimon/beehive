module.exports = async (req, res) => {
  // Clear the auth cookie
  res.setHeader('Set-Cookie', 'auth-token=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
  res.json({ success: true, message: 'Logged out successfully' });
};
