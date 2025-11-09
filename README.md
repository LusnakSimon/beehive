# 🐝 Beehive Monitor - IoT PWA

Inteligentný IoT systém na monitorovanie včelieho úľa | Bachelor's Thesis Project

[![Deployed on Vercel](https://img.shields.io/badge/Deployed-Vercel-black)](https://sbeehive.vercel.app)
[![MongoDB Atlas](https://img.shields.io/badge/Database-MongoDB%20Atlas-green)](https://www.mongodb.com/atlas)
[![ESP32-C3](https://img.shields.io/badge/Hardware-ESP32--C3-blue)](https://www.espressif.com/en/products/socs/esp32-c3)

**Live Demo:** https://sbeehive.vercel.app

---

## ✨ Features

### � Multi-User Authentication
- **OAuth Login** - Sign in with Google or GitHub
- **User Profiles** - Personal dashboard with owned hives
- **Role-Based Access** - Admin panel for user management
- **Secure Sessions** - JWT-based authentication with HTTP-only cookies

### 🐝 Multi-Hive Management
- **Multiple Hives** - Monitor unlimited number of hives per account
- **Custom Names** - Personalize each hive with names and locations
- **Color Coding** - Visual identification with customizable colors
- **Hive Switching** - Easy navigation between your hives

### 🗺️ GPS Hive Mapping
- **Interactive Map** - View all your hives on OpenStreetMap
- **GPS Tracking** - Add coordinates manually or auto-detect location
- **Distance Calculation** - See distances between hives
- **Privacy Controls** - Set hives as private or public
- **Community View** - Discover public hives from other beekeepers

### 📊 Real-time Monitoring
- **Live Data** - Temperature, humidity & weight tracking from ESP32
- **Historical Charts** - Interactive graphs with Recharts
- **Smart Alerts** - Notifications for abnormal readings
- **Battery Monitor** - Track power/solar panel status

### 📝 Inspection Tracking
- **Digital Checklists** - Track pollen, brood, queen sightings
- **Inspection History** - View past inspections with timestamps
- **Notes System** - Add custom observations for each inspection
- **Per-Hive Records** - Separate inspection logs for each hive

### 📱 Progressive Web App
- **Installable** - Add to home screen on mobile
- **Offline Mode** - Service Worker caching
- **Push Notifications** - Real-time alerts
- **Responsive Design** - Works on all devices

### 🌐 LoRaWAN Support
- **Long-Range** - Monitor hives kilometers away
- **Low Power** - Months on battery
- **ESP32 Configuration** - Easy setup wizard in settings

---

## 🛠️ Tech Stack

### Frontend (PWA)
- **React 18.2** - UI Framework
- **Vite 5** - Build tool & Dev server  
- **React Router 6** - Client-side routing
- **Recharts 2.10** - Data visualization
- **React Leaflet 4.2** - Interactive maps with GPS
- **Leaflet 1.9** - Open-source mapping library
- **Service Worker** - Offline caching & Push notifications
- **Manifest.json** - PWA installability

### Backend (API)
- **Node.js 20+** + Express (development only)
- **Vercel Serverless Functions** - Production API
- **MongoDB Atlas** - Cloud database
- **Mongoose 8** - ODM for MongoDB
- **JWT** - Secure authentication
- **OAuth 2.0** - Google & GitHub login
- **CORS** - Cross-origin support

### IoT Hardware
- **ESP32-C3** - Wi-Fi microcontroller
- **DHT22** - Temperature & Humidity sensor
- **HX711** - Load cell amplifier (weight measurement)
- **LoRaWAN** - Long-range wireless (optional)
- **Arduino IDE** - Firmware programming
- **REST API** - HTTP data transmission

---

## 📁 Project Structure

```
beehive-monitor/
├── client/                      # React PWA Frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navigation.jsx   # Bottom/Top navigation bar
│   │   │   ├── HiveSelector.jsx # Multi-hive switcher
│   │   │   ├── ProtectedRoute.jsx # Auth guard
│   │   │   ├── VarroaReminder.jsx # Treatment alerts
│   │   │   └── NotificationSettings.jsx
│   │   ├── contexts/
│   │   │   ├── AuthContext.jsx  # OAuth authentication
│   │   │   ├── HiveContext.jsx  # Multi-hive state
│   │   │   └── NotificationContext.jsx
│   │   ├── pages/
│   │   │   ├── Login.jsx        # 🔐 OAuth login
│   │   │   ├── Dashboard.jsx    # 🏠 Real-time metrics
│   │   │   ├── History.jsx      # 📊 Historical charts
│   │   │   ├── Inspection.jsx   # 📝 Inspection tracking
│   │   │   ├── HiveMap.jsx      # 🗺️ GPS hive map
│   │   │   ├── Profile.jsx      # 👤 User profile
│   │   │   ├── Admin.jsx        # 👨‍💼 Admin panel
│   │   │   └── Settings.jsx     # ⚙️ Configuration
│   │   ├── App.jsx              # Main app with routing
│   │   ├── main.jsx             # Entry point + SW registration
│   │   └── index.css            # Global styles
│   ├── public/
│   │   ├── manifest.json        # PWA manifest
│   │   └── sw.js                # Service Worker
│   ├── vite.config.js
│   └── package.json
│
├── api/                         # Vercel Serverless Functions
│   ├── oauth-google.js          # Google OAuth
│   ├── oauth-github.js          # GitHub OAuth
│   ├── oauth-callback.js        # OAuth handler
│   ├── session.js               # Session check
│   ├── logout.js                # User logout
│   ├── sensor/[...path].js      # Sensor data endpoints
│   ├── inspection/[...path].js  # Inspection endpoints
│   └── users/[...path].js       # User/hive management
│
├── lib/                         # Shared Backend Logic
│   ├── models/
│   │   ├── User.js              # User schema with OAuth
│   │   ├── Reading.js           # Sensor data schema
│   │   └── Inspection.js        # Inspection schema
│   └── routes/
│       ├── users.js             # User & hive CRUD
│       ├── sensor.js            # Sensor data API
│       ├── inspection.js        # Inspection API
│       ├── esp32.js             # ESP32 data ingestion
│       └── lorawan.js           # LoRaWAN webhook
│
├── arduino/                     # ESP32 Firmware
│   ├── beehive_monitor/
│   │   └── beehive_monitor.ino  # WiFi version
│   ├── beehive_lorawan/
│   │   └── beehive_lorawan.ino  # LoRaWAN version
│   └── README.md
│
├── scripts/
│   └── simulate-esp32.js        # Device simulator
│
├── vercel.json                  # Vercel config
├── .env.example                 # Environment template
└── README.md                    # This file
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- MongoDB Atlas account (or local MongoDB)
- Google OAuth credentials (for authentication)

### Local Development

1. **Clone the repository**
```bash
git clone https://github.com/LusnakSimon/beehive.git
cd beehive-monitor
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required environment variables:
- `MONGODB_URI` - MongoDB connection string with `/beehive` database
- `JWT_SECRET` / `NEXTAUTH_SECRET` - Secret key for JWT tokens (use same value for both)
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `NEXTAUTH_URL` - Your app URL (http://localhost:3000 for local dev)

4. **Run the development server**
```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### MongoDB Setup

1. Create a MongoDB Atlas cluster at https://mongodb.com/atlas
2. Create a database named `beehive`
3. Add your IP to the whitelist (or allow access from anywhere for Vercel)
4. Create a database user with read/write permissions
5. Copy the connection string and add it to your environment variables

### Google OAuth Setup

1. Go to Google Cloud Console: https://console.cloud.google.com
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials (Web application)
5. Add authorized redirect URIs:
   - `http://localhost:3000/api/oauth-callback` (for local dev)
   - `https://your-app.vercel.app/api/oauth-callback` (for production)
6. Copy Client ID and Client Secret to your environment variables

---

## 📡 API Documentation

### Authentication Endpoints

#### Google OAuth Login
```http
GET /api/oauth-google
```
Redirects to Google OAuth consent screen.

#### GitHub OAuth Login  
```http
GET /api/oauth-github
```
Redirects to GitHub OAuth authorization.

#### OAuth Callback
```http
GET /api/oauth-callback?code=xxx&state=google|github
```
Handles OAuth callback and sets JWT cookie.

#### Check Session
```http
GET /api/session
```
**Response:**
```json
{
  "authenticated": true,
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user",
    "ownedHives": [...]
  }
}
```

#### Logout
```http
POST /api/logout
```
Clears authentication cookie.

### User & Hive Management

#### Get All Users (Admin only)
```http
GET /api/users
```

#### Get User Profile
```http
GET /api/users/me
```

#### Add Hive to Account
```http
POST /api/users/me/hives
```
**Body:**
```json
{
  "name": "Záhradný úľ",
  "location": "Záhrada A",
  "color": "#fbbf24",
  "coordinates": {
    "lat": 48.716,
    "lng": 21.261
  },
  "visibility": "private"
}
```

#### Update Hive Details
```http
PATCH /api/users/me/hives/:hiveId
```
**Body:**
```json
{
  "name": "Updated name",
  "coordinates": { "lat": 48.716, "lng": 21.261 },
  "visibility": "public"
}
```

#### Delete Hive
```http
DELETE /api/users/me/hives/:hiveId
```

#### Get Map View (All Hives with GPS)
```http
GET /api/users/hives/map
```
Returns your private hives + all public hives from other users.

### Sensor Data (Public)

#### Get Latest Reading
```http
GET /api/sensor/latest?hiveId=HIVE-001
```
**Response:**
```json
{
  "temperature": 32.5,
  "humidity": 55.2,
  "weight": 48.75,
  "battery": 85,
  "lastUpdate": "2025-11-04T22:00:00.000Z"
}
```

#### Get Historical Data
```http
GET /api/sensor/history?range=24h&hiveId=HIVE-001
```
**Query Params:**
- `range`: `24h` | `7d` | `30d`
- `hiveId`: Hive identifier

**Response:**
```json
[
  {
    "temperature": 32.5,
    "humidity": 55.2,
    "weight": 48.75,
    "battery": 85,
    "timestamp": "2025-11-04T22:00:00.000Z",
    "hiveId": "HIVE-001"
  }
]
```

#### Get Statistics
```http
GET /api/sensor/stats?hiveId=HIVE-001
```
**Response:**
```json
{
  "avgTemp": 32.1,
  "minTemp": 28.5,
  "maxTemp": 36.2,
  "avgHumidity": 54.3,
  "count": 248
}
```

### Inspection Tracking

#### Save Inspection
```http
POST /api/inspection/save
```
**Body:**
```json
{
  "hiveId": "HIVE-001",
  "checklist": {
    "pollen": true,
    "eggs": true,
    "queenSeen": false,
    "capped": true
  },
  "notes": "Strong colony, lots of brood"
}
```

#### Get Inspection History
```http
GET /api/inspection/history?hiveId=HIVE-001&limit=10
```

#### Update Inspection
```http
PATCH /api/inspection/:inspectionId
```

#### Delete Inspection
```http
DELETE /api/inspection/:inspectionId
```

### ESP32 Data Ingestion (Protected)

#### Post Sensor Data
```http
POST /api/esp32/data
```
**Headers:**
```
Content-Type: application/json
X-API-Key: beehive-secret-key-2024
```
**Body:**
```json
{
  "temperature": 32.5,
  "humidity": 55.2,
  "weight": 48.75,
  "battery": 85,
  "hiveId": "HIVE-001"
}
```
**Response:**
```json
{
  "success": true,
  "message": "Dáta úspešne uložené",
  "id": "690a6c55dad46782d393822b"
}
```

### Health Check
```http
GET /api/health
```
**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-11-04T22:00:00.000Z",
  "mongodb": "connected"
}
```

---

## 🔌 ESP32-C3 Setup

### Hardware Wiring

**DHT22 (Temperature & Humidity):**
- VCC → 3.3V
- GND → GND  
- DATA → GPIO 4

**HX711 (Weight):**
- VCC → 5V
- GND → GND
- DOUT → GPIO 5
- SCK → GPIO 6

**Battery Monitor (Optional):**
- Battery+ → A0 (via voltage divider)

### Arduino Code Setup

1. Open `arduino/beehive_monitor/beehive_monitor.ino` in Arduino IDE
2. Install required libraries:
   - DHT sensor library (Adafruit)
   - HX711 Arduino Library (Bogdan Necula)
3. Configure WiFi & API:
```cpp
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* serverUrl = "https://sbeehive.vercel.app/api/esp32/data";
const char* apiKey = "beehive-secret-key-2024";
```
4. Upload to ESP32-C3

See [arduino/README.md](arduino/README.md) for detailed setup.

---

## 🧪 Testing Without Hardware

### ESP32 Device Simulator

Test the system without physical ESP32 hardware using the built-in simulator:

#### WiFi Mode
```bash
node scripts/simulate-esp32.js
```

#### LoRaWAN Mode
```bash
MODE=lorawan node scripts/simulate-esp32.js
```

#### Custom Configuration
```bash
# Custom hive ID and faster updates
HIVE_ID=HIVE-002 INTERVAL=10000 node scripts/simulate-esp32.js

# Test with local backend
BACKEND_URL=http://localhost:5000 node scripts/simulate-esp32.js
```

**Simulator Features:**
- 🌡️ Realistic temperature cycles (30-36°C)
- 💧 Dynamic humidity simulation (40-70%)
- ⚖️ Weight variations (~45kg)
- 🔋 Battery levels (70-90%)
- 📡 LoRaWAN signal simulation (RSSI, SNR, SF)

See [scripts/SIMULATOR_README.md](scripts/SIMULATOR_README.md) for full documentation.

---

## 🔔 Push Notifications

The app includes a complete notification system for real-time alerts:

### Alert Types
1. **🌡️ Temperature** - Outside optimal range (30-36°C)
2. **💧 Humidity** - Outside optimal range (40-70%)
3. **🔋 Battery** - Low battery (<20%)
4. **⚖️ Weight** - Significant change (>2kg/hour)
5. **⚠️ Offline** - Device not responding (>60 minutes)

### Setup
1. Go to **⚙️ Settings → 🔔 Notifications**
2. Click **"Povoliť notifikácie"**
3. Allow browser permission
4. Select which alert types you want
5. Test with **"🔔 Otestovať notifikáciu"**

### How It Works
- **Automatic checks** every 30 seconds
- **Service Worker** handles notifications
- **Works on mobile** (Android Chrome, iOS Safari 16.4+)
- **Backend API** evaluates conditions

See [NOTIFICATIONS.md](NOTIFICATIONS.md) for troubleshooting and details.

---


```bash
git remote add origin https://github.com/LusnakSimon/beehive.git
git push -u origin main
```

2. **Import to Vercel**:
   - Go to https://vercel.com/new
   - Import `LusnakSimon/beehive`
   - Framework: Other (auto-detected)

3. **Environment Variables**:
```bash
# Required
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/beehive?retryWrites=true&w=majority
JWT_SECRET=your-secure-jwt-secret
NEXTAUTH_SECRET=your-secure-jwt-secret
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
NEXTAUTH_URL=https://your-app.vercel.app
```
```

4. **Deploy!**

See [DEPLOYMENT.md](DEPLOYMENT.md) for full guide.

---

## 📱 PWA Features

### Offline Support
- Service Worker caches assets & API responses
- Works without internet connection
- Automatic updates on reconnect

### Installability
- Add to Home Screen on mobile
- Standalone app experience
- Custom splash screen & icons

### Responsive Design
- Mobile-first approach
- Tablet & desktop optimized
- Touch-friendly UI

---

## 🎓 Bachelor's Thesis

**Title:** Inteligentný IoT systém na monitorovanie včelieho úľa  
**Author:** Simon Lušňák  
**University:** [Your University]  
**Year:** 2024/2025

### Project Objectives
- ✅ Design IoT system for beehive monitoring
- ✅ Implement real-time data collection (ESP32-C3)
- ✅ Develop cloud-based storage solution (MongoDB Atlas)
- ✅ Create mobile-friendly PWA interface
- ✅ Enable offline functionality
- ✅ Deploy to production environment (Vercel)

---

## 🤝 Contributing

This is a bachelor's thesis project, but suggestions are welcome!

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

---

## 📞 Contact

**Šimon Lušňák**  
- GitHub: [@LusnakSimon](https://github.com/LusnakSimon)
- Repository: https://github.com/LusnakSimon/beehive

---

## 🙏 Acknowledgments

- ESP32 Community
- React & Vite Teams
- MongoDB Atlas
- Vercel Platform
- Adafruit Sensor Libraries

---

**⭐ Star this repo if you find it useful!**
