# eBeeHive - Frontend

React PWA for beehive monitoring with offline support and push notifications.

## Tech Stack

- React 18 + Vite 5
- React Router 6
- Recharts (data visualization)
- React Leaflet (maps)
- Vitest + React Testing Library

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

## Project Structure

```
src/
├── components/        # Reusable UI components
├── contexts/          # React Context providers
├── pages/             # Route page components
├── utils/             # Helper functions
└── App.jsx            # Main app with routing
```

## Pages

| Page | Route | Description |
|------|-------|-------------|
| Login | `/login` | OAuth authentication |
| Dashboard | `/` | Real-time sensor data |
| History | `/history` | Historical charts |
| Inspection | `/inspection` | Inspection checklist |
| Hive Map | `/map` | GPS hive locations |
| Settings | `/settings` | App configuration |
| Profile | `/profile/:id` | User profiles |
| Messages | `/messages` | Direct messaging |
| Groups | `/groups` | Group chats |
| Admin | `/admin` | Admin panel |

## Environment

No environment variables required for the frontend - API calls use relative URLs proxied by Vite in development.
