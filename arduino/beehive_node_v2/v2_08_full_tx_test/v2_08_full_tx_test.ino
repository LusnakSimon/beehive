// ============================================================
// TEST 08: FULL SENSOR READ + JSON TX TEST
// Arduino Pro Mini 3.3V/8MHz - All sensors + LoRa
//
// PURPOSE: Verify all sensors read correctly together and
//          JSON payload transmits over LoRa
//          No sleep - continuous loop for easy debugging
// SETUP:   All hardware connected (MOSFET, SHT40,
//          HX711, RFM95, voltage divider)
//
// PAYLOAD FORMAT:
// {"t":21.5,"h":55.3,"w":45.12,"bv":3.25,"bp":40,"n":1}
//   t  = temperature (SHT40)
//   h  = humidity (SHT40)
//   w  = weight in kg (HX711)
//   bv = battery voltage
//   bp = battery percent
//   n  = counter
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

// ===== Feature toggle =====
#define WEIGHT_ENABLED      false    // Set true after calibration

// ===== Calibration (update from test 07) =====
#define CALIBRATION_FACTOR  1.0      // raw units per gram — UPDATE
#define TARE_OFFSET         0        // raw value with no weight — UPDATE

// ===== Voltage divider =====
const float DIVIDER_RATIO = 3.7;  // (54k+20k)/20k
const float VREF = 1.1;

// ===== LiFePO4 lookup =====
struct VoltPt { float v; uint8_t p; };
const VoltPt LFP[] = {
  {3.40,100},{3.35,90},{3.33,80},{3.30,60},
  {3.25,40},{3.20,20},{3.10,10},{2.80,0}
};
const int LFP_N = sizeof(LFP)/sizeof(LFP[0]);

// ===== Objects =====
Adafruit_SHT4x sht4 = Adafruit_SHT4x();
#if WEIGHT_ENABLED
HX711 scale;
#endif
RH_RF95 rf95(RFM95_CS, RFM95_INT);

uint32_t counter = 0;

void sensorsOn()  { digitalWrite(MOSFET_PIN, LOW);  }
void sensorsOff() { digitalWrite(MOSFET_PIN, HIGH); }

float readVbat() {
  uint32_t sum = 0;
  for (int i = 0; i < 16; i++) {
    sum += analogRead(VBAT_PIN);
    delay(2);
  }
  return ((float)sum / 16.0 / 1024.0) * VREF * DIVIDER_RATIO;
}

int battPct(float v) {
  if (v >= LFP[0].v) return 100;
  if (v <= LFP[LFP_N-1].v) return 0;
  for (int i = 0; i < LFP_N-1; i++) {
    if (v >= LFP[i+1].v) {
      float rv = LFP[i].v - LFP[i+1].v;
      float rp = LFP[i].p - LFP[i+1].p;
      return LFP[i+1].p + (int)(((v - LFP[i+1].v) / rv) * rp);
    }
  }
  return 0;
}

void setup() {
  Serial.begin(9600);
  delay(1000);

  Serial.println();
  Serial.println(F("=== TEST 08: FULL TX TEST ==="));

  // MOSFET off initially
  pinMode(MOSFET_PIN, OUTPUT);
  sensorsOff();

  // Battery ADC (internal 1.1V ref)
  analogReference(INTERNAL);
  for (int i = 0; i < 10; i++) { analogRead(VBAT_PIN); delay(5); }

  // Init RFM95 (always powered)
  pinMode(RFM95_RST, OUTPUT);
  digitalWrite(RFM95_RST, HIGH);
  delay(10);
  digitalWrite(RFM95_RST, LOW);
  delay(10);
  digitalWrite(RFM95_RST, HIGH);
  delay(10);

  if (!rf95.init()) {
    Serial.println(F("RFM95 FAIL - check wiring"));
    while (1);
  }
  rf95.setFrequency(RFM95_FREQ);
  rf95.setTxPower(14, false);
  Serial.println(F("RFM95 OK @ 868MHz"));

  Serial.println(F("=============================\n"));
}

void loop() {
  Serial.println(F("--- Reading cycle ---"));

  // 1. Battery voltage (always accessible)
  float bv = readVbat();
  int bp = battPct(bv);
  Serial.print(F("Battery: "));
  Serial.print(bv, 3);
  Serial.print(F("V ("));
  Serial.print(bp);
  Serial.println(F("%)"));

  // 2. Power up sensors
  sensorsOn();
  delay(500);  // Stabilization

  // 3. Init I2C + sensors
  Wire.begin();
  delay(50);

  // SHT40 (temp/humidity)
  float t = 0, h = 0;
  bool shtOk = sht4.begin();
  if (shtOk) {
    sht4.setPrecision(SHT4X_HIGH_PRECISION);
    sht4.setHeater(SHT4X_NO_HEATER);
    sensors_event_t hum, temp;
    sht4.getEvent(&hum, &temp);
    t = temp.temperature;
    h = hum.relative_humidity;
    Serial.print(F("SHT40: T="));
    Serial.print(t, 1);
    Serial.print(F("C H="));
    Serial.print(h, 1);
    Serial.println(F("%"));
  } else {
    Serial.println(F("SHT40: FAIL"));
  }

  // HX711 (weight) — only if enabled
  float w = 0;
#if WEIGHT_ENABLED
  bool hxOk = false;
  scale.begin(HX_DOUT, HX_SCK);
  unsigned long hxStart = millis();
  while (!scale.is_ready() && millis() - hxStart < 3000) {
    delay(100);
  }
  if (scale.is_ready()) {
    long raw = scale.read_average(10);
    float grams = (float)(raw - TARE_OFFSET) / CALIBRATION_FACTOR;
    w = grams / 1000.0;
    if (w < 0) w = 0;
    if (w > 200) w = 200;
    hxOk = true;
    Serial.print(F("HX711: raw="));
    Serial.print(raw);
    Serial.print(F(" → "));
    Serial.print(w, 3);
    Serial.println(F("kg"));
  } else {
    Serial.println(F("HX711: NOT READY"));
  }
#else
  Serial.println(F("HX711: DISABLED (no load cells)"));
#endif

  // 4. Power down sensors
#if WEIGHT_ENABLED
  scale.power_down();
#endif
#if defined(TWCR)
  TWCR = 0;
#endif
  pinMode(A4, INPUT);
  pinMode(A5, INPUT);
  delay(10);
  sensorsOff();

  // 5. Build JSON payload (AVR-safe: dtostrf instead of %f)
  // {"t":21.5,"h":55.3,"w":45.12,"bv":3.25,"bp":40,"n":1}
  char st[8], sh[8], sw[8], sbv[8];
  dtostrf(t,  1, 1, st);
  dtostrf(h,  1, 1, sh);
  dtostrf(w,  1, 2, sw);
  dtostrf(bv, 1, 2, sbv);
  char payload[100];
  snprintf(payload, sizeof(payload),
    "{\"t\":%s,\"h\":%s,\"w\":%s,\"bv\":%s,\"bp\":%d,\"n\":%lu}",
    st, sh, sw, sbv, bp, counter++);

  Serial.print(F("TX: "));
  Serial.print(payload);
  Serial.print(F(" ("));
  Serial.print(strlen(payload));
  Serial.println(F(" bytes)"));

  // 6. Send via LoRa
  unsigned long txStart = millis();
  rf95.send((uint8_t*)payload, strlen(payload));
  rf95.waitPacketSent();
  Serial.print(F("Sent in "));
  Serial.print(millis() - txStart);
  Serial.println(F("ms"));

  Serial.println();
  delay(10000);  // 10s between transmissions for testing
}
