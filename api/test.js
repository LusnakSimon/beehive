module.exports = async (req, res) => {
  res.json({
    status: 'ok',
    message: 'Test endpoint works',
    env: {
      hasMongoDb: !!process.env.MONGODB_URI,
      hasGoogleId: !!process.env.GOOGLE_CLIENT_ID,
      hasGithubId: !!process.env.GITHUB_ID,
      hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
    }
  });
};
