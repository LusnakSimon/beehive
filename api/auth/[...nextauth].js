const NextAuth = require('next-auth').default;
const GoogleProvider = require('next-auth/providers/google').default;
const GitHubProvider = require('next-auth/providers/github').default;
const { MongoDBAdapter } = require('@next-auth/mongodb-adapter');
const clientPromise = require('../lib/mongodb');
const User = require('../models/User');

module.exports = async (req, res) => {
  return await NextAuth(req, res, {
    // Configure OAuth providers
    providers: [
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      }),
      GitHubProvider({
        clientId: process.env.GITHUB_ID,
        clientSecret: process.env.GITHUB_SECRET,
      }),
    ],
    
    // Use MongoDB adapter for session storage
    adapter: MongoDBAdapter(clientPromise),
    
    // Configure session strategy
    session: {
      strategy: 'jwt',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    },
    
    // JWT configuration
    jwt: {
      maxAge: 30 * 24 * 60 * 60, // 30 days
    },
    
    // Custom pages
    pages: {
      signIn: '/login',
      error: '/login',
    },
    
    // Callbacks for customization
    callbacks: {
      async signIn({ user, account, profile }) {
        try {
          // Find or create user
          let dbUser = await User.findOne({ email: user.email });
          
          if (!dbUser) {
            // Create new user
            dbUser = await User.create({
              name: user.name || profile.name,
              email: user.email,
              image: user.image || profile.picture || profile.avatar_url,
              emailVerified: new Date(),
              accounts: [{
                provider: account.provider,
                providerAccountId: account.providerAccountId,
                type: account.type,
                access_token: account.access_token,
                refresh_token: account.refresh_token,
                expires_at: account.expires_at,
                token_type: account.token_type,
                scope: account.scope,
                id_token: account.id_token,
              }],
              ownedHives: [],
              role: 'user',
              lastLogin: new Date(),
            });
          } else {
            // Update existing user
            const accountExists = dbUser.accounts.some(
              acc => acc.provider === account.provider && 
                     acc.providerAccountId === account.providerAccountId
            );
            
            if (!accountExists) {
              dbUser.accounts.push({
                provider: account.provider,
                providerAccountId: account.providerAccountId,
                type: account.type,
                access_token: account.access_token,
                refresh_token: account.refresh_token,
                expires_at: account.expires_at,
                token_type: account.token_type,
                scope: account.scope,
                id_token: account.id_token,
              });
            }
            
            dbUser.lastLogin = new Date();
            await dbUser.save();
          }
          
          return true;
        } catch (error) {
          console.error('Error in signIn callback:', error);
          return false;
        }
      },
      
      async jwt({ token, user, account }) {
        // Add user info to token on first sign in
        if (user) {
          const dbUser = await User.findOne({ email: user.email });
          token.id = dbUser._id.toString();
          token.role = dbUser.role;
          token.ownedHives = dbUser.ownedHives;
        }
        return token;
      },
      
      async session({ session, token }) {
        // Add custom fields to session
        if (token) {
          session.user.id = token.id;
          session.user.role = token.role;
          session.user.ownedHives = token.ownedHives;
        }
        return session;
      },
    },
    
    // Events for logging
    events: {
      async signIn({ user }) {
        console.log(`User signed in: ${user.email}`);
      },
      async signOut({ token }) {
        console.log(`User signed out: ${token.email}`);
      },
    },
    
    // Enable debug in development
    debug: process.env.NODE_ENV === 'development',
  });
};
