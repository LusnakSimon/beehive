import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  const { code, error } = req.query;

  if (error) {
    return res.redirect(`/login?error=${error}`);
  }

  if (!code) {
    return res.status(400).json({ error: 'No authorization code provided' });
  }

  try {
    // Determine provider from state or referer
    const referer = req.headers.referer || '';
    const provider = referer.includes('google') ? 'google' : 'github';
    
    let userInfo;

    if (provider === 'google') {
      // Exchange code for tokens
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          redirect_uri: `${process.env.NEXTAUTH_URL || 'https://ebeehive.vercel.app'}/api/oauth-callback`,
          grant_type: 'authorization_code',
        }),
      });

      const tokens = await tokenResponse.json();
      
      if (!tokens.access_token) {
        throw new Error('No access token received');
      }

      // Get user info
      const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });

      userInfo = await userResponse.json();
      userInfo.provider = 'google';
    } else {
      // GitHub
      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          client_id: process.env.GITHUB_ID,
          client_secret: process.env.GITHUB_SECRET,
          code,
        }),
      });

      const tokens = await tokenResponse.json();
      
      if (!tokens.access_token) {
        throw new Error('No access token received');
      }

      // Get user info
      const userResponse = await fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });

      const user = await userResponse.json();
      
      userInfo = {
        id: user.id.toString(),
        email: user.email,
        name: user.name || user.login,
        picture: user.avatar_url,
        provider: 'github',
      };
    }

    // Create JWT token
    const token = jwt.sign(
      {
        id: userInfo.id,
        email: userInfo.email,
        name: userInfo.name,
        image: userInfo.picture || userInfo.avatar_url,
        provider: userInfo.provider,
        role: 'user',
        ownedHives: [],
      },
      process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Set cookie and redirect
    res.setHeader('Set-Cookie', `auth-token=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`);
    res.redirect('/');
  } catch (err) {
    console.error('OAuth callback error:', err);
    res.redirect(`/login?error=callback_error&message=${encodeURIComponent(err.message)}`);
  }
}
