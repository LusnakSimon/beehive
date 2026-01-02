# Beehive Arduino Sketches

Two ESP32-C3 SuperMini boards communicating via LoRa (RFM95).

## 📁 Sketches

### beehive_node/
Sensor node that reads temperature, humidity, weight and sends via LoRa.

### beehive_gateway/
Gateway that receives LoRa packets and POSTs to the API via WiFi.

### Legacy (beehive_monitor/, beehive_lorawan/)
Old sketches, kept for reference.

## Hardware

### Sensor Node
- ESP32-C3 SuperMini
- AHT10 (temperature + humidity) via I2C
- HX711 + load cell (weight)
- RFM95 LoRa module @ 868 MHz

### Gateway
- ESP32-C3 SuperMini
- RFM95 LoRa module @ 868 MHz
- WiFi connection to server

## Wiring

### Common (both boards)
| RFM95 | ESP32-C3 |
|-------|----------|
| VCC   | 3.3V     |
| GND   | GND      |
| SCK   | GPIO4    |
| MISO  | GPIO5    |
| MOSI  | GPIO6    |
| CS    | GPIO7    |
| RST   | GPIO10   |
| DIO0  | GPIO2 (node) / GPIO3 (gateway) |

### Node only
| Sensor | ESP32-C3 |
|--------|----------|
| AHT10 SDA | GPIO8 |
| AHT10 SCL | GPIO9 |
| HX711 DOUT | GPIO3 |
| HX711 SCK  | GPIO1 |

## Protocol

Node sends compact JSON via LoRa every 30s:
```json
{"t":21.5,"h":55.3,"w":45.12,"n":42}
```
- `t` = temperature (°C)
- `h` = humidity (%)
- `w` = weight (kg)
- `n` = counter

Gateway receives, adds metadata (RSSI, hiveId), and POSTs to `/api/sensor`.

## Setup

1. **Get API Key**: In the app, go to My Hives → Edit hive → Set device type to "API" → Copy the API key

2. **Configure Gateway**: Edit `beehive_gateway/beehive_gateway.ino`:
   ```cpp
   const char* WIFI_SSID = "your_wifi";
   const char* WIFI_PASS = "your_password";
   const char* HIVE_ID   = "HIVE-001";  // Your hive ID
   const char* API_KEY   = "abc123..."; // From step 1
   ```

3. **Calibrate Scale**: Adjust `CALIBRATION_FACTOR` in `beehive_node.ino` with known weights

4. **Upload**: Use Arduino IDE or PlatformIO

## Libraries Required

- RadioHead (RH_RF95)
- Adafruit AHTX0
- HX711 by bogde
