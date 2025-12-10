# LoRaWAN Architecture - Analysis & Design

## 🚨 Current Problem

**Settings.jsx** stores LoRaWAN config (devEUI, appEUI, appKey) in **localStorage** (browser-side only):
```javascript
localStorage.setItem('lorawan-config', JSON.stringify({
  devEUI: '...',
  appEUI: '...',
  appKey: '...'
}))
```

**User Model** hives have no LoRaWAN fields:
```javascript
ownedHives: [{
  id: 'HIVE-001',
  name: 'Záhradný úľ',
  location: 'Záhrada A',
  color: '#fbbf24',
  coordinates: { lat, lng },
  visibility: 'private' | 'public'
  // ❌ Missing: devEUI, deviceType, lastSeen, etc.
}]
```

**Reading Model** only has `hiveId`:
```javascript
{
  hiveId: 'HIVE-001', // String reference
  temperature: 24.5,
  humidity: 65,
  weight: 42.3,
  source: 'LoRaWAN' | 'WiFi' | 'Manual'
  // ❌ No way to know WHICH device sent this
}
```

---

## 📡 How LoRaWAN Actually Works

### Architecture Overview
```
ESP32 Device          LoRaWAN Gateway         TTN/ChirpStack         Your Server
(in hive)            (your router)           (Network Server)        (Vercel)
    │                      │                       │                      │
    │  Radio (915MHz)      │                       │                      │
    ├──────────────────────>│                       │                      │
    │  Encrypted packet    │   Internet (MQTT)     │                      │
    │  with devEUI         ├───────────────────────>│                      │
    │                      │                       │  HTTP Webhook         │
    │                      │                       ├──────────────────────>│
    │                      │                       │  POST /api/webhook   │
    │                      │                       │  { devEUI, data }    │
```

### Key Identifiers
1. **devEUI** (Device EUI) - Unique hardware ID (like MAC address)
   - Example: `70B3D57ED005A4B2`
   - Hardcoded in ESP32 or configurable
   - Used by gateway to identify device

2. **appEUI** (Application EUI) - Identifies your application
   - Example: `0000000000000001`
   - Shared across all your devices
   - Configured in TTN/ChirpStack

3. **appKey** (Application Key) - Encryption key
   - Example: `A1B2C3D4E5F6789012345678ABCDEF01`
   - Secret for device authentication
   - Must match in device + network server

---

## 🎯 Proposed Solution

### 1. Database Schema Changes

#### Update User Model - Add LoRaWAN fields to hives:
```javascript
ownedHives: [{
  // Existing fields
  id: String,              // 'HIVE-001'
  name: String,
  location: String,
  color: String,
  coordinates: { lat, lng },
  visibility: String,
  
  // NEW: Device configuration
  device: {
    type: String,          // 'esp32-wifi', 'esp32-lorawan', 'manual'
    devEUI: String,        // '70B3D57ED005A4B2' (required for LoRaWAN)
    lastSeen: Date,        // Last data received
    signalStrength: Number, // RSSI from LoRaWAN
    batteryLevel: Number,  // %
    firmwareVersion: String // 'v1.2.3'
  },
  
  // Settings
  alertThresholds: {
    minTemp: Number,
    maxTemp: Number,
    minHumidity: Number,
    maxHumidity: Number,
    weightChange: Number   // kg per day
  },
  
  // Metadata
  createdAt: Date,
  updatedAt: Date
}]
```

#### Create new DeviceRegistry collection (optional, for advanced setup):
```javascript
const deviceSchema = new Schema({
  devEUI: { type: String, required: true, unique: true },
  owner: { type: ObjectId, ref: 'User' },
  assignedHiveId: String,  // 'HIVE-001' or null if unassigned
  deviceType: { 
    type: String, 
    enum: ['esp32-wifi', 'esp32-lorawan', 'esp32-lte'],
    default: 'esp32-lorawan'
  },
  networkProvider: {
    type: String,
    enum: ['ttn', 'chirpstack', 'helium'],
    default: 'ttn'
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'maintenance'],
    default: 'active'
  },
  lastSeen: Date,
  metadata: {
    firmwareVersion: String,
    hardwareRevision: String,
    batteryType: String,
    solarPanel: Boolean
  }
});
```

---

### 2. Workflow: Adding a New Hive with LoRaWAN

#### Option A: Simple Flow (Recommended for MVP)
1. **User creates hive in app**
   - Enter name, location, color
   - Select device type: "ESP32 LoRaWAN"
   - **Paste devEUI from device** (printed on ESP32 or from serial monitor)
   
2. **App saves hive with devEUI**
   ```javascript
   POST /api/users/me/hives
   {
     name: "Úľ v záhrade",
     location: "Záhrada A",
     device: {
       type: "esp32-lorawan",
       devEUI: "70B3D57ED005A4B2"  // ← User copies this from ESP32
     }
   }
   ```

3. **Backend validates & stores**
   - Check devEUI format (16 hex chars)
   - Check if devEUI already assigned to another hive
   - Save to user.ownedHives

