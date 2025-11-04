# ⚙️ Vercel Environment Variables Setup

## Krok 1: Choďte do Vercel Dashboard

1. Otvorte: https://vercel.com/dashboard
2. Vyberte projekt: `beehive` alebo `sbeehive`
3. Kliknite na **Settings** tab
4. V ľavom menu kliknite na **Environment Variables**

## Krok 2: Pridajte MongoDB URI

### Variable 1: MONGODB_URI

**Key:** `MONGODB_URI`  
**Value:**
```
mongodb+srv://Vercel-Admin-dongfeng:atqNFcRNHjHQn9fO@dongfeng.ij0ylfc.mongodb.net/beehive-monitor?retryWrites=true&w=majority
```

**Environments:** ✅ Production, ✅ Preview, ✅ Development

⚠️ **DÔLEŽITÉ:** Musíte pridať `/beehive-monitor` do URI (názov databázy)!

### Variable 2: ESP32_API_KEY

**Key:** `ESP32_API_KEY`  
**Value:**
```
beehive-secret-key-2024
```

**Environments:** ✅ Production, ✅ Preview, ✅ Development

### Variable 3: STORE_MONGODB_URI (Optional - ak ju máte)

Ak ste už pridali `STORE_MONGODB_URI`, **premažte ju** a použite správny názov `MONGODB_URI`.

## Krok 3: Redeploy

Po pridaní/zmene environment variables musíte redeploy:

1. Choďte na **Deployments** tab
2. Nájdite posledný deployment
3. Kliknite na **⋯** (tri bodky)
4. Kliknite **Redeploy**
5. Alebo jednoducho pushne nový commit

## Krok 4: Overenie

Po deploye testujte:

### Health Check
```bash
curl https://sbeehive.vercel.app/api/health
```

Očakávaný output:
```json
{
  "status": "ok",
  "timestamp": "2025-11-04T...",
  "mongodb": "connected"
}
```

### Test ESP32 Endpoint
```bash
curl -X POST https://sbeehive.vercel.app/api/esp32/data \
  -H "Content-Type: application/json" \
  -H "X-API-Key: beehive-secret-key-2024" \
  -d '{
    "temperature": 33,
    "humidity": 56,
    "weight": 49,
    "battery": 90
  }'
```

### Test Latest Data
```bash
curl https://sbeehive.vercel.app/api/sensor/latest
```

## Troubleshooting

### "mongodb": "disconnected"

**Riešenie:**
1. Skontrolujte či `MONGODB_URI` obsahuje `/beehive-monitor` (database name)
2. Overte že URI je správna v Vercel Settings
3. V MongoDB Atlas → Network Access → pridajte `0.0.0.0/0` (Allow from anywhere)

### API Returns 500

**Riešenie:**
1. Vercel Dashboard → Deployments → View Function Logs
2. Pozrite chybovú hlášku
3. Overte že obe env variables sú nastavené

### Frontend sa nezobrazuje

**Riešenie:**
1. Overte že `outputDirectory` je `client/dist`
2. Skontrolujte Vercel Build Logs
3. Vyčistite cache a redeploy

## Správna URL Struktura

Po správnom deploye:

- Frontend: `https://sbeehive.vercel.app/`
- API Health: `https://sbeehive.vercel.app/api/health`
- Sensor Data: `https://sbeehive.vercel.app/api/sensor/latest`
- ESP32 POST: `https://sbeehive.vercel.app/api/esp32/data`

---

## ✅ Checklist

- [ ] MONGODB_URI nastavený (s `/beehive-monitor`)
- [ ] ESP32_API_KEY nastavený
- [ ] MongoDB Atlas IP Whitelist: `0.0.0.0/0`
- [ ] Redeploy po zmene env vars
- [ ] Test /api/health vracia "connected"
- [ ] Frontend sa zobrazuje na root URL
- [ ] Dashboard, History, Settings fungujú

---

**Po dokončení týchto krokov by malo všetko fungovať!** 🚀🐝
