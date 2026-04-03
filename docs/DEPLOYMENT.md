# Deployment Guide — Vercel + MongoDB Atlas

## Prerequisites

- GitHub repository with the project pushed
- MongoDB Atlas cluster with a database
- Google and/or GitHub OAuth app credentials
- Vercel account linked to GitHub

## 1. Vercel Setup

### Via Vercel Dashboard

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import the GitHub repository
3. Configure:
   - **Framework Preset**: Vite
   - **Root Directory**: `./`
   - **Build Command**: `cd client && npm install && npm run build`
   - **Output Directory**: `client/dist`

### Via Vercel CLI

```bash
npm install -g vercel
vercel login
vercel          # preview deploy
vercel --prod   # production deploy
```

## 2. Environment Variables

Add these in Vercel Dashboard → Project Settings → Environment Variables:

```
MONGODB_URI=<your-mongodb-atlas-connection-string>
JWT_SECRET=<random-secret>
NEXTAUTH_SECRET=<random-secret>
NEXTAUTH_URL=https://your-app.vercel.app
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
GITHUB_ID=<your-github-client-id>
GITHUB_SECRET=<your-github-client-secret>
```

Optional (for harvest photo uploads):
```
CLOUDINARY_CLOUD_NAME=<your-cloud-name>
CLOUDINARY_API_KEY=<your-api-key>
CLOUDINARY_API_SECRET=<your-api-secret>
```

## 3. ESP32 Gateway Configuration

After deploying, update the gateway firmware with your production URL:

```cpp
const char* SERVER_HOST = "your-app.vercel.app";
const char* API_KEY = "your-api-key-from-app";
```

Get the API key from the app: My Hives → Edit hive → Device type: API → Copy key.

## 4. Verifying the Deploy

**Test the API:**
```bash
curl -X POST https://your-app.vercel.app/api/sensor \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"temperature": 32.5, "humidity": 55.2, "weight": 48.75}'
```

**Test the frontend:**
1. Open the app URL
2. Log in with Google/GitHub
3. Check the Dashboard for sensor data
4. Test offline mode (DevTools → Network → Offline)

## 5. Continuous Deployment

Every push to `main` is automatically deployed by Vercel:

```bash
git push origin main
```

## Security Notes

- All secrets are stored in Vercel environment variables, never in code
- MongoDB Atlas IP whitelist should include `0.0.0.0/0` for Vercel serverless
- Rate limiting is active on the sensor endpoint (100 req/15 min)

## Troubleshooting

### Build Failed
```bash
# Test the build locally:
cd client
npm run build
# Check for errors
```

### MongoDB Connection Failed
- Check the IP Whitelist in Atlas (`0.0.0.0/0`)
- Verify the connection string in Environment Variables
- Check the database name in the URI

### API Returns 500
- Check Vercel Logs (Dashboard → Functions → View Logs)
- Verify MongoDB is connected
- Verify the API Key in the header

### PWA Offline Not Working
- Clear cache (DevTools → Application → Clear storage)
- Check Service Worker registration
- Verify the `manifest.json` path

## Support

**Vercel Issues**: https://vercel.com/support
**MongoDB Atlas**: https://www.mongodb.com/docs/atlas/

## Post-Deployment Checklist

1. Deploy to Vercel
2. Test all API endpoints
3. Flash the ESP32 with the production URL
4. Test PWA on mobile (Add to Home Screen)
5. Set up MongoDB alerts
6. ⏳ Nastaviť Vercel Analytics
7. ⏳ Dokumentovať produkčnú URL

## 🌐 Production URLs

Po deploye:
- **Frontend**: `https://ebeehive.vercel.app`
- **API**: `https://ebeehive.vercel.app/api/*`
- **Sensor Endpoint**: `https://ebeehive.vercel.app/api/sensor`

Poznačte si tieto URLs do dokumentácie projektu!
