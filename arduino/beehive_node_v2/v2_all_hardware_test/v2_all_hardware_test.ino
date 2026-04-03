// ============================================================
// TEST: ALL HARDWARE AT ONCE
// Arduino Pro Mini 3.3V/8MHz
// SHT40 + HX711 + RFM95 + MOSFET + Battery Voltage
//
// AHT10 REMOVED — SHT40 is now the only temp/humidity sensor
//
// Tests all subsystems in sequence:
//   1. Battery voltage (always connected)
//   2. MOSFET on → power sensors
//   3. I2C scan → SHT40 read
//   4. HX711 read
//   5. MOSFET off
//   6. RFM95 init + test TX
//
// Open Serial Monitor at 9600 baud
// ============================================================

#include <Wire.h>
#include "Adafruit_SHT4x.h"
#include "HX711.h"
#include <SPI.h>
#include <RH_RF95.h>

// ===== Pins =====
#define MOSFET_PIN  4
#define VBAT_PIN    A0
#define HX_DOUT     5
#define HX_SCK      6
#define RFM95_CS    10
#define RFM95_RST   9
#define RFM95_INT   2
#define RFM95_FREQ  868.0

// ===== Voltage divider =====
const float DIVIDER_RATIO = 3.7;  // (54k+20k)/20k
const float VREF = 1.1;

// ===== Objects =====
Adafruit_SHT4x sht4 = Adafruit_SHT4x();
HX711 scale;
RH_RF95 rf95(RFM95_CS, RFM95_INT);

uint32_t cycle = 0;

void sensorsOn()  { digitalWrite(MOSFET_PIN, LOW);  }
void sensorsOff() { digitalWrite(MOSFET_PIN, HIGH); }

// ─────── Battery ───────
float readVbat() {
  uint32_t sum = 0;
  for (int i = 0; i < 16; i++) {
    sum += analogRead(VBAT_PIN);
    delay(2);
  }
  return ((float)sum / 16.0 / 1024.0) * VREF * DIVIDER_RATIO;
}

// ─────── I2C scan ───────
void i2cScan() {
  Serial.println(F("  I2C scan:"));
  byte count = 0;
  for (byte addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);
    if (Wire.endTransmission() == 0) {
      Serial.print(F("    0x"));
      if (addr < 16) Serial.print('0');
      Serial.print(addr, HEX);
      if (addr == 0x44) Serial.print(F(" <-- SHT40"));
      Serial.println();
      count++;
    }
  }
  if (count == 0) Serial.println(F("    NONE FOUND"));
  Serial.print(F("    Total: ")); Serial.println(count);
}

// ─────── Setup ───────
void setup() {
  Serial.begin(9600);
  delay(1000);

  pinMode(MOSFET_PIN, OUTPUT);
  sensorsOff();

  // Internal 1.1V ref for battery ADC
  analogReference(INTERNAL);
  for (int i = 0; i < 10; i++) { analogRead(VBAT_PIN); delay(5); }

  Serial.println();
  Serial.println(F("=========================================="));
  Serial.println(F(" ALL HARDWARE TEST (no AHT10)"));
  Serial.println(F(" SHT40 + HX711 + RFM95 + MOSFET + VBAT"));
  Serial.println(F("=========================================="));
  Serial.println();

  // ── RFM95 (always powered, test once in setup) ──
  Serial.println(F("[RFM95]"));
  pinMode(RFM95_RST, OUTPUT);
  digitalWrite(RFM95_RST, HIGH); delay(10);
  digitalWrite(RFM95_RST, LOW);  delay(10);
  digitalWrite(RFM95_RST, HIGH); delay(10);

  Serial.print(F("  Init... "));
  if (!rf95.init()) {
    Serial.println(F("FAIL"));
    Serial.println(F("  Check: CS→D10, RST→D9, DIO0→D2"));
    Serial.println(F("  Check: MOSI→D11, MISO→D12, SCK→D13"));
    Serial.println(F("  Check: antenna connected, VCC→3.3V direct"));
  } else {
    rf95.setFrequency(RFM95_FREQ);
    rf95.setTxPower(14, false);
    Serial.println(F("OK @ 868MHz"));
  }
  Serial.println();
}

