# ESP32 Device Simulator

Simulates the ESP32 gateway sending sensor data to the API, for testing without physical hardware.

## Usage

```bash
# Basic (sends to production)
node scripts/simulate-esp32.js

# Custom hive ID
HIVE_ID=HIVE-002 node scripts/simulate-esp32.js

# Faster interval (every 10 seconds)
INTERVAL=10000 node scripts/simulate-esp32.js

# Local backend
BACKEND_URL=http://localhost:5173 node scripts/simulate-esp32.js
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `BACKEND_URL` | `https://ebeehive.vercel.app` | Backend URL |
| `HIVE_ID` | `HIVE-001` | Hive ID to send data for |
| `INTERVAL` | `30000` | Send interval in ms (default 30s) |

## Simulated Values

- **Temperature**: 30–36 °C with a daily sine cycle
- **Humidity**: 40–70 % (inverse cycle)
- **Weight**: ~45 kg with small random variation
- **Battery**: 70–90 % (random)

## Multi-Hive Testing

Open separate terminals:

```bash
# Terminal 1
HIVE_ID=HIVE-001 node scripts/simulate-esp32.js

# Terminal 2
HIVE_ID=HIVE-002 node scripts/simulate-esp32.js
```

## Troubleshooting

- **`fetch is not defined`** — requires Node.js 18+ (native fetch)
- **Connection refused** — check `BACKEND_URL` and that the backend is running
- **Data not showing** — make sure `HIVE_ID` matches a hive registered in the app
