# Beehive Monitor - Rýchly štart

## 🚀 Čo je hotové

✅ **React PWA frontend** - Dashboard, História, Nastavenia
✅ **Express backend** - REST API s MongoDB
✅ **ESP32-C3 kód** - Arduino sketch pre senzory
✅ **Offline režim** - Service Worker s caching
✅ **Real-time grafy** - Recharts vizualizácia
✅ **API autentifikácia** - API key pre ESP32

## 📁 Súbory

```
beehive-monitor/
├── client/                 # React PWA (port 3000)
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navigation.jsx
│   │   │   └── Navigation.css
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx      # 🏠 Hlavný dashboard
│   │   │   ├── Dashboard.css
│   │   │   ├── History.jsx        # 📊 Grafy a trendy
│   │   │   ├── History.css
│   │   │   ├── Settings.jsx       # ⚙️ Nastavenia
│   │   │   └── Settings.css
│   │   ├── App.jsx                # Routing + offline detection
│   │   └── main.jsx               # Entry point + SW
│   ├── vite.config.js             # PWA config
│   └── package.json
│
├── server/                 # Express API (port 5000)
│   ├── routes/
│   │   ├── sensor.js              # /api/sensor/*
│   │   └── esp32.js               # /api/esp32/*
│   ├── models/
│   │   └── Reading.js             # MongoDB schema
│   ├── index.js
│   ├── .env
│   └── package.json
│
├── arduino/                # ESP32-C3 kód
│   ├── beehive_monitor/
│   │   └── beehive_monitor.ino
│   └── README.md
│
└── scripts/
    └── test_data.sh               # Test data generator
```

## ⚡ Spustenie

### 1. Backend (Terminal 1)
```bash
cd beehive-monitor/server
npm install
npm run dev
# Server beží na http://localhost:5000
```

### 2. Frontend (Terminal 2)
```bash
cd beehive-monitor/client
npm install
npm run dev
# PWA beží na http://localhost:3000
```

### 3. Test dáta
```bash
# Jednorazové meranie
curl -X POST http://localhost:5000/api/esp32/data \
  -H "Content-Type: application/json" \
  -H "X-API-Key: beehive-secret-key-2024" \
  -d '{"temperature": 32.5, "humidity": 55, "weight": 48, "battery": 85}'

# Alebo použite test script
bash beehive-monitor/scripts/test_data.sh
```

## 📱 PWA Funkcie

- **Offline caching** - Funguje bez internetu
- **Inštalovateľná** - Pridať na plochu telefónu
- **Responsive** - Optimalizované pre mobil
- **Service Worker** - Auto-update
- **Manifest** - Ikony, téma, splash screen

## 🔌 API Endpoints

### Sensor API
- `GET /api/sensor/latest` - Posledné meranie
- `GET /api/sensor/history?range=24h` - História (24h/7d/30d)
- `GET /api/sensor/stats` - Štatistiky

### ESP32 API
- `POST /api/esp32/data` - Odoslanie dát
  - Header: `X-API-Key: beehive-secret-key-2024`
  - Body: `{temperature, humidity, weight, battery, hiveId}`

### Health
- `GET /api/health` - Status servera

## 🛠️ ESP32 Zapojenie

### DHT22 (Teplota & Vlhkosť)
- VCC → 3.3V
- GND → GND
- DATA → GPIO 4

### HX711 (Váha)
- VCC → 5V
- GND → GND
- DOUT → GPIO 5
- SCK → GPIO 6

### Konfigurácia v Arduino kóde:
```cpp
const char* ssid = "VASA_WIFI";
const char* password = "HESLO";
const char* serverUrl = "http://your-server.com/api/esp32/data";
```

## 📊 Dashboard Funkcie

### 🏠 Dashboard
- Real-time metriky (teplota, vlhkosť, hmotnosť, batéria)
- Status indikátor (optimálny/neoptimálny stav)
- Auto-refresh každých 30s
- Manuálne obnovenie

### 📈 História
- Grafy s Recharts
- Časové rozsahy: 24h, 7d, 30d
- Dual-axis graf (teplota + vlhkosť)
- Weight trend chart

### ⚙️ Nastavenia
- ID úľa
- Interval aktualizácie
- Optimálne rozsahy (teplota, vlhkosť)
- Notifikácie
- Info o aplikácii

## 🎨 Téma

- **Primary color**: #fbbf24 (amber/med)
- **Secondary**: #10b981 (green)
- **Danger**: #ef4444 (red)
- **Responsive breakpoint**: 768px

## 🔒 Bezpečnosť

- API key autentifikácia pre ESP32
- Rate limiting (100 req/15min)
- CORS enabled
- MongoDB connection string v .env

## 📦 Deployment

### Frontend (Vercel)
```bash
cd client
npm run build
# Deploy dist/ na Vercel
```

### Backend (Vercel Serverless)
- Upravte na Vercel Functions
- Alebo deploy na Railway/Render

### MongoDB
- Použite MongoDB Atlas (free tier)
- Upravte MONGODB_URI v .env

## 🐛 Debugging

### Backend logs
- Sériový výstup v termináli
- MongoDB connection status
- HTTP requesty s timestamps

### Frontend
- Browser DevTools → Application → Service Workers
- Network tab → offline simulation
- Console → SW registration status

## 📝 Ďalšie kroky

1. ✅ **Základná štruktúra** - HOTOVO
2. ✅ **PWA implementácia** - HOTOVO
3. ✅ **API endpoints** - HOTOVO
4. ✅ **ESP32 kód** - HOTOVO
5. ⏳ **Testing s reálnym ESP32**
6. ⏳ **MongoDB Atlas setup**
7. ⏳ **Vercel deployment**
8. ⏳ **Push notifikácie**
9. ⏳ **Alert systém**

## 📞 Support

Pri problémoch:
1. Skontrolujte terminál logy
2. Overte MongoDB connection
3. Skontrolujte API key v ESP32 kóde
4. Pozrite si browser console

## 🎓 Bakalárska práca

Tento projekt je súčasťou bakalárskej práce:
**"Inteligentný IoT systém na monitorovanie včelieho úľa"**

Autor: Simon Lušňák
Hardware: ESP32-C3
