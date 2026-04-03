# Cloudinary Setup Guide

Harvest photo uploads use **Cloudinary** on serverless platforms (Vercel) and local storage during development.

## Why Cloudinary?

- **Serverless compatible** — Vercel functions cannot write to `/public`
- **CDN hosting** — fast image delivery
- **Automatic optimization** — images are compressed automatically
- **Free tier** — 25 GB storage and 25 GB bandwidth per month

## Setup

### 1. Create a Cloudinary Account

1. Go to [cloudinary.com](https://cloudinary.com/)
2. Sign up (the Free plan is sufficient)
3. After logging in you will find your credentials on the Dashboard

### 2. Get API Credentials

On the Cloudinary Dashboard you will find:
- **Cloud Name** (e.g. `dxxxxxx`)
- **API Key** (e.g. `123456789012345`)
- **API Secret** (click "Reveal" to show it)

### 3. Add to `.env`

Local `.env` file:
```env
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

### 4. Add to Vercel Environment Variables

1. Go to Vercel Dashboard → Project Settings → Environment Variables
2. Add these 3 variables for **Production**, **Preview**, and **Development**:
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`

### 5. Redeploy

After adding the environment variables, redeploy:
```bash
git push origin main
```
or click "Redeploy" in the Vercel Dashboard.

## How It Works

### Local Development (without Cloudinary)
- Photos are saved to `public/uploads/`
- No additional configuration needed

### Production (Vercel with Cloudinary)
- Automatically detects the serverless environment
- Uploaded photos go directly to Cloudinary
- Returns CDN URLs (e.g. `https://res.cloudinary.com/...`)

### Production (Vercel without Cloudinary)
- Photo uploads will be disabled
- A warning will appear in the console

## Testing

### Test Locally
1. Start the app: `npm run dev`
2. Go to Harvests and add a harvest with a photo
3. Check `public/uploads/`

### Test on Vercel
1. Make sure Cloudinary credentials are in Vercel
2. Deploy the app
3. Add a harvest with a photo
4. Check the Network tab — URLs should come from Cloudinary

## Troubleshooting

### "File upload not available" error on Vercel
- Check that all 3 Cloudinary variables are in Vercel
- Redeploy the app after adding the variables
- Verify the variable names are correct

### Photos Not Saving
- Check Cloudinary Dashboard → Media Library
- Look at Vercel Logs for error messages
- Verify API credentials

### Photos Not Displaying
- Check the URL in the database (should be a Cloudinary URL)
- Check the browser Network tab
- Check CORS settings in Cloudinary (defaults should work)

## Limity Free Tier

- 25 GB storage
- 25 GB monthly bandwidth
- 25,000 transformácií mesačne

Pre väčšinu projektov je to dostačujúce. Môžeš upgradnúť later ak potrebuješ viac.

## Ďalšie info

- [Cloudinary Docs](https://cloudinary.com/documentation)
- [Node.js SDK](https://cloudinary.com/documentation/node_integration)
- [Multer Storage Cloudinary](https://github.com/affanshahid/multer-storage-cloudinary)
