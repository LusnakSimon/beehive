export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const redirectUri = `${process.env.NEXTAUTH_URL || 'https://ebeehive.vercel.app'}/api/oauth-callback`;
  
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_ID,
    redirect_uri: redirectUri,
    scope: 'read:user user:email',
  });

  const authUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;
  
  res.redirect(authUrl);
}
