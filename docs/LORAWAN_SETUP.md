# 📡 LoRaWAN Setup Guide - ESP32 do ebeehive.vercel.app

Kompletný návod na pripojenie ESP32 zariadenia cez LoRaWAN do Beehive Monitor aplikácie.

---

## 📋 Potrebné komponenty

### Hardware
- **ESP32** (preferované: ESP32-C3, ESP32-S3 alebo ESP32 s LoRa modulom)
- **LoRa modul SX1276/SX1278** (868 MHz pre Európu)
- **DHT22** - teplota a vlhkosť
- **HX711 + Load Cell** - váha
- **Napájanie** - batéria/solárny panel (voliteľné)

### Software
- **Arduino IDE** alebo **PlatformIO**
- **The Things Network (TTN)** account - https://www.thethingsnetwork.org/
- Prístup na **ebeehive.vercel.app** (verejná aplikácia, zatiaľ bez autentifikácie)

---

## 🔧 KROK 1: Zapojenie hardvéru

### ESP32 + SX1276/1278 LoRa modul

```
LoRa modul    →  ESP32
━━━━━━━━━━━━━━━━━━━━━━━━━━━
VCC           →  3.3V
GND           →  GND
MISO          →  GPIO 19
MOSI          →  GPIO 23
SCK           →  GPIO 18
NSS (CS)      →  GPIO 5
RST           →  GPIO 14
DIO0          →  GPIO 26
DIO1          →  GPIO 33 (voliteľné)
```

### DHT22 senzor

```
DHT22         →  ESP32
━━━━━━━━━━━━━━━━━━━━━━━━━━━
VCC           →  3.3V
GND           →  GND
DATA          →  GPIO 4
```

### HX711 + Load Cell

```
HX711         →  ESP32
━━━━━━━━━━━━━━━━━━━━━━━━━━━
VCC           →  5V
GND           →  GND
DOUT          →  GPIO 21
SCK           →  GPIO 22
```

### Load Cell (4-vodičová)

```
Red    (E+)   →  HX711 E+
Black  (E-)   →  HX711 E-
White  (S+)   →  HX711 A+
Green  (S-)   →  HX711 A-
```

---

## 🌐 KROK 2: Registrácia na The Things Network

### 2.1 Vytvorenie účtu
1. Choď na https://www.thethingsnetwork.org/
2. Klikni **Sign up** → vyplň email, heslo
3. Potvrď email

### 2.2 Vytvorenie Application
1. Po prihlásení choď do **Console**: https://console.cloud.thethings.network/
2. Vyber región: **Europe 1** (eu1.cloud.thethings.network)
3. Klikni **Go to applications** → **+ Create application**
4. Vyplň:
   - **Application ID**: `beehive-monitor-001` (unikátne meno)
   - **Application name**: `Beehive Monitor`
   - **Description**: `IoT úľový monitoring systém`
5. Klikni **Create application**

### 2.3 Pridanie End Device (ESP32)
1. V aplikácii klikni **+ Register end device**
2. Vyber:
   - **Frequency plan**: `Europe 863-870 MHz (SF9 for RX2 - recommended)`
   - **LoRaWAN version**: `MAC V1.0.3` alebo `V1.0.2`
   - **Regional Parameters version**: `PHY V1.0.3 REV A`

3. **Device Identifiers:**
   - **JoinEUI**: `0000000000000000` (pre OTAA)
   - **DevEUI**: vygeneruj automaticky (klikni 🔄) alebo zadaj vlastný
   - **AppKey**: vygeneruj automaticky (klikni 🔄)
   - **End device ID**: `beehive-hive-001` ⚠️ **DÔLEŽITÉ: musí obsahovať "hive-001" pre HIVE-001**

4. Klikni **Register end device**

5. **Poznač si** (budú potrebné pre ESP32 kód):
   ```
   DevEUI:  70B3D57ED005XXXX
   AppEUI:  0000000000000000
   AppKey:  5A6B7C8D9E0F1A2B3C4D5E6F7A8B9C0D
   ```

---

## 💻 KROK 3: Naprogramovanie ESP32

