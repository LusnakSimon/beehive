// ============================================================
// BEEHIVE SENSOR NODE - ESP32-C3 SuperMini + AHT10 + HX711 + RFM95
// Sends raw LoRa packets every 30 seconds
// ============================================================

#include <Wire.h>
#include <Adafruit_AHTX0.h>
#include <SPI.h>
#include <RH_RF95.h>
#include "HX711.h"

// ===== I2C (AHT10) =====
#define SDA_PIN 8
#define SCL_PIN 9

// ===== HX711 (Load Cell) =====
#define HX_DOUT 3
#define HX_SCK  1

// ===== RFM95 (LoRa) =====
#define RFM95_CS   7
#define RFM95_RST  10
#define RFM95_INT  2   // DIO0
#define RFM95_FREQ 868.0

// ===== Calibration =====
// Adjust this after calibrating with known weights
// weight_kg = raw_reading / CALIBRATION_FACTOR
const float CALIBRATION_FACTOR = 420000.0; // example: adjust for your load cell

// ===== Objects =====
Adafruit_AHTX0 aht;
RH_RF95 rf95(RFM95_CS, RFM95_INT);
HX711 scale;

uint32_t counter = 0;

void setup() {
  Serial.begin(115200);
  delay(2000);
  Serial.println("\n=== BEEHIVE SENSOR NODE ===");

  // --- I2C / AHT10 ---
  Wire.begin(SDA_PIN, SCL_PIN);
  if (!aht.begin()) {
    Serial.println("ERROR: AHT10 not found");
    while (1) delay(1000);
  }
  Serial.println("AHT10 OK");

  // --- HX711 ---
  scale.begin(HX_DOUT, HX_SCK);
  Serial.print("HX711 init");
  unsigned long start = millis();
  while (!scale.is_ready() && millis() - start < 3000) {
    Serial.print(".");
    delay(100);
  }
  Serial.println(scale.is_ready() ? " OK" : " NOT READY");

  // --- RFM95 ---
  pinMode(RFM95_RST, OUTPUT);
  digitalWrite(RFM95_RST, HIGH);
  delay(10);
  digitalWrite(RFM95_RST, LOW);
  delay(10);
  digitalWrite(RFM95_RST, HIGH);
  delay(10);

  if (!rf95.init()) {
    Serial.println("ERROR: RFM95 init failed");
    while (1) delay(1000);
  }
  rf95.setFrequency(RFM95_FREQ);
  rf95.setTxPower(14, false);
  Serial.println("RFM95 OK @ 868 MHz");
  Serial.println("===========================\n");
}

void loop() {
  // Read AHT10
  sensors_event_t humidity, temperature;
  aht.getEvent(&humidity, &temperature);
  float t = temperature.temperature;
  float h = humidity.relative_humidity;

  // Read HX711
  long raw_weight = 0;
  float weight_kg = 0.0;
  bool hx_ok = false;
  if (scale.is_ready()) {
    raw_weight = scale.read_average(3);
    weight_kg = (float)raw_weight / CALIBRATION_FACTOR;
    if (weight_kg < 0) weight_kg = 0; // clamp negative
    hx_ok = true;
  }

  // Build payload string
  // Format: T=<temp>C H=<hum>% W=<weight_kg> R=<raw> X=<hx_ok> #<counter>
  char payload[128];
  snprintf(payload, sizeof(payload),
           "T=%.2fC H=%.1f%% W=%.3f R=%ld X=%d #%lu",
           t, h, weight_kg, raw_weight, hx_ok ? 1 : 0, counter++);

  Serial.print("TX: ");
  Serial.println(payload);

  // Send via LoRa
  rf95.send((uint8_t*)payload, strlen(payload));
  rf95.waitPacketSent();

  // Sleep 30 seconds
  delay(30000);
}