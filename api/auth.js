const NextAuth = require('next-auth').default;
const GoogleProvider = require('next-auth/providers/google').default;
const GitHubProvider = require('next-auth/providers/github').default;

module.exports = async (req, res) => {
  // Fix URL for NextAuth routing
  if (!req.url.startsWith('/api/auth')) {
    req.url = '/api/auth' + (req.url === '/' ? '' : req.url);
  }
  
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
    
    session: {
      strategy: 'jwt',
      maxAge: 30 * 24 * 60 * 60,
    },
    
    pages: {
      signIn: '/login',
      error: '/login',
    },
    
    callbacks: {
      async redirect({ url, baseUrl }) {
        if (url.startsWith('/')) return baseUrl + url;
        else if (new URL(url).origin === baseUrl) return url;
        return baseUrl + '/';
      },
      
      async session({ session, token }) {
        if (token) {
          session.user.id = token.sub;
          session.user.role = token.role || 'user';
          session.user.ownedHives = token.ownedHives || [];
        }
        return session;
      },
      
      async jwt({ token, user }) {
        if (user) {
          token.role = 'user';
          token.ownedHives = [];
        }
        return token;
      },
    },
    
    secret: process.env.NEXTAUTH_SECRET,
    debug: true,
  });
};
