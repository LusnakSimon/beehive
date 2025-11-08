import jwt from 'jsonwebtoken';
const mongoose = require('mongoose');

let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('MONGODB_URI not found');
    }
    cached.promise = mongoose.connect(uri, {
      bufferCommands: false,
      maxPoolSize: 10,
    });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

// Generate unique hive ID for new user
async function generateUniqueHiveId(User) {
  // Find highest hive number in use
  const allUsers = await User.find({}, 'ownedHives');
  const allHives = allUsers.flatMap(u => u.ownedHives || []);
  
  // Extract numbers from HIVE-XXX format (handle both string and object format)
  const hiveNumbers = allHives
    .map(h => {
      const hiveId = typeof h === 'string' ? h : h?.id;
      if (!hiveId || typeof hiveId !== 'string') return NaN;
      return parseInt(hiveId.replace('HIVE-', ''));
    })
    .filter(n => !isNaN(n));
  
  // Find next available number
  const maxNumber = hiveNumbers.length > 0 ? Math.max(...hiveNumbers) : 0;
  const nextNumber = maxNumber + 1;
  
  return `HIVE-${String(nextNumber).padStart(3, '0')}`;
}

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

    // Connect to MongoDB
    await connectDB();
    const User = require('../lib/models/User.js');

    // Find or create user in database
    let dbUser = await User.findOne({ email: userInfo.email });
    
    if (!dbUser) {
      // Create new user with unique hive
      const firstHiveId = await generateUniqueHiveId(User);
      
      dbUser = new User({
        email: userInfo.email,
        name: userInfo.name,
        image: userInfo.picture || userInfo.avatar_url,
        role: 'user',
        ownedHives: [{
          id: firstHiveId,
          name: `Úľ ${firstHiveId.replace('HIVE-', '')}`,
          location: 'Domov',
          color: '#fbbf24'
        }]
      });
      await dbUser.save();
      console.log(`✅ New user created: ${userInfo.email} with hive: ${firstHiveId}`);
    } else {
      // Update existing user info
      dbUser.name = userInfo.name;
      dbUser.image = userInfo.picture || userInfo.avatar_url;
      
      // If existing user has no hives, assign unique hive
      if (!dbUser.ownedHives || dbUser.ownedHives.length === 0) {
        const firstHiveId = await generateUniqueHiveId(User);
        dbUser.ownedHives = [{
          id: firstHiveId,
          name: `Úľ ${firstHiveId.replace('HIVE-', '')}`,
          location: 'Domov',
          color: '#fbbf24'
        }];
        console.log(`✅ Assigned hive to existing user: ${userInfo.email} - ${firstHiveId}`);
      }
      
      await dbUser.save();
    }

    // Create JWT token
    const token = jwt.sign(
      {
        id: dbUser._id.toString(),
        email: dbUser.email,
        name: dbUser.name,
        image: dbUser.image,
        provider: userInfo.provider,
        role: dbUser.role || 'user',
        ownedHives: dbUser.ownedHives || []
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
