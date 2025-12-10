// Auth handler v2 - updated 2025-01-27
const jwt = require('jsonwebtoken');
const { connectDB } = require('../../lib/utils/db');

// Lazy load User model to avoid mongoose initialization issues
let User;
function getUser() {
  if (!User) {
    User = require('../../lib/models/User');
  }
  return User;
}

// Generate unique hive ID for new user
async function generateUniqueHiveId() {
  const UserModel = getUser();
  const allUsers = await UserModel.find({}, 'ownedHives');
  const allHives = allUsers.flatMap(u => u.ownedHives || []);
  const hiveNumbers = allHives
    .map(h => {
      const hiveId = typeof h === 'string' ? h : h?.id;
      if (!hiveId || typeof hiveId !== 'string') return NaN;
      return parseInt(hiveId.replace('HIVE-', ''));
    })
    .filter(n => !isNaN(n));
  
  const maxNumber = hiveNumbers.length > 0 ? Math.max(...hiveNumbers) : 0;
  const nextNumber = maxNumber + 1;
  
  return `HIVE-${String(nextNumber).padStart(3, '0')}`;
}

module.exports = async function handler(req, res) {
  try {
    const path = req.query.path ? req.query.path.join('/') : '';

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      return res.status(200).end();
    }

    // Route: /api/auth/logout
    if (path === 'logout') {
      res.setHeader('Set-Cookie', 'auth-token=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
      return res.json({ success: true, message: 'Logged out successfully' });
    }

  // Route: /api/auth/github
  if (path === 'github') {
    const redirectUri = `${process.env.NEXTAUTH_URL || 'https://ebeehive.vercel.app'}/api/auth/callback`;
    const params = new URLSearchParams({
      client_id: process.env.GITHUB_ID,
      redirect_uri: redirectUri,
      scope: 'read:user user:email',
      state: 'github'
    });
    const authUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;
    return res.redirect(authUrl);
  }

  // Route: /api/auth/google
  if (path === 'google') {
    try {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      if (!clientId) {
        return res.status(500).json({ error: 'GOOGLE_CLIENT_ID not configured' });
      }
      const redirectUri = `${process.env.NEXTAUTH_URL || 'https://ebeehive.vercel.app'}/api/auth/callback`;
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        access_type: 'offline',
        prompt: 'consent',
        state: 'google'
      });
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
      return res.redirect(authUrl);
    } catch (err) {
      console.error('Google auth error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  // Route: /api/auth/callback
  if (path === 'callback') {
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
      const provider = req.query.state || (referer.includes('google') ? 'google' : 'github');
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
            redirect_uri: `${process.env.NEXTAUTH_URL || 'https://ebeehive.vercel.app'}/api/auth/callback`,
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
            redirect_uri: `${process.env.NEXTAUTH_URL || 'https://ebeehive.vercel.app'}/api/auth/callback`,
          }),
        });

        const { access_token } = await tokenResponse.json();

        if (!access_token) {
          throw new Error('No access token received');
        }

        // Get user info
        const userResponse = await fetch('https://api.github.com/user', {
          headers: {
            Authorization: `Bearer ${access_token}`,
            Accept: 'application/vnd.github.v3+json',
          },
        });

        const githubUser = await userResponse.json();

        // Get user emails
        const emailResponse = await fetch('https://api.github.com/user/emails', {
          headers: {
            Authorization: `Bearer ${access_token}`,
            Accept: 'application/vnd.github.v3+json',
          },
        });

        const emails = await emailResponse.json();
        const primaryEmail = emails.find(e => e.primary)?.email || emails[0]?.email;

        userInfo = {
          id: githubUser.id.toString(),
          email: primaryEmail,
          name: githubUser.name || githubUser.login,
          picture: githubUser.avatar_url,
          provider: 'github',
        };
      }

      // Connect to database
      await connectDB();
      const UserModel = getUser();

      // Find or create user
      let user = await UserModel.findOne({ 
        $or: [
          { email: userInfo.email },
          { [`oauth.${userInfo.provider}.id`]: userInfo.id }
        ]
      });

      if (!user) {
        // Generate unique hive ID for new user
        const firstHiveId = await generateUniqueHiveId();
        
        user = new UserModel({
          username: userInfo.email.split('@')[0],
          email: userInfo.email,
          name: userInfo.name,
          avatar: userInfo.picture,
          oauth: {
            [userInfo.provider]: {
              id: userInfo.id,
              email: userInfo.email,
            }
          },
          ownedHives: [firstHiveId],
        });
        await user.save();
      } else {
        // Update OAuth info if provider changed
        if (!user.oauth) user.oauth = {};
        user.oauth[userInfo.provider] = {
          id: userInfo.id,
          email: userInfo.email,
        };
        if (userInfo.picture && !user.avatar) {
          user.avatar = userInfo.picture;
        }
        await user.save();
      }

      // Create JWT token with all user data
      const token = jwt.sign(
        { 
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          image: user.avatar,
          role: user.role || 'user',
          ownedHives: user.ownedHives || []
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      // Set cookie and redirect
      res.setHeader('Set-Cookie', `auth-token=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`);
      res.redirect('/');
    } catch (error) {
      console.error('OAuth callback error:', error);
      res.redirect(`/login?error=${encodeURIComponent(error.message)}`);
    }
  } else {
    // Unknown path
    res.status(404).json({ error: 'Not found' });
  }
  } catch (outerError) {
    console.error('Auth handler fatal error:', outerError);
    return res.status(500).json({ 
      error: 'Auth handler error', 
      message: outerError.message,
      stack: process.env.NODE_ENV !== 'production' ? outerError.stack : undefined
    });
  }
};
