// ============================================================
// BEEHIVE NODE v2 - RANGE TEST
// Transmits valid JSON every 10 seconds for LoRa range testing.
// No sleep, no sensors — just battery reading + LoRa TX.
// Monitor via Serial (9600 baud).
// ============================================================

#include <SPI.h>
#include <RH_RF95.h>

// ===== Pin Assignments (same as production node) =====
#define VBAT_PIN    A0
#define RFM95_CS    10
#define RFM95_RST   9
#define RFM95_INT   2
#define RFM95_FREQ  868.0

// ===== TX Config =====
#define TX_POWER        10      // dBm (match production)
#define TX_INTERVAL_MS  10000   // 10 seconds

// ===== Voltage divider (same as production) =====
const float DIVIDER_RATIO = 3.7;  // (54k+20k)/20k
const float VREF = 1.1;

// ===== LiFePO4 battery lookup =====
struct VoltPt { float v; uint8_t p; };
const VoltPt LFP[] PROGMEM = {
  {3.40, 100}, {3.35, 90}, {3.33, 80}, {3.30, 60},
  {3.25,  40}, {3.20, 20}, {3.10, 10}, {2.80,  0}
};
const int LFP_N = 8;

RH_RF95 rf95(RFM95_CS, RFM95_INT);
uint32_t counter = 0;

// ────────────────────────────────────────────────────────────

float readVbat() {
  analogReference(INTERNAL);
  for (int i = 0; i < 5; i++) { analogRead(VBAT_PIN); delay(2); }

  uint32_t sum = 0;
  for (int i = 0; i < 16; i++) { sum += analogRead(VBAT_PIN); delay(2); }
  float avg = (float)sum / 16.0;
  return (avg / 1024.0) * VREF * DIVIDER_RATIO;
}

int battPct(float v) {
  VoltPt pt;
  memcpy_P(&pt, &LFP[0], sizeof(VoltPt));
  if (v >= pt.v) return 100;
  memcpy_P(&pt, &LFP[LFP_N - 1], sizeof(VoltPt));
  if (v <= pt.v) return 0;

  for (int i = 0; i < LFP_N - 1; i++) {
    VoltPt hi, lo;
    memcpy_P(&hi, &LFP[i], sizeof(VoltPt));
    memcpy_P(&lo, &LFP[i + 1], sizeof(VoltPt));
    if (v >= lo.v) {
      float rv = hi.v - lo.v;
      float rp = hi.p - lo.p;
      return lo.p + (int)(((v - lo.v) / rv) * rp);
    }
  }
  return 0;
}

void buildPayload(char* buf, size_t len, float bv, int bp, uint32_t n) {
  char sbv[8];
  dtostrf(bv, 1, 2, sbv);
  // t/h/w use fixed test values — gateway parses them fine
  snprintf(buf, len,
    "{\"t\":99.9,\"h\":99.9,\"w\":0.00,\"bv\":%s,\"bp\":%d,\"n\":%lu}",
    sbv, bp, (unsigned long)n);
}

// ════════════════════════════════════════════════════════════

void setup() {
  Serial.begin(9600);
  delay(200);
  Serial.println(F("\n=== RANGE TEST ==="));
  Serial.println(F("TX every 10s — watch counter for packet loss"));

  // Init radio
  pinMode(RFM95_RST, OUTPUT);
  digitalWrite(RFM95_RST, HIGH);
  delay(10);
  digitalWrite(RFM95_RST, LOW);
  delay(10);
  digitalWrite(RFM95_RST, HIGH);
  delay(10);

  if (!rf95.init()) {
    Serial.println(F("RFM95 INIT FAILED"));
    while (1) delay(1000);
  }
  if (!rf95.setFrequency(RFM95_FREQ)) {
    Serial.println(F("SET FREQ FAILED"));
    while (1) delay(1000);
  }
  rf95.setTxPower(TX_POWER, false);

  Serial.println(F("RFM95 OK @ 868 MHz"));
  Serial.print(F("TX power: ")); Serial.print(TX_POWER); Serial.println(F(" dBm"));
  Serial.println();
}

void loop() {
  counter++;

  float bv = readVbat();
  int bp = battPct(bv);

  char payload[100];
  buildPayload(payload, sizeof(payload), bv, bp, counter);

  Serial.print(F("#")); Serial.print(counter);
  Serial.print(F("  batt=")); Serial.print(bv, 2); Serial.print(F("V"));
  Serial.print(F("  TX: ")); Serial.println(payload);

  rf95.setModeIdle();
  delay(10);
  rf95.send((uint8_t*)payload, strlen(payload));
  rf95.waitPacketSent();

  Serial.println(F("  Sent OK\n"));

  delay(TX_INTERVAL_MS);
}
