# 🐝 ESP32 Device Simulator

Simulátor ESP32 zariadenia pre testovanie bez fyzického hardvéru.

## 🚀 Použitie

### Základné spustenie (WiFi režim)
```bash
node scripts/simulate-esp32.js
```

### WiFi režim s vlastným úľom
```bash
HIVE_ID=HIVE-002 node scripts/simulate-esp32.js
```

### LoRaWAN režim
```bash
MODE=lorawan HIVE_ID=HIVE-001 node scripts/simulate-esp32.js
```

### Rýchlejší interval (každých 10 sekúnd)
```bash
INTERVAL=10000 node scripts/simulate-esp32.js
```

### Lokálny backend
```bash
BACKEND_URL=http://localhost:5000 node scripts/simulate-esp32.js
```

### Kombinácia parametrov
```bash
MODE=lorawan HIVE_ID=HIVE-003 INTERVAL=60000 node scripts/simulate-esp32.js
```

## ⚙️ Konfigurácia

| Premenná | Default | Popis |
|----------|---------|-------|
| `BACKEND_URL` | `https://ebeehive.vercel.app` | URL backendu |
| `HIVE_ID` | `HIVE-001` | ID úľa |
| `MODE` | `wifi` | Režim: `wifi` alebo `lorawan` |
| `INTERVAL` | `30000` | Interval v ms (30s default) |

## 📊 Simulované hodnoty

- **Teplota**: 30-36°C s denným cyklom
- **Vlhkosť**: 40-70% s inverzným cyklom
- **Hmotnosť**: ~45kg s malými variáciami
- **Batéria**: 70-90% (náhodne)

## 🎯 Scenáre testovania

### 1. Test jedného úľa (WiFi)
```bash
node scripts/simulate-esp32.js
```

### 2. Test troch úľov súčasne
```bash
# Terminal 1
HIVE_ID=HIVE-001 node scripts/simulate-esp32.js

# Terminal 2
HIVE_ID=HIVE-002 node scripts/simulate-esp32.js

# Terminal 3
HIVE_ID=HIVE-003 node scripts/simulate-esp32.js
```

### 3. Test LoRaWAN konektivity
```bash
MODE=lorawan node scripts/simulate-esp32.js
```

### 4. Rýchle testovanie (každých 5 sekúnd)
```bash
INTERVAL=5000 node scripts/simulate-esp32.js
```

## 🔍 Výstup

### WiFi režim:
```
🐝 ESP32 Device Simulator Started
   Backend: https://ebeehive.vercel.app
   Hive ID: HIVE-001
   Mode: WIFI
   Interval: 30000ms (30s)

✅ WiFi: Data sent successfully
   📊 Temp: 33.2°C, Humidity: 55.4%, Weight: 45.12kg, Battery: 85%
```

### LoRaWAN režim:
```
🐝 ESP32 Device Simulator Started
   Backend: https://ebeehive.vercel.app
   Hive ID: HIVE-001
   Mode: LORAWAN
   Interval: 30000ms (30s)

✅ LoRaWAN: Data sent successfully
   📊 Temp: 33.2°C, Humidity: 55.4%, Weight: 45.12kg, Battery: 85%
   📡 Payload: CQsDxwAAC+tV
```

## 🛑 Zastavenie

Stlač `Ctrl+C` pre ukončenie simulátora.

## 💡 Tipy

1. **Multi-hive test**: Otvor 3 terminály a spusti simulátor s rôznymi `HIVE_ID`
2. **LoRaWAN test**: Skontroluj Dashboard či sa zobrazuje signal strength karta
3. **Real-time monitor**: Nechaj simulátor bežať a sleduj Dashboard v reálnom čase
4. **History test**: Nechaj bežať 1+ hodinu a pozri grafy v História sekcii

## 🔗 API Endpoints

- **WiFi**: `POST /api/esp32/data`
- **LoRaWAN**: `POST /api/lorawan/webhook`

## 🐛 Troubleshooting

**Problém**: `fetch is not defined`
- **Riešenie**: Node.js 18+ je potrebný (má native fetch)

**Problém**: Connection refused
- **Riešenie**: Skontroluj `BACKEND_URL` a či backend beží

**Problém**: Data sa nezobrazujú
- **Riešenie**: Skontroluj `HIVE_ID` zhoduje s úľom v Settings
