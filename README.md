# 🐝 eBeeHive - Smart Beehive Monitoring System

[![CI/CD](https://github.com/LusnakSimon/beehive/actions/workflows/ci.yml/badge.svg)](https://github.com/LusnakSimon/beehive/actions/workflows/ci.yml)
[![Deployed on Vercel](https://img.shields.io/badge/Deployed-Vercel-black)](https://ebeehive.vercel.app)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**An intelligent IoT system for beehive monitoring** - Progressive Web App with real-time sensor data, LoRaWAN support, and social features for beekeepers.

🌐 **Live Demo:** [https://ebeehive.vercel.app](https://ebeehive.vercel.app)

![Dashboard Preview](https://via.placeholder.com/800x400?text=eBeeHive+Dashboard)

---

## ✨ Features

### 📊 Real-time Monitoring
- Live temperature, humidity & weight tracking from ESP32/LoRaWAN sensors
- Interactive charts with historical data (6h, 24h, 7d, 30d, 90d, 1y)
- Smart alerts for abnormal readings
- Battery and signal strength monitoring
- CSV data export

### 🐝 Multi-Hive Management
- Monitor unlimited hives per account
- Custom names, locations, and color coding
- GPS coordinates with interactive map view
- Privacy controls (public/private hives)

### 🗺️ Hive Map
- Interactive OpenStreetMap integration
- View your hives and discover nearby beekeepers
- Distance calculations between hives
- Click markers for hive details

### 📝 Inspection Tracking
- Digital inspection checklists
- Track queen sightings, brood patterns, pollen stores
- Inspection history with notes
- Varroa treatment reminders

### 🌐 LoRaWAN Integration
- Long-range monitoring (kilometers away)
- Low power consumption (months on battery)
- TTN (The Things Network) webhook support
- Easy device registration wizard

### 💬 Social Features
- Friend system with requests
- Direct messaging between beekeepers
- Group chats for communities
- User profiles with hive collections

### 📱 Progressive Web App
- Installable on mobile devices
- Offline support with service worker
- Push notifications for alerts
- Responsive design (mobile & desktop)

### 🔐 Security
- OAuth 2.0 authentication (Google, GitHub)
- JWT-based sessions with HTTP-only cookies
- Role-based access control (User/Admin)
- Secure API endpoints

---

## 🛠️ Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 18, Vite 5, React Router 6, Recharts, Leaflet |
| **Backend** | Node.js 20, Vercel Serverless Functions |
| **Database** | MongoDB Atlas, Mongoose ODM |
| **Auth** | OAuth 2.0 (Google, GitHub), JWT |
| **IoT** | ESP32-C3, LoRaWAN, DHT22, HX711 |
| **CI/CD** | GitHub Actions, Vercel |
| **Testing** | Vitest, React Testing Library |

---

## 📁 Project Structure

```
beehive/
├── client/                    # React PWA Frontend
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   ├── contexts/          # React Context providers
│   │   ├── pages/             # Page components
│   │   └── utils/             # Helper functions
│   └── public/                # Static assets & PWA files
│
├── api/                       # Vercel Serverless Functions
│   ├── auth/                  # OAuth endpoints
│   ├── sensor/                # Sensor data API
│   ├── conversations/         # Chat API
│   ├── friends/               # Friends API
│   ├── groups/                # Group chat API
│   ├── inspection/            # Inspection API
│   ├── lorawan/               # LoRaWAN webhook
│   └── users/                 # User management API
│
├── lib/                       # Shared Backend Logic
│   ├── models/                # Mongoose schemas
│   ├── routes/                # Route handlers
│   └── utils/                 # Utilities
│
├── arduino/                   # ESP32 Firmware
│   ├── beehive_monitor/       # WiFi version
│   └── beehive_lorawan/       # LoRaWAN version
│
├── docs/                      # Documentation
└── .github/workflows/         # CI/CD pipelines
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- MongoDB Atlas account
- Google/GitHub OAuth credentials

### Installation

```bash
# Clone the repository
git clone https://github.com/LusnakSimon/beehive.git
cd beehive

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials

# Run development server
npm run dev
```

The app will be available at `http://localhost:3000`

### Environment Variables

Create a `.env` file in the root directory:

```env
# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/beehive

# Authentication
JWT_SECRET=your-super-secret-jwt-key
NEXTAUTH_URL=http://localhost:3000

# OAuth - Google
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# OAuth - GitHub
GITHUB_ID=your-github-client-id
GITHUB_SECRET=your-github-client-secret
```

---

## 📖 Documentation

| Document | Description |
|----------|-------------|
| [Local Development](docs/LOCAL_DEVELOPMENT.md) | Setting up local dev environment |
| [OAuth Setup](docs/OAUTH_SETUP.md) | Configuring Google & GitHub OAuth |
| [LoRaWAN Setup](docs/LORAWAN_SETUP.md) | Connecting LoRaWAN devices |
| [Deployment](docs/DEPLOYMENT.md) | Deploying to Vercel |
| [Arduino Setup](arduino/README.md) | ESP32 firmware guide |

---

## 🧪 Testing

```bash
# Run all tests
cd client && npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

**Test Coverage:**
- 34 tests across 5 test suites
- Unit tests for contexts and components
- Integration tests for key user flows

---

## 🚢 Deployment

The app is configured for deployment on Vercel:

1. Push to GitHub
2. Import project in Vercel Dashboard
3. Configure environment variables
4. Deploy!

CI/CD pipeline automatically:
- Runs tests on every push/PR
- Builds the application
- Deploys to production on merge to `main`

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please read our [Pull Request Template](.github/pull_request_template.md) for details.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👨‍💻 Author

**Šimon Lusnák** - Bachelor's Thesis Project (VAII)

- GitHub: [@LusnakSimon](https://github.com/LusnakSimon)

---

## 🙏 Acknowledgments

- [OpenStreetMap](https://www.openstreetmap.org/) for map tiles
- [The Things Network](https://www.thethingsnetwork.org/) for LoRaWAN infrastructure
- [Vercel](https://vercel.com/) for hosting
- [MongoDB Atlas](https://www.mongodb.com/atlas) for database

---

<p align="center">
  Made with ❤️ for beekeepers everywhere 🐝
</p>