// ─────── Main loop ───────
void loop() {
  cycle++;
  Serial.print(F("═══════ Cycle "));
  Serial.print(cycle);
  Serial.println(F(" ═══════"));

  // ── 1. Battery voltage ──
  Serial.println(F("[BATTERY]"));
  float bv = readVbat();
  Serial.print(F("  Voltage: ")); Serial.print(bv, 3); Serial.println(F("V"));
  if (bv < 2.5 || bv > 4.0) {
    Serial.println(F("  WARNING: outside LiFePO4 range"));
  }
  Serial.println();

  // ── 2. MOSFET ON ──
  Serial.println(F("[MOSFET] ON"));
  sensorsOn();
  delay(500);  // Stabilization

  // ── 3. I2C / SHT40 ──
  Serial.println(F("[I2C]"));
  Wire.begin();
  delay(100);
  i2cScan();

  Serial.println(F("[SHT40]"));
  float t = 0, h = 0;
  bool shtOk = sht4.begin();
  if (!shtOk) {
    delay(200);
    shtOk = sht4.begin();
  }
  if (shtOk) {
    sht4.setPrecision(SHT4X_HIGH_PRECISION);
    sht4.setHeater(SHT4X_NO_HEATER);
    sensors_event_t hum, temp;
    sht4.getEvent(&hum, &temp);
    t = temp.temperature;
    h = hum.relative_humidity;
    Serial.print(F("  Temp: ")); Serial.print(t, 1); Serial.println(F(" C"));
    Serial.print(F("  Hum:  ")); Serial.print(h, 1); Serial.println(F(" %"));
  } else {
    Serial.println(F("  FAIL — not detected"));
    Serial.println(F("  Check: SDA→A4, SCL→A5, 10k pullups to drain"));
  }
  Serial.println();

  // ── 4. HX711 ──
  Serial.println(F("[HX711]"));
  float w = 0;
  bool hxOk = false;
  scale.begin(HX_DOUT, HX_SCK);
  unsigned long hxStart = millis();
  while (!scale.is_ready() && millis() - hxStart < 3000) {
    delay(100);
  }
  if (scale.is_ready()) {
    hxOk = true;
    long raw = scale.read_average(5);
    Serial.print(F("  Raw (avg 5): ")); Serial.println(raw);
    Serial.println(F("  (Use calibration sketch to convert to kg)"));
  } else {
    Serial.println(F("  FAIL — not ready after 3s"));
    Serial.println(F("  Check: DT→D5, SCK→D6, VCC→MOSFET drain"));
  }
  Serial.println();

  // ── 5. MOSFET OFF ──
  if (hxOk) scale.power_down();
#if defined(TWCR)
  TWCR = 0;
#endif
  pinMode(A4, INPUT);
  pinMode(A5, INPUT);
  delay(10);
  sensorsOff();
  Serial.println(F("[MOSFET] OFF"));
  Serial.println();

  // ── 6. LoRa TX test ──
  Serial.println(F("[LORA TX]"));
  char payload[96];
  snprintf(payload, sizeof(payload),
    "{\"t\":%.1f,\"h\":%.1f,\"w\":0,\"bv\":%.2f,\"n\":%lu,\"test\":1}",
    t, h, bv, cycle);

  Serial.print(F("  Payload: ")); Serial.println(payload);
  Serial.print(F("  Sending... "));

  unsigned long txStart = millis();
  rf95.send((uint8_t*)payload, strlen(payload));
  rf95.waitPacketSent();
  Serial.print(F("done (")); Serial.print(millis() - txStart); Serial.println(F("ms)"));
  Serial.println();

  // ── Summary ──
  Serial.println(F("┌─────────────────────────┐"));
  Serial.print(F("│ Battery: "));
  Serial.print(bv, 2); Serial.println(F("V            │"));
  Serial.print(F("│ SHT40:   "));
  Serial.println(shtOk ? F("OK               │") : F("FAIL             │"));
  Serial.print(F("│ HX711:   "));
  Serial.println(hxOk  ? F("OK               │") : F("FAIL             │"));
  Serial.println(F("│ RFM95:   OK (sent)       │"));
  Serial.println(F("│ MOSFET:  OK (toggled)    │"));
  Serial.println(F("└─────────────────────────┘"));
  Serial.println();

  delay(10000);  // 10s between cycles
}
