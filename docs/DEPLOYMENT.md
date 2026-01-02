# Deployment Guide - Vercel + MongoDB Atlas

## 📦 Príprava projektu

### 1. GitHub Repository
```bash
cd /workspaces/dongfeng/beehive-monitor
git init
git add .
git commit -m "Initial commit: Beehive Monitor PWA"
git branch -M main
git remote add origin https://github.com/LusnakSimon/beehive.git
git push -u origin main
```

## ☁️ MongoDB Atlas Setup

### Database už je pripravená ✅
- **URI**: `mongodb+srv://Vercel-Admin-dongfeng:atqNFcRNHjHQn9fO@dongfeng.ij0ylfc.mongodb.net/beehive-monitor?retryWrites=true&w=majority`
- **Database**: `beehive-monitor`
- **Cluster**: `dongfeng`

### Overenie connection:
```bash
cd server
node -e "const mongoose = require('mongoose'); mongoose.connect(process.env.MONGODB_URI).then(() => console.log('✅ Connected')).catch(e => console.error('❌', e))"
```

## 🚀 Vercel Deployment

### Option 1: Vercel CLI (Odporúčané)

#### Inštalácia Vercel CLI:
```bash
npm install -g vercel
```

#### Login do Vercel:
```bash
vercel login
```

#### Deploy:
```bash
cd /workspaces/dongfeng/beehive-monitor
vercel
```

Pri prvom deploye Vercel sa spýta:
- **Set up and deploy?** → Yes
- **Which scope?** → Vyberte váš account
- **Link to existing project?** → No
- **Project name?** → beehive-monitor
- **Directory?** → `./` (root)
- **Override settings?** → No

#### Nastavenie Environment Variables:
```bash
vercel env add MONGODB_URI
# Paste: mongodb+srv://Vercel-Admin-dongfeng:atqNFcRNHjHQn9fO@dongfeng.ij0ylfc.mongodb.net/beehive-monitor?retryWrites=true&w=majority

vercel env add ESP32_API_KEY
# Paste: beehive-secret-key-2024
```

#### Production Deploy:
```bash
vercel --prod
```

### Option 2: Vercel Dashboard (Web UI)

1. **Choďte na**: https://vercel.com/new
2. **Import Git Repository**: https://github.com/LusnakSimon/beehive
3. **Configure Project**:
   - **Framework Preset**: Vite
   - **Root Directory**: `./` (root)
   - **Build Command**: `cd client && npm install && npm run build`
   - **Output Directory**: `client/dist`
   - **Install Command**: `npm install`

4. **Environment Variables** (Settings → Environment Variables):
   ```
   MONGODB_URI = mongodb+srv://Vercel-Admin-dongfeng:atqNFcRNHjHQn9fO@dongfeng.ij0ylfc.mongodb.net/beehive-monitor?retryWrites=true&w=majority
   ESP32_API_KEY = beehive-secret-key-2024
   ```

5. **Deploy** → Wait for build to complete

## 🔧 Vercel Configuration

### vercel.json (už vytvorený)
```json
{
  "version": 2,
  "builds": [
    {
      "src": "client/package.json",
      "use": "@vercel/static-build",
      "config": { "distDir": "dist" }
    },
    {
      "src": "server/index.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/server/index.js"
    },
    {
      "src": "/(.*)",
      "dest": "/client/$1"
    }
  ]
}
```

## 📱 Aktualizácia ESP32 kódu

Po deploye aktualizujte Arduino gateway kód:

```cpp
// V beehive_gateway/beehive_gateway.ino zmeňte:
const char* SERVER_HOST = "ebeehive.vercel.app";
const char* HIVE_ID = "HIVE-001";  // Your hive ID
const char* API_KEY = "your-api-key-from-app"; // Get from hive settings
```

API kľúč získate v aplikácii: My Hives → Upraviť úľ → Typ zariadenia: API → Skopírovať kľúč

## 🧪 Testovanie po deploye

### Test API endpoint:
```bash
curl -X POST https://ebeehive.vercel.app/api/sensor \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "temperature": 32.5,
    "humidity": 55.2,
    "weight": 48.75,
    "battery": 85,
    "hiveId": "HIVE-001"
  }'
```

Očakávaná odpoveď:
```json
{
  "success": true,
  "message": "Dáta úspešne uložené",
  "id": "..."
}
```

### Test Frontend:
1. Otvorte: `https://your-project.vercel.app`
2. Skontrolujte Dashboard
3. Testujte offline režim (DevTools → Network → Offline)
4. Skúste "Add to Home Screen" na mobile

### Test MongoDB:
```bash
# V MongoDB Atlas Compass alebo GUI
# Collections → beehive-monitor → readings
# Mali by ste vidieť testové dáta
```

## 🔄 Continuous Deployment

Po nastavení je každý push do GitHub automaticky deploynutý:

```bash
git add .
git commit -m "Update feature"
git push origin main
# Vercel automaticky deployuje novu verziu
```

## 📊 Monitorovanie

### Vercel Dashboard:
- **Deployments** - História deployov
- **Analytics** - Návštevnosť PWA
- **Logs** - Runtime logy (funkcie, chyby)

### MongoDB Atlas:
- **Metrics** - Connection count, operations/sec
- **Performance Advisor** - Index recommendations
- **Alerts** - Nastavte upozornenia na limity

## 🔒 Security Checklist

✅ **Environment Variables** sú v Vercel Secrets, nie v kóde
✅ **MongoDB URI** obsahuje whitelist IP (0.0.0.0/0 pre Vercel)
✅ **API Key** pre ESP32 autentifikáciu
✅ **CORS** enabled len pre potrebné origins
✅ **Rate Limiting** aktívny (100 req/15min)

## 🐛 Troubleshooting

### Build Failed:
```bash
# Lokálne testovanie buildu:
cd client
npm run build
# Skontrolujte chyby
```

### MongoDB Connection Failed:
- Skontrolujte IP Whitelist v Atlas (0.0.0.0/0)
- Overte connection string v Environment Variables
- Skontrolujte database meno v URI

### API Returns 500:
- Pozrite Vercel Logs (Dashboard → Functions → View Logs)
- Skontrolujte či MongoDB je connected
- Overte API Key v headeri

### PWA Offline Not Working:
- Vyčistite cache (DevTools → Application → Clear storage)
- Skontrolujte Service Worker registration
- Overte manifest.json path

## 📞 Support

**Vercel Issues**: https://vercel.com/support
**MongoDB Atlas**: https://www.mongodb.com/docs/atlas/

## 🎯 Post-Deployment Tasks

1. ✅ Deploy na Vercel
2. ⏳ Test všetkých API endpoints
3. ⏳ Nahrať kód do ESP32 s produkčnou URL
4. ⏳ Test PWA na mobile (Add to Home Screen)
5. ⏳ Nastaviť MongoDB alerts
6. ⏳ Nastaviť Vercel Analytics
7. ⏳ Dokumentovať produkčnú URL

## 🌐 Production URLs

Po deploye:
- **Frontend**: `https://ebeehive.vercel.app`
- **API**: `https://ebeehive.vercel.app/api/*`
- **Sensor Endpoint**: `https://ebeehive.vercel.app/api/sensor`

Poznačte si tieto URLs do dokumentácie projektu!
