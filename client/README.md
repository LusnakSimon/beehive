# Beehive Monitor - Frontend (PWA)

React-based Progressive Web App for beehive monitoring with offline support and push notifications.

## 🛠️ Technology Stack

- **React 18.2** - UI library with hooks
- **Vite 5** - Fast build tool and dev server
- **React Router 6** - Client-side routing
- **Recharts 2.10** - Data visualization charts
- **React Leaflet 4.2** - Interactive maps
- **Leaflet 1.9** - Mapping library
- **Service Worker** - Offline caching & push notifications

## 📁 Project Structure

```
client/src/
├── components/           # Reusable React components
│   ├── Navigation.jsx    # App navigation (mobile bottom bar)
│   ├── HiveSelector.jsx  # Multi-hive dropdown selector
│   ├── ProtectedRoute.jsx # Auth guard for routes
│   ├── VarroaReminder.jsx # Varroa treatment reminder
│   └── NotificationSettings.jsx # Push notification config
│
├── contexts/             # React Context providers
│   ├── AuthContext.jsx   # OAuth authentication state
│   ├── HiveContext.jsx   # Current selected hive
│   └── NotificationContext.jsx # Push notification state
│
├── pages/                # Page components (routes)
│   ├── Login.jsx         # OAuth login page
│   ├── Dashboard.jsx     # Real-time sensor dashboard
│   ├── History.jsx       # Historical data charts
│   ├── Inspection.jsx    # Inspection checklist tracker
│   ├── HiveMap.jsx       # GPS hive map view
│   ├── Profile.jsx       # User profile page
│   ├── Admin.jsx         # Admin panel (role=admin only)
│   └── Settings.jsx      # App settings & hive management
│
├── App.jsx               # Main app with routing
├── main.jsx              # Entry point
└── index.css             # Global styles
```

## 🚀 Development

### Install Dependencies
```bash
npm install
```

### Run Development Server
```bash
npm run dev
```
App runs on `http://localhost:5173`

### Build for Production
```bash
npm run build
```
Output in `dist/` directory

## 📱 PWA Features

### Service Worker
- Caches static assets
- Caches API responses for offline use
- Push notifications

### Installation
Users can install the app from browser:
- Chrome/Edge: "Install app" button
- Safari iOS: "Add to Home Screen"

## 📄 License

MIT License - Part of beehive-monitor project
