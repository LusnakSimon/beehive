/*
 * Beehive Monitor with LoRaWAN
 * ESP32-C3 + DHT22 + HX711 + LoRa (RFM95/SX1276)
 * 
 * LoRaWAN Configuration:
 * - Frequency: EU868 (adjust for your region)
 * - OTAA (Over-The-Air Activation)
 * - Class A device
 */

#include <Arduino.h>
#include <DHT.h>
#include <HX711.h>
#include <lmic.h>
#include <hal/hal.h>
#include <SPI.h>

// DHT22 Sensor
#define DHTPIN 4
#define DHTTYPE DHT22
DHT dht(DHTPIN, DHTTYPE);

// HX711 Load Cell
#define LOADCELL_DOUT_PIN 5
#define LOADCELL_SCK_PIN 6
HX711 scale;

// LoRaWAN Credentials (OTAA)
// CHANGE THESE - získaj z The Things Network
static const u1_t PROGMEM APPEUI[8] = { 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 };
static const u1_t PROGMEM DEVEUI[8] = { 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 };
static const u1_t PROGMEM APPKEY[16] = { 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 };

void os_getArtEui (u1_t* buf) { memcpy_P(buf, APPEUI, 8); }
void os_getDevEui (u1_t* buf) { memcpy_P(buf, DEVEUI, 8); }
void os_getDevKey (u1_t* buf) { memcpy_P(buf, APPKEY, 16); }

// LoRa Pin Mapping for ESP32
const lmic_pinmap lmic_pins = {
    .nss = 8,
    .rxtx = LMIC_UNUSED_PIN,
    .rst = 9,
    .dio = {3, 10, LMIC_UNUSED_PIN},
};

static osjob_t sendjob;
const unsigned TX_INTERVAL = 900; // 15 minutes

struct SensorData {
  float temperature;
  float humidity;
  float weight;
  uint8_t battery;
} sensorData;

void readSensors() {
  float h = dht.readHumidity();
  float t = dht.readTemperature();
  
  if (!isnan(h) && !isnan(t)) {
    sensorData.temperature = t;
    sensorData.humidity = h;
  }
  
  if (scale.is_ready()) {
    sensorData.weight = scale.get_units(10);
  }
  
  int adcValue = analogRead(A0);
  float voltage = (adcValue / 4095.0) * 3.3 * 2;
  sensorData.battery = map(voltage * 100, 320, 420, 0, 100);
  sensorData.battery = constrain(sensorData.battery, 0, 100);
}

void onEvent (ev_t ev) {
    if(ev == EV_TXCOMPLETE) {
        Serial.println(F("TX complete"));
        os_setTimedCallback(&sendjob, os_getTime()+sec2osticks(TX_INTERVAL), do_send);
    }
}

void do_send(osjob_t* j) {
    if (LMIC.opmode & OP_TXRXPEND) {
        Serial.println(F("Busy"));
    } else {
        readSensors();
        
        uint8_t payload[9];
        int16_t temp_int = (int16_t)(sensorData.temperature * 100);
        payload[0] = (temp_int >> 8) & 0xFF;
        payload[1] = temp_int & 0xFF;
        
        int16_t hum_int = (int16_t)(sensorData.humidity * 100);
        payload[2] = (hum_int >> 8) & 0xFF;
        payload[3] = hum_int & 0xFF;
        
        int32_t weight_int = (int32_t)(sensorData.weight * 100);
        payload[4] = (weight_int >> 24) & 0xFF;
        payload[5] = (weight_int >> 16) & 0xFF;
        payload[6] = (weight_int >> 8) & 0xFF;
        payload[7] = weight_int & 0xFF;
        
        payload[8] = sensorData.battery;
        
        LMIC_setTxData2(1, payload, sizeof(payload), 0);
        Serial.println(F("Queued"));
    }
}

void setup() {
    Serial.begin(115200);
    Serial.println(F("Beehive LoRaWAN"));
    
    dht.begin();
    scale.begin(LOADCELL_DOUT_PIN, LOADCELL_SCK_PIN);
    scale.set_scale(2280.f);
    scale.tare();
    
    os_init();
    LMIC_reset();
    LMIC_setLinkCheckMode(0);
    LMIC_setDrTxpow(DR_SF7, 14);
    
    do_send(&sendjob);
}

void loop() {
    os_runloop_once();
}