### 3.1 Inštalácia knižníc v Arduino IDE

1. Otvor Arduino IDE
2. **Tools → Manage Libraries**
3. Nainštaluj:
   - `MCCI LoRaWAN LMIC library` by IBM
   - `DHT sensor library` by Adafruit
   - `Adafruit Unified Sensor`
   - `HX711 Arduino Library` by Bogdan Necula

### 3.2 Arduino kód

Vytvor nový sketch `beehive_lorawan.ino`:

```cpp
#include <lmic.h>
#include <hal/hal.h>
#include <SPI.h>
#include <DHT.h>
#include <HX711.h>

// ═══════════════════════════════════════════
// TTN CREDENTIALS - NAHRAĎ SVOJIMI HODNOTAMI!
// ═══════════════════════════════════════════
static const u1_t PROGMEM APPEUI[8] = { 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 };
void os_getArtEui (u1_t* buf) { memcpy_P(buf, APPEUI, 8); }

// DevEUI - MSB format (opačné poradie ako v TTN Console!)
static const u1_t PROGMEM DEVEUI[8] = { 0x70, 0xB3, 0xD5, 0x7E, 0xD0, 0x05, 0xXX, 0xXX };
void os_getDevEui (u1_t* buf) { memcpy_P(buf, DEVEUI, 8); }

// AppKey - MSB format
static const u1_t PROGMEM APPKEY[16] = { 
  0x5A, 0x6B, 0x7C, 0x8D, 0x9E, 0x0F, 0x1A, 0x2B, 
  0x3C, 0x4D, 0x5E, 0x6F, 0x7A, 0x8B, 0x9C, 0x0D 
};
void os_getDevKey (u1_t* buf) { memcpy_P(buf, APPKEY, 16); }

// ═══════════════════════════════════════════
// PIN CONFIGURATION
// ═══════════════════════════════════════════
#define DHT_PIN 4
#define DHT_TYPE DHT22

#define HX711_DOUT 21
#define HX711_SCK 22
#define CALIBRATION_FACTOR -7050.0 // Kalibrácia váhy

// LoRa SX1276/1278 pins
const lmic_pinmap lmic_pins = {
  .nss = 5,
  .rxtx = LMIC_UNUSED_PIN,
  .rst = 14,
  .dio = {26, 33, LMIC_UNUSED_PIN},
};

// ═══════════════════════════════════════════
// SENSORS
// ═══════════════════════════════════════════
DHT dht(DHT_PIN, DHT_TYPE);
HX711 scale;

static osjob_t sendjob;

// Interval medzi odoslaním dát (10 minút = 600 sekúnd)
const unsigned TX_INTERVAL = 600;

// ═══════════════════════════════════════════
// PAYLOAD ENCODING (9 bytes)
// ═══════════════════════════════════════════
void encodeSensorData(uint8_t* payload) {
  // Read sensors
  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();
  float weight = scale.get_units(10); // 10 readings average
  int battery = readBattery(); // Implement based on your circuit
  
  // Handle sensor errors
  if (isnan(temperature)) temperature = 0;
  if (isnan(humidity)) humidity = 0;
  if (weight < 0) weight = 0;
  
  // Encode to binary
  int16_t temp = (int16_t)(temperature * 10);
  int16_t humid = (int16_t)(humidity * 10);
  int32_t weightInt = (int32_t)(weight * 100);
  
  payload[0] = (temp >> 8) & 0xFF;
  payload[1] = temp & 0xFF;
  payload[2] = (humid >> 8) & 0xFF;
  payload[3] = humid & 0xFF;
  payload[4] = (weightInt >> 24) & 0xFF;
  payload[5] = (weightInt >> 16) & 0xFF;
  payload[6] = (weightInt >> 8) & 0xFF;
  payload[7] = weightInt & 0xFF;
  payload[8] = (uint8_t)battery;
  
  Serial.print("📊 Temp: "); Serial.print(temperature);
  Serial.print("°C, Humidity: "); Serial.print(humidity);
  Serial.print("%, Weight: "); Serial.print(weight);
  Serial.print("kg, Battery: "); Serial.print(battery);
  Serial.println("%");
}

int readBattery() {
  // Implement voltage divider reading on A0
  // Example: 3.7V LiPo battery (4.2V max, 3.0V min)
  int raw = analogRead(A0);
  float voltage = (raw / 4095.0) * 3.3 * 2; // Voltage divider ratio
  int percentage = map(voltage * 100, 300, 420, 0, 100);
  return constrain(percentage, 0, 100);
}

// ═══════════════════════════════════════════
// LORAWAN EVENT HANDLER
// ═══════════════════════════════════════════
void onEvent (ev_t ev) {
  Serial.print(os_getTime());
  Serial.print(": ");
  switch(ev) {
    case EV_JOINING:
      Serial.println("🔄 Joining TTN...");
      break;
    case EV_JOINED:
      Serial.println("✅ Joined TTN!");
      LMIC_setLinkCheckMode(0);
      break;
    case EV_JOIN_FAILED:
      Serial.println("❌ Join failed");
      break;
    case EV_TXCOMPLETE:
      Serial.println("✅ TX complete");
      if (LMIC.txrxFlags & TXRX_ACK)
        Serial.println("📨 Received ACK");
      if (LMIC.dataLen) {
        Serial.print("📥 Downlink: ");
        Serial.print(LMIC.dataLen);
        Serial.println(" bytes");
      }
      // Schedule next transmission
      os_setTimedCallback(&sendjob, os_getTime()+sec2osticks(TX_INTERVAL), do_send);
      break;
    default:
      Serial.print("Unknown event: ");
      Serial.println((unsigned) ev);
      break;
  }
}

void do_send(osjob_t* j) {
  // Check if there is not a current TX/RX job running
  if (LMIC.opmode & OP_TXRXPEND) {
    Serial.println("⚠️ OP_TXRXPEND, not sending");
  } else {
    // Prepare upstream data transmission
    uint8_t payload[9];
    encodeSensorData(payload);
    
    LMIC_setTxData2(1, payload, sizeof(payload), 0);
    Serial.println("📡 Packet queued");
  }
}

// ═══════════════════════════════════════════
// SETUP
// ═══════════════════════════════════════════
void setup() {
  Serial.begin(115200);
  delay(2000);
  Serial.println("🐝 Beehive LoRaWAN Monitor");
  
  // Initialize sensors
  dht.begin();
  scale.begin(HX711_DOUT, HX711_SCK);
  scale.set_scale(CALIBRATION_FACTOR);
  scale.tare(); // Reset to zero
  
  // LMIC init
  os_init();
  LMIC_reset();
  
  // Set data rate and transmit power (SF7 = fastest, SF12 = slowest but longest range)
  LMIC_setDrTxpow(DR_SF7, 14);
  
  // Start joining
  LMIC_startJoining();
  
  Serial.println("✅ Setup complete");
}

// ═══════════════════════════════════════════
// LOOP
// ═══════════════════════════════════════════
void loop() {
  os_runloop_once();
}
```

