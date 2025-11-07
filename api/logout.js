export default function handler(req, res) {
  res.setHeader('Set-Cookie', 'auth-token=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
  res.json({ success: true });
}
