# Beehive Monitor - ESP32 Arduino

ESP32-C3 firmware pre monitorovanie úľov s podporou WiFi a LoRaWAN.

## 📁 Verzie firmwaru

### WiFi verziam (beehive_monitor/)
Štandardná verzia s WiFi pripojením a HTTP komunikáciou.

### LoRaWAN verzia (beehive_lorawan/)
Verzia pre dlhý dosah s nízkou spotrebou energie.
- Dosah: až 10+ km v otvorenom teréne
- Batéria: mesiace až roky
- Vyžaduje: LoRaWAN gateway + The Things Network účet

## Potrebné knižnice

### Pre WiFi verziu:
Nainštalujte v Arduino IDE cez Library Manager:

- **DHT sensor library** (by Adafruit) - pre DHT22 senzor
- **Adafruit Unified Sensor** - závislosť pre DHT
- **HX711 Arduino Library** (by Bogdan Necula) - pre váhu

### Pre LoRaWAN verziu:
Dodatočne k vyššie uvedeným:

- **MCCI LoRaWAN LMIC library** - pre LoRaWAN komunikáciu
- **MCCI Arduino LoRaWAN Library** - higher-level LoRaWAN API

Pozri `beehive_lorawan/README.md` pre detailné inštrukcie.

## Zapojenie senzorov

### DHT22 (Teplota & Vlhkosť)
- VCC → 3.3V
- GND → GND
- DATA → GPIO 4

### HX711 (Váha)
- VCC → 5V
- GND → GND
- DOUT → GPIO 5
- SCK → GPIO 6

### Batéria (voliteľné)
- Batéria+ → A0 cez odporový delič (ak používate batériu)

## Kalibrácia váhy

1. Nahrajte kód s `scale.tare()` zakomentovaným
2. Otvorte sériový monitor
3. Položte známu hmotnosť (napr. 1 kg)
4. Upravte `CALIBRATION_FACTOR` kým nezobrazuje správnu hodnotu
5. Spustite `scale.tare()` pre vynulovanie

## Konfigurácia

### WiFi verzia
V kóde upravte:

```cpp
const char* ssid = "VASA_WIFI_SIET";
const char* password = "VASE_HESLO";
const char* serverUrl = "http://your-server.com/api/esp32/data";
const char* apiKey = "beehive-secret-key-2024";
#define HIVE_ID "HIVE-001"
```

### LoRaWAN verzia
V web aplikácii prejdite do **Nastavenia → LoRaWAN Configuration**:
1. Zadajte DevEUI, AppEUI, AppKey z The Things Network
2. Kliknite "Copy ESP32 Code" pre vygenerovaný kód
3. Skopírujte kód do `beehive_lorawan.ino`

Viac info v `LORAWAN_SETUP.md` v root adresári.

## Nahratie do ESP32-C3

1. Otvorte Arduino IDE
2. **Tools → Board → ESP32 Arduino → ESP32C3 Dev Module**
3. **Tools → Port** - vyberte správny COM port
4. Kliknite **Upload**

## Testovanie

Otvorte sériový monitor (115200 baud) a sledujte výpis:

```
🐝 Beehive Monitor - ESP32-C3
✅ Senzory inicializované
🔌 Pripájam sa na WiFi...
✅ WiFi pripojená!
   IP adresa: 192.168.1.100

📊 Nové meranie:
  Teplota: 32.5°C
  Vlhkosť: 55.2%
  Hmotnosť: 48.75 kg
  Batéria: 85%
📤 Odosielam dáta...
✅ Server odpoveď [201]: {"success":true}
```

## Napájanie

- USB-C kábel pre vývoj
- 5V napájací zdroj alebo Li-Ion batéria + TP4056 modul pre produkciu
- Pre batériové napájanie pridajte deep sleep režim

## Riešenie problémov

**WiFi sa nepripojí:**
- Skontrolujte SSID a heslo
- ESP32-C3 podporuje len 2.4 GHz WiFi

**DHT22 nefunguje:**
- Skontrolujte zapojenie
- Pridajte 10kΩ pull-up rezistor medzi DATA a VCC

**Váha ukazuje nesprávne hodnoty:**
- Prekalibrujte pomocou známej hmotnosti
- Skontrolujte napájanie HX711 (potrebuje stabilných 5V)

**HTTP chyba:**
- Skontrolujte server URL
- Overte API kľúč v `.env` súbore servera
