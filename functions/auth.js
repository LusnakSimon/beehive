const NextAuth = require('next-auth').default;
const GoogleProvider = require('next-auth/providers/google').default;
const GitHubProvider = require('next-auth/providers/github').default;
const { MongoDBAdapter } = require('@next-auth/mongodb-adapter');
const clientPromise = require('../api/lib/mongodb');
const User = require('../api/models/User');

const authHandler = async (req, res) => {
  return await NextAuth(req, res, {
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
    
    adapter: MongoDBAdapter(clientPromise),
    
    session: {
      strategy: 'jwt',
      maxAge: 30 * 24 * 60 * 60,
    },
    
    jwt: {
      maxAge: 30 * 24 * 60 * 60,
    },
    
    pages: {
      signIn: '/login',
      error: '/login',
    },
    
    callbacks: {
      async signIn({ user, account, profile }) {
        try {
          let dbUser = await User.findOne({ email: user.email });
          
          if (!dbUser) {
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
        if (user) {
          const dbUser = await User.findOne({ email: user.email });
          token.id = dbUser._id.toString();
          token.role = dbUser.role;
          token.ownedHives = dbUser.ownedHives;
        }
        return token;
      },
      
      async session({ session, token }) {
        if (token) {
          session.user.id = token.id;
          session.user.role = token.role;
          session.user.ownedHives = token.ownedHives;
        }
        return session;
      },
    },
    
    events: {
      async signIn({ user }) {
        console.log(`User signed in: ${user.email}`);
      },
      async signOut({ token }) {
        console.log(`User signed out: ${token.email}`);
      },
    },
    
    debug: process.env.NODE_ENV === 'development',
  });
};

module.exports = authHandler;