### 3.3 Nastavenie pre tvoj ESP32

**DÔLEŽITÉ úpravy:**

1. **TTN Credentials:**
   ```cpp
   // Skopíruj z TTN Console → End device → Overview
   static const u1_t PROGMEM DEVEUI[8] = { ... }; // MSB format!
   static const u1_t PROGMEM APPKEY[16] = { ... }; // MSB format!
   ```
   
   ⚠️ **TTN zobrazuje LSB, musíš prevrátiť poradie bytov!**
   
   Príklad:
   ```
   TTN Console (LSB): 70B3D57ED005A1B2
   Arduino kód (MSB): 0xB2, 0xA1, 0x05, 0xD0, 0x7E, 0xD5, 0xB3, 0x70
   ```

2. **PIN konfigurácia** - upraviť podľa tvojho zapojenia

3. **Kalibrácia váhy:**
   ```cpp
   #define CALIBRATION_FACTOR -7050.0 
   // Zisti kalibráciou s referenčnou váhou
   ```

### 3.4 Upload kódu

1. **Tools → Board** → Vyber svoj ESP32 (ESP32 Dev Module / ESP32-C3 / ...)
2. **Tools → Port** → Vyber COM port
3. **Upload** (Ctrl+U)

---

## 🔗 KROK 4: TTN Webhook do ebeehive.vercel.app

