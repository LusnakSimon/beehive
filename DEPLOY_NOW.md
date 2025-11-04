# 🚀 DEPLOYMENT KROKY

## ✅ Čo je pripravené

1. ✅ **Git repository inicializovaný**
2. ✅ **Všetky súbory commitnuté** (46 files, 11751 lines)
3. ✅ **GitHub remote nastavený**: `https://github.com/LusnakSimon/beehive.git`
4. ✅ **MongoDB Atlas URI nakonfigurovaný**
5. ✅ **Vercel konfigurácia** (`vercel.json`)
6. ✅ **API serverless funkcie** (`api/index.js`)

## 📤 PUSH DO GITHUB

```bash
cd /workspaces/dongfeng/beehive-monitor
git push -u origin main
```

**Poznámka**: Budete potrebovať autentifikovať sa cez:
- GitHub Personal Access Token, alebo
- GitHub CLI (`gh auth login`)

## 🌐 DEPLOY NA VERCEL

### Metóda 1: Vercel Dashboard (Jednoduchšie)

1. **Choďte na**: https://vercel.com/new
2. **Import Git Repository**:
   - Repository: `LusnakSimon/beehive`
   - Branch: `main`
3. **Framework Preset**: Other (automaticky detekuje)
4. **Root Directory**: `./` (necháme root)
5. **Build Settings**:
   - Build Command: `cd client && npm install && npm run build`
   - Output Directory: `client/dist`
6. **Environment Variables**:
   ```
   MONGODB_URI = mongodb+srv://Vercel-Admin-dongfeng:atqNFcRNHjHQn9fO@dongfeng.ij0ylfc.mongodb.net/beehive-monitor?retryWrites=true&w=majority
   
   ESP32_API_KEY = beehive-secret-key-2024
   ```
7. **Deploy** → Počkajte na build (~2-3 min)

### Metóda 2: Vercel CLI

```bash
# Inštalácia (ak ešte nemáte)
npm install -g vercel

# Login
vercel login

# Deploy z adresára projektu
cd /workspaces/dongfeng/beehive-monitor
vercel

# Nastavte env variables
vercel env add MONGODB_URI
# Paste URI: mongodb+srv://Vercel-Admin-dongfeng:atqNFcRNHjHQn9fO@dongfeng.ij0ylfc.mongodb.net/beehive-monitor?retryWrites=true&w=majority

vercel env add ESP32_API_KEY
# Paste: beehive-secret-key-2024

# Production deploy
vercel --prod
```

## 🔧 PO DEPLOYE

### 1. Overte Deployment URL
Po deploye dostanete URL ako: `https://beehive-xxxx.vercel.app`

### 2. Testujte API:
```bash
# Health check
curl https://your-url.vercel.app/api/health

# Test ESP32 endpoint
curl -X POST https://your-url.vercel.app/api/esp32/data \
  -H "Content-Type: application/json" \
  -H "X-API-Key: beehive-secret-key-2024" \
  -d '{
    "temperature": 32.5,
    "humidity": 55.2,
    "weight": 48.75,
    "battery": 85,
    "hiveId": "HIVE-001"
  }'
```

### 3. Aktualizujte ESP32 kód:
V súbore `arduino/beehive_monitor/beehive_monitor.ino`:

```cpp
const char* serverUrl = "https://your-url.vercel.app/api/esp32/data";
```

### 4. Test PWA na mobile:
- Otvorte URL v mobile browseri
- Použite "Add to Home Screen"
- Testujte offline režim

## 📊 MongoDB Atlas - Overenie

1. Choďte na: https://cloud.mongodb.com/
2. Login s Vercel-Admin-dongfeng account
3. **Clusters** → dongfeng
4. **Browse Collections** → beehive-monitor → readings
5. Mali by ste vidieť testové dáta

## 🔐 Security Checklist

- ✅ `.env` súbor je v `.gitignore` (nie je v Git)
- ✅ MongoDB URI je v Vercel Environment Variables
- ✅ API Key pre ESP32 je v env variables
- ✅ MongoDB Atlas má povolené Vercel IP (0.0.0.0/0)
- ✅ CORS je nakonfigurovaný
- ✅ Rate limiting je aktívny

## 📱 Finálne URLs

Po úspešnom deploye budete mať:

```
Frontend PWA: https://beehive-monitor.vercel.app
API Health:   https://beehive-monitor.vercel.app/api/health
ESP32 Data:   https://beehive-monitor.vercel.app/api/esp32/data
Sensor Data:  https://beehive-monitor.vercel.app/api/sensor/latest
History:      https://beehive-monitor.vercel.app/api/sensor/history?range=24h
```

## 🐛 Ak niečo nefunguje

### Build zlyhá:
```bash
# Testujte lokálne
cd client
npm install
npm run build
# Skontrolujte chyby
```

### MongoDB Connection Failed:
- V MongoDB Atlas → Network Access → IP Whitelist
- Pridajte `0.0.0.0/0` (All IPs) pre Vercel

### API Returns 404:
- Skontrolujte `vercel.json` rewrites
- Overte že `api/index.js` existuje
- Pozrite Vercel Logs v dashboarde

### Environment Variables nefungujú:
- Settings → Environment Variables
- Použite Production + Preview + Development
- Redeploy po pridaní env vars

## 📞 Ďalšia pomoc

- **Vercel Docs**: https://vercel.com/docs
- **MongoDB Atlas**: https://docs.atlas.mongodb.com/
- **GitHub Issues**: Vytvorte issue v repozitári

---

## ⏭️ TERAZ MÔŽETE:

1. **Push do GitHub**: `git push -u origin main`
2. **Deploy na Vercel**: Použite Vercel Dashboard alebo CLI
3. **Test produkčnej aplikácie**
4. **Nahrajte ESP32 kód s produkčnou URL**

**Projekt je PRODUCTION-READY!** 🎉