4. **User configures ESP32 physically**
   - Flash firmware with your appEUI/appKey
   - Device auto-registers to TTN/ChirpStack
   - Starts sending data with its devEUI

5. **Data arrives at webhook**
   ```javascript
   POST /api/lorawan/webhook
   {
     devEUI: "70B3D57ED005A4B2",
     data: {
       temperature: 24.5,
       humidity: 65,
       weight: 42.3,
       battery: 87
     },
     metadata: {
       rssi: -80,
       snr: 9.5,
       timestamp: "2025-11-13T10:30:00Z"
     }
   }
   ```

6. **Backend matches devEUI → hiveId**
   ```javascript
   // Find user with this devEUI
   const user = await User.findOne({ 
     'ownedHives.device.devEUI': devEUI 
   });
   
   // Find which hive
   const hive = user.ownedHives.find(h => 
     h.device?.devEUI === devEUI
   );
   
   // Save reading with hiveId
   await Reading.create({
     hiveId: hive.id,  // 'HIVE-001'
     temperature: data.temperature,
     source: 'LoRaWAN',
     metadata: {
       devEUI,
       rssi: metadata.rssi,
       snr: metadata.snr
     }
   });
   ```

#### Option B: Advanced Flow (Auto-discovery)
1. Device sends first packet with devEUI
2. Webhook receives unknown devEUI
3. Backend creates "unassigned device" entry
4. Admin panel shows "New device detected: 70B3D57ED..."
5. User clicks "Assign to hive" dropdown
6. Backend links devEUI to existing hive

---

### 3. Required API Endpoints

#### `/api/lorawan/webhook` (POST)
Receives data from TTN/ChirpStack network server:
```javascript
module.exports = async (req, res) => {
  const { devEUI, data, metadata } = req.body;
  
  // 1. Find hive by devEUI
  const user = await User.findOne({ 
    'ownedHives.device.devEUI': devEUI 
  });
  
  if (!user) {
    // Unknown device - log for admin or auto-register
    console.warn('Unknown devEUI:', devEUI);
    return res.status(202).json({ 
      message: 'Device not registered' 
    });
  }
  
  const hive = user.ownedHives.find(h => 
    h.device?.devEUI === devEUI
  );
  
  // 2. Save reading
  await Reading.create({
    hiveId: hive.id,
    temperature: data.temperature,
    humidity: data.humidity,
    weight: data.weight,
    batteryLevel: data.battery,
    signalStrength: metadata.rssi,
    source: 'LoRaWAN',
    timestamp: new Date(metadata.timestamp)
  });
  
  // 3. Update last seen
  hive.device.lastSeen = new Date();
  hive.device.signalStrength = metadata.rssi;
  await user.save();
  
  // 4. Check alerts
  checkAlertConditions(hive, data);
  
  res.json({ success: true });
};
```

#### `/api/users/me/hives` (POST) - Enhanced
Add device configuration when creating hive:
```javascript
{
  name: "Nový úľ",
  location: "Záhrada",
  device: {
    type: "esp32-lorawan",
    devEUI: "70B3D57ED005A4B2"  // Required for LoRaWAN
  }
}
```

#### `/api/devices/unassigned` (GET)
List devices that sent data but aren't assigned:
```javascript
[
  {
    devEUI: "70B3D57ED005A4B2",
    firstSeen: "2025-11-13T08:00:00Z",
    lastSeen: "2025-11-13T10:30:00Z",
    packetCount: 42,
    lastData: { temperature: 24.5, ... }
  }
]
```

#### `/api/devices/:devEUI/assign` (POST)
Assign unassigned device to existing hive:
```javascript
POST /api/devices/70B3D57ED005A4B2/assign
{
  hiveId: "HIVE-003"
}
```

---

### 4. Frontend Changes

#### Settings.jsx - Change to Per-Hive Config
Remove global LoRaWAN config, move to hive creation:

**Old (current):**
```javascript
// Settings page - global config
<input value={lorawanConfig.devEUI} />
```

**New (proposed):**
```javascript
// Hive creation/edit modal
<select name="deviceType">
  <option value="manual">Manuálne</option>
  <option value="esp32-wifi">ESP32 WiFi</option>
  <option value="esp32-lorawan">ESP32 LoRaWAN</option>
</select>

{deviceType === 'esp32-lorawan' && (
  <input 
    name="devEUI"
    placeholder="70B3D57ED005A4B2"
    pattern="[0-9A-F]{16}"
    required
  />
)}
```

#### Dashboard.jsx - Show Device Status
```javascript
<div className="device-status">
  {hive.device?.type === 'esp32-lorawan' && (
    <>
      <span>📡 LoRaWAN</span>
      <span>DevEUI: {hive.device.devEUI}</span>
      <span>Last seen: {formatTimeAgo(hive.device.lastSeen)}</span>
      <span>Signal: {hive.device.signalStrength} dBm</span>
    </>
  )}
</div>
```