### 4.1 Vytvorenie Webhooku

1. V TTN Console → **Integrations** → **Webhooks** → **+ Add webhook**
2. Vyber **Custom webhook**
3. Vyplň:
   ```
   Webhook ID:       beehive-vercel
   Webhook format:   JSON
   Base URL:         https://ebeehive.vercel.app/api/lorawan/webhook
   ```

4. **Uplink message** - zapni ✅
5. Klikni **Create webhook**

### 4.2 Test webhooku

Po odoslaní prvých dát z ESP32:

1. TTN Console → **Live data** → vidíš uplink packety
2. Vercel app → Dashboard → vidíš nové dáta pre HIVE-001

---

## 📊 KROK 5: Overenie v aplikácii

### 5.1 Dashboard
1. Otvor https://ebeehive.vercel.app/
2. Choď do **Dashboard**
3. Vyber **HIVE-001** (alebo tvoj hive ID z device_id)
4. Uvidíš:
   - ✅ Teplota
   - ✅ Vlhkosť  
   - ✅ Hmotnosť
   - ✅ Batéria
   - ✅ **📡 LoRaWAN Signal card** - RSSI, SNR, Gateway ID, Spreading Factor

### 5.2 História
- **História** → grafy za posledných 24h/7d/30d
- Export dát do CSV

### 5.3 Notifikácie
1. **Nastavenia** → **🔔 Notifikácie**
2. Povoľ notifikácie
3. Vyber typy alertov:
   - 🌡️ Teplota mimo rozsahu
   - 💧 Vlhkosť mimo rozsahu
   - 🔋 Nízka batéria (<20%)
   - ⚖️ Zmena hmotnosti (>2kg/hod)
   - ⚠️ Zariadenie offline (>60 min)

---

## 🔧 Pokročilé nastavenia

### Zmena intervalu odosielania

V Arduino kóde:
```cpp
const unsigned TX_INTERVAL = 600; // 600s = 10 min
// Pre častejšie: 300 (5 min), pre menej: 1800 (30 min)
```

⚠️ **Fair Use Policy (FUP):**
- TTN limit: **30 sekúnd airtime za deň**
- SF7: ~60-100ms per packet → max ~300-500 packetov/deň
- SF12: ~1-2s per packet → max ~15-30 packetov/deň
- **Odporúčaný interval: 10-30 minút**

### Spreading Factor optimalizácia

```cpp
LMIC_setDrTxpow(DR_SF7, 14);  // Rýchle, krátky dosah (~1-2 km)
LMIC_setDrTxpow(DR_SF9, 14);  // Balans (5-10 km)
LMIC_setDrTxpow(DR_SF12, 14); // Pomalé, dlhý dosah (15+ km)
```

### Adaptívny Data Rate (ADR)

```cpp
LMIC_setAdrMode(1); // Zapne ADR - TTN automaticky optimalizuje SF
```

---

## 🐛 Troubleshooting

### ESP32 sa nepripojí k TTN

**Problém:** `EV_JOIN_FAILED` alebo stále `Joining...`

