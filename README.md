# eBeeHive — Smart Beehive Monitoring System

[![Deployed on Vercel](https://img.shields.io/badge/Deployed-Vercel-black)](https://ebeehive.vercel.app)


An intelligent IoT system for beehive monitoring — a Progressive Web App with real-time sensor data from custom point-to-point LoRa hardware.

**Live:** [https://ebeehive.vercel.app](https://ebeehive.vercel.app)

---

## Features

- **Real-time monitoring** — temperature, humidity, and weight from custom LoRa sensor nodes
- **Historical charts** — interactive graphs with selectable time ranges (6h, 24h, 7d, 30d, 90d, 1y)
- **Smart alerts** — browser notifications for abnormal temperature, humidity, weight changes, low battery, or device offline, with cooldown to avoid spam
- **Multi-hive management** — register multiple hives, each with its own API key for device authentication
- **Inspection tracking** — digital checklists with queen sightings, brood patterns, pollen stores, and full history
- **Harvest logging** — record honey harvests with photos (Cloudinary) and notes per hive
- **Offline support** — installable PWA with service worker, IndexedDB caching, and offline queue for inspections
- **OAuth authentication** — Google and GitHub login with JWT sessions in HTTP-only cookies

---

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 18, Vite 5, React Router 6, Recharts |
| **Backend** | Node.js, Vercel Serverless Functions |
| **Database** | MongoDB Atlas, Mongoose ODM |
| **Auth** | OAuth 2.0 (Google, GitHub), JWT |
| **IoT Hardware** | ESP32-C3 gateway, Arduino Pro Mini 3.3V sensor node, RFM95W LoRa 868 MHz, SHT40, HX711 + 4× load cells |
| **Testing** | Vitest, Jest, React Testing Library |

---

## Project Structure

```
beehive/
├── client/                 # React PWA frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── contexts/       # Auth, Notification, Toast, Hive contexts
│   │   ├── hooks/          # useOfflineQueue, useOfflineStatus
│   │   ├── pages/          # Dashboard, History, Inspection, MyHives, Harvests, Settings, Login
│   │   ├── lib/            # IndexedDB wrapper
│   │   └── utils/          # Date formatting, image compression
│   └── public/             # PWA manifest, service worker
│
├── api/                    # Vercel serverless endpoints
│   ├── auth/               # OAuth login/callback/logout
│   ├── sensor/             # Sensor data ingestion & retrieval
│   ├── harvests/           # Harvest CRUD
│   ├── inspection/         # Inspection CRUD
│   ├── users/              # User & hive management
│   └── session.js          # Session validation
│
├── lib/                    # Shared backend logic
│   ├── models/             # Mongoose schemas (User, Reading, Inspection, Harvest)
│   ├── routes/             # Route handlers
│   └── utils/              # Auth, CORS, validation, rate limiting, DB connection
│
├── arduino/                # Firmware (see arduino/README.md)
├── scripts/                # ESP32 simulator for testing
├── tests/                  # Backend unit tests (Jest)
└── docs/                   # Setup & deployment guides
```

---

## Quick Start

### Prerequisites

- Node.js 20+
- MongoDB Atlas account
- Google and/or GitHub OAuth credentials

### Installation

```bash
git clone https://github.com/LusnakSimon/beehive.git
cd beehive
npm install
cp .env.example .env
# Fill in your credentials in .env
npm run dev
```

See [.env.example](.env.example) for all required environment variables.

---

## Documentation

| Document | Description |
|----------|-------------|
| [Local Development](docs/LOCAL_DEVELOPMENT.md) | Local dev environment setup |
| [OAuth Setup](docs/OAUTH_SETUP.md) | Google & GitHub OAuth configuration |
| [Deployment](docs/DEPLOYMENT.md) | Deploying to Vercel |
| [Cloudinary Setup](docs/CLOUDINARY_SETUP.md) | Image upload for harvest photos |
| [Arduino Firmware](arduino/README.md) | Sensor node & gateway firmware |

---

## Testing

```bash
# Client tests (Vitest)
cd client && npm test

# Backend tests (Jest)
npx jest --forceExit
```

---


## Author

**Šimon Lusnák** 