#### Admin Panel - Device Management
```javascript
<section>
  <h2>📡 Unassigned Devices</h2>
  {unassignedDevices.map(device => (
    <div key={device.devEUI}>
      <code>{device.devEUI}</code>
      <span>First seen: {device.firstSeen}</span>
      <select onChange={e => assignDevice(device.devEUI, e.target.value)}>
        <option>-- Assign to hive --</option>
        {myHives.map(hive => (
          <option value={hive.id}>{hive.name}</option>
        ))}
      </select>
    </div>
  ))}
</section>
```

---

### 5. Network Server Configuration

#### The Things Network (TTN)
1. Create application: `beehive-monitor`
2. Add devices with their devEUI
3. Configure webhook:
   ```
   Webhook URL: https://ebeehive.vercel.app/api/lorawan/webhook
   Format: JSON
   Method: POST
   ```

#### Payload Decoder (TTN Console):
```javascript
function decodeUplink(input) {
  return {
    data: {
      temperature: ((input.bytes[0] << 8) | input.bytes[1]) / 100,
      humidity: ((input.bytes[2] << 8) | input.bytes[3]) / 100,
      weight: ((input.bytes[4] << 8) | input.bytes[5]) / 10,
      battery: input.bytes[6]
    }
  };
}
```

---

## 🔧 Implementation Steps

### Phase 1: Database (1-2 hours)
- [ ] Update User model schema (add device fields to ownedHives)
- [ ] Add migration script for existing hives (set device.type = 'manual')
- [ ] Create Reading.metadata field for RSSI/SNR
- [ ] Add indexes on devEUI for fast lookup

### Phase 2: Backend API (2-3 hours)
- [ ] Create `/api/lorawan/webhook` endpoint
- [ ] Update `/api/users/me/hives` POST to accept device config
- [ ] Add devEUI validation (format, uniqueness)
- [ ] Implement device → hive lookup logic
- [ ] Add `/api/devices/unassigned` endpoint

### Phase 3: Frontend (3-4 hours)
- [ ] Remove global LoRaWAN config from Settings
- [ ] Add device type selector to hive creation
- [ ] Add devEUI input field (with validation)
- [ ] Show device status in Dashboard
- [ ] Create "Unassigned Devices" section in Admin
- [ ] Add device assignment UI

### Phase 4: Testing (2-3 hours)
- [ ] Configure TTN application + webhook
- [ ] Test with real ESP32 device
- [ ] Test with LoRaWAN simulator
- [ ] Verify data routing: ESP32 → TTN → Webhook → DB
- [ ] Test multiple devices on same gateway

### Phase 5: Documentation (1 hour)
- [ ] Update README with LoRaWAN setup guide
- [ ] Create ESP32 firmware guide (how to get devEUI)
- [ ] Document TTN webhook configuration
- [ ] Add troubleshooting section

---

## 🎓 Key Concepts Explained

### Why devEUI is Device-Specific
Each ESP32 has a unique devEUI (like a serial number). When you buy 3 ESP32s:
- Device 1: devEUI `70B3D57ED005A4B2`
- Device 2: devEUI `70B3D57ED005C8F1`
- Device 3: devEUI `70B3D57ED0061234`

Each device is assigned to one hive:
- Device 1 → HIVE-001 (Záhrada A)
- Device 2 → HIVE-002 (Záhrada B)
- Device 3 → HIVE-003 (Včelín)

### Data Flow Example
```
1. ESP32 in HIVE-001 measures 24.5°C
2. Sends LoRaWAN packet: { devEUI: "70B3D57E...", temp: 24.5 }
3. Gateway receives radio signal
4. Gateway forwards to TTN: "Device 70B3D57E sent data"
5. TTN calls your webhook: POST /api/lorawan/webhook
6. Your backend searches: "Which hive has devEUI 70B3D57E?"
7. Finds: user.ownedHives[0].device.devEUI matches
8. Saves: Reading { hiveId: 'HIVE-001', temp: 24.5 }
9. Dashboard shows: "Úľ v záhrade: 24.5°C"
```

---

## ✅ Recommended Approach for Your Thesis

**Start Simple:**
1. **Manual devEUI Entry** - User pastes devEUI when creating hive
2. **Single Network Server** - Use TTN (free for non-commercial)
3. **Basic Webhook** - Just save readings, no auto-discovery yet

**Advantages:**
- Quick to implement (1 day)
- Clear ownership model (devEUI in hive object)
- No complex device registry needed
- Works with multiple devices per user

**For Demo:**
1. Show creating hive with devEUI input
2. Show ESP32 with devEUI printed on serial
3. Show data arriving in dashboard
4. Show Admin panel with device status

**For Thesis Defense:**
- Explain LoRaWAN architecture diagram
- Show TTN console configuration
- Demonstrate multi-device support
- Explain scalability (100+ devices possible)

---

## 📝 Summary

**Current Issue:** LoRaWAN config stored only in browser localStorage, not connected to hives.

**Solution:** Add `device.devEUI` field to each hive in database, match incoming webhook data by devEUI.

**Next Steps:**
1. Update User model schema
2. Create `/api/lorawan/webhook` endpoint
3. Update hive creation UI to ask for devEUI
4. Configure TTN webhook
5. Test with real device

**Time Estimate:** 8-10 hours total implementation.
