# Local Development Setup

## Option 1: MongoDB Atlas (Recommended)

1. **Create a `.env` file** in the project root:
```bash
cp .env.example .env
```

2. **Add your MongoDB Atlas URI** and other credentials to `.env` (see [.env.example](../.env.example) for all required variables).

3. **Start the development server**:
```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

## Option 2: Local MongoDB

1. **Install MongoDB** locally:
```bash
# Ubuntu/Debian
sudo apt install mongodb

# macOS
brew install mongodb-community
```

2. **Start MongoDB**:
```bash
mongod --dbpath ~/data/db
```

3. **Update `.env`** with the local URI:
```env
MONGODB_URI=mongodb://localhost:27017/beehive
```

## Verifying

1. Open http://localhost:5173
2. Log in with Google or GitHub
3. Go to My Hives and add a hive
4. Sensor data should appear on the Dashboard once the ESP32 (or simulator) starts sending

## Notes

- Production uses MongoDB Atlas (configured via Vercel environment variables)
- `.env` is in `.gitignore` — each developer creates their own
- OAuth requires redirect URLs configured in the Google/GitHub developer console (see [OAuth Setup](OAUTH_SETUP.md))