**Riešenia:**
1. ✅ Skontroluj **DevEUI, AppEUI, AppKey** - musia byť v **MSB formáte**
2. ✅ Skontroluj **frekvenčný plán** - EU868 pre Európu
3. ✅ Skontroluj **antenna** - pripojená, správna pre 868 MHz
4. ✅ Blízkosť gateway - musíš byť v dosahu TTN gateway (pozri https://ttnmapper.org/)
5. ✅ LoRa modul zapojenie - MISO/MOSI/SCK/NSS/RST/DIO0

### TTN prijíma dáta ale nič v Dashboard

**Problém:** TTN Live Data ukazuje uplink ale Dashboard je prázdny

**Riešenia:**
1. ✅ Webhook správne nakonfigurovaný: `https://ebeehive.vercel.app/api/lorawan/webhook`
2. ✅ TTN Console → Webhooks → **Live data** - skontroluj či sú requesty úspešné (200 OK)
3. ✅ **device_id** musí obsahovať `hive-XXX` (napr. `beehive-hive-001`)
4. ✅ Payload má 9 bytov

**Debug:**
```bash
# Skontroluj Vercel logy
curl "https://ebeehive.vercel.app/api/sensor/latest?hiveId=HIVE-001"
```

### Senzory vracajú nesprávne hodnoty

**DHT22 vracia NaN:**
- Skontroluj zapojenie DATA pinu
- Pridaj 10kΩ pull-up rezistor medzi DATA a VCC
- Vymeň DHT22 (niekedy bývajú pokazené)

**HX711 vracia 0 alebo náhodné čísla:**
- Skontroluj zapojenie load cell (4 káble správne pripojené)
- Kalibrácia:
  ```cpp
  scale.set_scale();
  scale.tare();
  // Vlož známu váhu (napr. 1kg)
  float reading = scale.get_units(10);
  float factor = reading / 1000.0; // Pre 1kg
  // Nastav CALIBRATION_FACTOR na factor
  ```

### Slabý LoRa signál (RSSI < -120 dBm)

**Riešenia:**
1. Zlepši anténu - použiť externú 868 MHz anténu
2. Premiestni zariadenie - von z kovových objektov
3. Zvýš Spreading Factor: `DR_SF9` alebo `DR_SF12`
4. Skontroluj gateway pozíciu: https://ttnmapper.org/

---

## 📈 Optimalizácia spotreby

### Deep Sleep mode

Pre batériový provoz:

```cpp
#include <esp_sleep.h>

void goToSleep(int seconds) {
  Serial.print("💤 Going to sleep for ");
  Serial.print(seconds);
  Serial.println(" seconds");
  
  esp_sleep_enable_timer_wakeup(seconds * 1000000ULL);
  esp_deep_sleep_start();
}

// V loop() po TX_COMPLETE:
case EV_TXCOMPLETE:
  Serial.println("✅ TX complete");
  // Spať 10 minút
  goToSleep(600);
  break;
```

**Spotreba:**
- Active mode: ~80-200 mA
- Deep sleep: ~10-50 µA
- S 10 min intervalom: priemerná spotreba ~1-3 mA

**Batéria:**
- 2500 mAh LiPo: ~1-2 mesiace
- S 5W solárnym panelom: neobmedzene (ak je dostatok slnka)

---

## 🎯 Checklist pred nasadením

- [ ] ESP32 sa pripája k TTN (`EV_JOINED`)
- [ ] TTN Live Data zobrazuje uplinky
- [ ] Webhook volá ebeehive.vercel.app (200 OK)
- [ ] Dashboard zobrazuje dáta pre HIVE-001
- [ ] DHT22 číta správne hodnoty
- [ ] HX711 je kalibrovaný
- [ ] Batéria/napájanie funkčné
- [ ] Antenna pripojená
- [ ] Interval odosielania optimalizovaný (10-30 min)
- [ ] Notifikácie nakonfigurované
- [ ] Zariadenie je vodotesné (ak vonku)

---

## 📚 Dodatočné zdroje

- **TTN Documentation**: https://www.thethingsnetwork.org/docs/
- **LoRaWAN Specification**: https://lora-alliance.org/resource_hub/lorawan-specification-v1-0-3/
- **TTN Gateway Map**: https://ttnmapper.org/
- **ESP32 LoRa Library**: https://github.com/mcci-catena/arduino-lmic
- **Beehive Monitor Repo**: https://github.com/LusnakSimon/beehive

---

## 🆘 Podpora

Ak máš problémy:

1. **GitHub Issues**: https://github.com/LusnakSimon/beehive/issues
2. **TTN Forum**: https://www.thethingsnetwork.org/forum/
3. **Serial Monitor** - skopíruj výstup pre debug

---

**Vyrobil 🐝 Beehive Monitor Team**  
**Posledná aktualizácia: November 2025**
