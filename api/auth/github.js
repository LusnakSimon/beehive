module.exports = async (req, res) => {
  const redirectUri = `${process.env.NEXTAUTH_URL || 'https://ebeehive.vercel.app'}/api/auth/callback`;
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_ID,
    redirect_uri: redirectUri,
    scope: 'read:user user:email',
    state: 'github'
  });
  const authUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;
  return res.redirect(authUrl);
};
