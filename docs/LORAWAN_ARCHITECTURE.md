# LoRaWAN Architecture

This document describes the LoRaWAN integration for the Beehive Monitoring System.

## Overview

The system supports two device types:
- **`manual`** - User enters data manually via the web interface
- **`api`** - Devices send data via API (including LoRaWAN through TTN webhook)

For LoRaWAN devices, data flows from the ESP32 sensor node through LoRa radio to a gateway, then via The Things Network (TTN) to our webhook endpoint.

## Architecture

```
ESP32 Node          LoRa Gateway           TTN Network           Beehive Server
(in hive)           (WiFi+LoRa)            Server                (Vercel)
    │                     │                     │                      │
    │  LoRa Radio         │                     │                      │
    ├─────────────────────>│                     │                      │
    │  {"t":21.5,...}     │   Internet          │                      │
    │                     ├─────────────────────>│                      │
    │                     │                     │   HTTP Webhook       │
    │                     │                     ├──────────────────────>│
    │                     │                     │   POST /api/lorawan  │
    │                     │                     │   /webhook           │
```

## Hardware Components

### Sensor Node (`arduino/beehive_node/`)
- **ESP32-C3 SuperMini** - Microcontroller
- **AHT10** - Temperature & humidity sensor (I2C)
- **HX711 + Load Cell** - Weight measurement
- **RFM95W** - LoRa radio module (868 MHz Europe)

Sends compact JSON every 30 seconds:
```json
{"t":21.5,"h":55.3,"w":45.12,"n":42}
```
- `t` - Temperature (°C)
- `h` - Humidity (%)
- `w` - Weight (kg)
- `n` - Message counter

### Gateway (`arduino/beehive_gateway/`)
- **ESP32** - WiFi-capable microcontroller
- **RFM95W** - LoRa radio receiver

Receives LoRa messages and forwards to TTN (or directly to API):
1. Receives LoRa packet from node
2. Parses JSON payload
3. Forwards via WiFi to TTN (MQTT) or direct HTTP

## Device Configuration

### Hive Device Settings (stored in User.ownedHives)
```javascript
device: {
  type: 'api',           // 'api' or 'manual'
  apiKey: 'abc123...',   // 32-char hex key (auto-generated for 'api' type)
  devEUI: '70B3D57E...'  // Optional: 16-char hex LoRaWAN device identifier
}
```

### How DevEUI Works
- Each ESP32 LoRaWAN device has a unique DevEUI (Device Extended Unique Identifier)
- Similar to a MAC address - globally unique hardware ID
- Format: 16 hexadecimal characters (e.g., `70B3D57ED005A4B2`)
- When TTN receives data, it includes the DevEUI in the webhook payload
- Our backend matches DevEUI to find the correct hive

## API Endpoints

### `/api/lorawan/webhook` (POST)
Receives data from TTN webhook integration.

**TTN Webhook Payload:**
```json
{
  "end_device_ids": {
    "dev_eui": "70B3D57ED005A4B2",
    "device_id": "beehive-sensor-001"
  },
  "uplink_message": {
    "decoded_payload": {
      "temperature": 24.5,
      "humidity": 65,
      "weight": 42.3,
      "battery": 87
    },
    "rx_metadata": [
      { "rssi": -80, "snr": 9.5 }
    ],
    "received_at": "2025-01-15T10:30:00Z"
  }
}
```

**Response:**
```json
{
  "success": true,
  "hiveId": "HIVE-001",
  "hiveName": "Garden Hive",
  "readingId": "...",
  "message": "Data received and saved"
}
```

### `/api/sensor` (POST)
Direct sensor data endpoint (for non-LoRaWAN devices or gateway direct mode).

**Request:**
```json
{
  "hiveId": "HIVE-001",
  "apiKey": "abc123...",
  "temperature": 24.5,
  "humidity": 65,
  "weight": 42.3
}
```

## TTN Setup Guide

### 1. Create TTN Application
1. Go to [console.thethingsnetwork.org](https://console.thethingsnetwork.org)
2. Create new application: `beehive-monitor`
3. Note your Application ID

### 2. Register Device
1. Click "Register end device"
2. Select "Enter end device specifics manually"
3. Configure:
   - **Frequency plan:** Europe 863-870 MHz
   - **LoRaWAN version:** MAC V1.0.2
   - **DevEUI:** Your device's unique ID
   - **AppEUI:** 0000000000000000
   - **AppKey:** Generate random key

### 3. Configure Payload Formatter
In TTN Console → Applications → Your App → Payload Formatters → Uplink:

```javascript
function decodeUplink(input) {
  var data = {};
  var bytes = input.bytes;
  
  if (bytes.length >= 9) {
    // Temperature: 2 bytes, signed, divide by 10
    data.temperature = ((bytes[0] << 8) | bytes[1]);
    if (data.temperature > 32767) data.temperature -= 65536;
    data.temperature /= 10.0;
    
    // Humidity: 2 bytes, unsigned, divide by 10
    data.humidity = ((bytes[2] << 8) | bytes[3]) / 10.0;
    
    // Weight: 4 bytes, signed, divide by 100
    data.weight = (bytes[4] << 24) | (bytes[5] << 16) | (bytes[6] << 8) | bytes[7];
    if (data.weight > 2147483647) data.weight -= 4294967296;
    data.weight /= 100.0;
    
    // Battery: 1 byte, 0-100%
    data.battery = bytes[8];
  }
  
  return {
    data: data,
    warnings: [],
    errors: []
  };
}
```

### 4. Add Webhook Integration
1. Go to Integrations → Webhooks
2. Click "+ Add webhook"
3. Select "Custom webhook"
4. Configure:
   - **Webhook ID:** `beehive-webhook`
   - **Webhook format:** JSON
   - **Base URL:** `https://ebeehive.vercel.app/api/lorawan/webhook`
5. Enable "Uplink message" events
6. Click "Create webhook"

## Adding LoRaWAN Device to Hive

1. **Create/Edit Hive** in the web app
2. **Select Device Type:** `API Device`
3. **Enter DevEUI:** The 16-character hex ID from your ESP32
4. **Save** - An API key is auto-generated
5. **Configure ESP32** with the matching DevEUI and TTN credentials
6. **Data flows automatically** when device sends readings

## Data Flow

1. **ESP32 Node** measures temperature, humidity, weight
2. **Builds JSON:** `{"t":21.5,"h":55.3,"w":45.12,"n":42}`
3. **Transmits via LoRa** to nearby gateway
4. **Gateway forwards** to TTN network server
5. **TTN decodes payload** using formatter
6. **TTN calls webhook:** `POST /api/lorawan/webhook`
7. **Backend matches DevEUI** to find correct user and hive
8. **Creates Reading** document with sensor data
9. **Updates device status** (lastSeen, signalStrength)
10. **Dashboard displays** new reading in real-time

## Troubleshooting

### Device Not Registered
- Check DevEUI is correctly entered in hive settings
- Verify DevEUI matches the one in TTN console
- DevEUI is case-insensitive but stored uppercase

### No Data Received
- Check TTN console for incoming packets
- Verify webhook URL is correct and active
- Check Vercel function logs for errors

### Bad Signal
- Move gateway closer to hive
- Use higher TX power on node (max 20 dBm)
- Check antenna connections

### Battery Issues
- Normal battery life: 6-12 months with 30s intervals
- Consider solar panel addition for permanent installation

## Security

- Webhook accepts data from any IP (TTN IPs vary)
- DevEUI matching ensures data goes to correct hive
- API key alternative for direct HTTP access
- All data stored with source: 'LoRaWAN' for audit
