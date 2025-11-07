import jwt from 'jsonwebtoken';

export default function handler(req, res) {
  const token = req.cookies?.['auth-token'];
  
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
}
