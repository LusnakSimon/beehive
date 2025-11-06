# Beehive Monitor - LoRaWAN Verzia

ESP32-C3 firmware pre meranie úľových parametrov s LoRaWAN komunikáciou.

## Hardvér

### Komponenty
- **ESP32-C3** - hlavný mikrokontrolér
- **DHT22** - teplota a vlhkosť
- **HX711 + Load Cell** - meranie hmotnosti
- **LoRa modul** - RFM95, SX1276 alebo SX1278 (868 MHz pre EU)

### Zapojenie

#### DHT22
- VCC → 3.3V
- GND → GND
- DATA → GPIO4

#### HX711
- VCC → 5V (ak je dostupné) alebo 3.3V
- GND → GND
- DOUT → GPIO5
- SCK → GPIO6

#### LoRa Modul (SPI)
- VCC → 3.3V
- GND → GND
- MISO → GPIO2
- MOSI → GPIO7
- SCK → GPIO8
- NSS (CS) → GPIO8
- RESET → GPIO9
- DIO0 → GPIO3
- DIO1 → GPIO10

#### Batéria
- Voltage divider na GPIO0/A0 (R1=10kΩ, R2=10kΩ)

## Knižnice

Nainštaluj v Arduino IDE cez Library Manager:
1. **MCCI LoRaWAN LMIC library** by IBM, Matthijs Kooijman, Terry Moore
2. **DHT sensor library** by Adafruit
3. **HX711 Arduino Library** by Bogdan Necula

## Konfigurácia The Things Network (TTN)

### 1. Vytvor aplikáciu
1. Prihlás sa na [console.thethingsnetwork.org](https://console.thethingsnetwork.org)
2. Applications → Add application
3. Vyplň názov a ID

### 2. Registruj zariadenie
1. Otvor aplikáciu → End devices → Add end device
2. **Activation mode**: Over the air activation (OTAA)
3. **LoRaWAN version**: MAC V1.0.3
4. **Regional Parameters version**: PHY V1.0.3 REV A
5. **Frequency plan**: Europe 863-870 MHz (SF9 for RX2)
6. **JoinEUI/AppEUI**: Vygeneruj alebo nechaj 0000000000000000
7. **DevEUI**: Vygeneruj automaticky
8. **AppKey**: Vygeneruj automaticky

### 3. Skopíruj kľúče do firmware
Otvor `beehive_lorawan.ino` a nahraď:
```cpp
static const u1_t PROGMEM APPEUI[8] = { 0xYY, 0xYY, ... }; // LSB formát!
static const u1_t PROGMEM DEVEUI[8] = { 0xXX, 0xXX, ... }; // LSB formát!
static const u1_t PROGMEM APPKEY[16] = { 0xZZ, 0xZZ, ... }; // MSB formát!
```

**POZOR**: TTN zobrazuje hodnoty v MSB, ale LMIC vyžaduje LSB pre EUI.
- Použi tlačidlo `<>` (toggle array format) v TTN konzole
- Pre APPEUI a DEVEUI použi LSB
- Pre APPKEY použi MSB

### 4. Payload Formatter

V TTN konzole → Payload formatters → Uplink → Custom Javascript formatter:

```javascript
function decodeUplink(input) {
  var data = {};
  
  if (input.bytes.length === 9) {
    // Temperature (°C)
    data.temperature = ((input.bytes[0] << 8) | input.bytes[1]) / 100.0;
    
    // Humidity (%)
    data.humidity = ((input.bytes[2] << 8) | input.bytes[3]) / 100.0;
    
    // Weight (kg)
    data.weight = ((input.bytes[4] << 24) | (input.bytes[5] << 16) | 
                   (input.bytes[6] << 8) | input.bytes[7]) / 100.0;
    
    // Battery (%)
    data.battery = input.bytes[8];
  }
  
  return {
    data: data
  };
}
```

### 5. Webhook Integration

Integrations → Webhooks → Add webhook → Custom webhook:
- **Webhook ID**: beehive-monitor
- **Webhook format**: JSON
- **Base URL**: `https://tvoja-domena.com/api/lorawan/webhook`
- **Enabled messages**: Uplink message

## Nahratie kódu

1. Pripoj ESP32-C3 cez USB
2. Arduino IDE → Tools:
   - Board: "ESP32C3 Dev Module"
   - Port: vyber správny COM/ttyUSB port
3. Verify → Upload

## Monitorovanie

```bash
# Serial monitor (115200 baud)
Beehive LoRaWAN
Queued
TX complete
```

Po úspešnom join uvidíš v TTN konzole Live data.

## Parametre

- **Interval posielania**: 15 minút (TX_INTERVAL = 900s)
- **Spreading factor**: SF7 (najrýchlejší, kratší dosah)
- **TX power**: 14 dBm
- **Payload size**: 9 bytov

## Troubleshooting

### Zariadenie sa nepripojí
- Skontroluj kľúče (LSB/MSB formát)
- Uisti sa, že je v dosahu gateway
- Skontroluj frekvenciu (868 MHz pre EU)

### Neodosielaju sa dáta
- Pozri Serial monitor pre chybové hlášky
- Skontroluj SPI zapojenie LoRa modulu
- Skús zvýšiť TX power alebo SF

### Nefunkčné senzory
- DHT22: skontroluj napájanie a GPIO4
- HX711: skontroluj kalibráciu (`scale.set_scale()`)

## Výhody LoRaWAN vs WiFi

✅ Nízka spotreba energie (roky na batériu)  
✅ Dlhý dosah (až 10+ km na vidieku)  
✅ Funguje aj v kovových úľoch  
❌ Pomalá komunikácia (len každých 15 min)  
❌ Vyžaduje gateway v dosahu
