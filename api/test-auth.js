export default function handler(req, res) {
  res.json({
    hasGoogleId: !!process.env.GOOGLE_CLIENT_ID,
    hasGoogleSecret: !!process.env.GOOGLE_CLIENT_SECRET,
    hasGithubId: !!process.env.GITHUB_ID,
    hasGithubSecret: !!process.env.GITHUB_SECRET,
    hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
    nodeVersion: process.version,
  });
}
