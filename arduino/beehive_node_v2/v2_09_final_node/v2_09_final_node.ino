// ============================================================
// BEEHIVE NODE v2.0 - PRODUCTION FIRMWARE
// Arduino Pro Mini 3.3V/8MHz + LiFePO4 + Solar
// SHT40 + HX711 + RFM95 + A1SHB MOSFET power switch
//
// POWER ARCHITECTURE:
//   - MCU sleeps via WDT (power-down mode)
//   - Sensors powered off via P-channel MOSFET during sleep
//   - RFM95 uses built-in sleep mode (~1µA)
//   - Target sleep current: ~5µA (after hardware mods)
//
// SLEEP CYCLE:
//   Wake → read battery → MOSFET ON → read sensors → MOSFET OFF
//   → TX via LoRa → RFM95 sleep → MCU sleep (15 min)
//
// HARDWARE MODS FOR LOW POWER:
//   1. Remove onboard power LED (desolder or cut trace)
//   2. Remove/bypass voltage regulator (LiFePO4 feeds VCC direct)
//   3. Optional: remove D13 LED if SPI noise is a concern
//   After mods: sleep ~4-6µA instead of ~5mA
//
// PAYLOAD FORMAT (unencrypted JSON):
//   {"t":21.5,"h":55.0,"w":45.12,"bv":3.25,"bp":40,"n":1}
//   Sent directly via RFM95 LoRa module
//   (Encryption disabled: Crypto library conflicts with WDT sleep interrupt)
//
// NOTE: AVR's default snprintf does NOT support %f.
//       This firmware uses dtostrf() for all float formatting.
// ============================================================

#include <avr/sleep.h>
#include <avr/wdt.h>
#include <avr/power.h>
#include <EEPROM.h>
#include <Wire.h>
#include "Adafruit_SHT4x.h"
#include "HX711.h"
#include <SPI.h>
#include <RH_RF95.h>

// ╔══════════════════════════════════════════════════════════╗
// ║                    USER CONFIG                          ║
// ║  Adjust these settings for your deployment              ║
// ╚══════════════════════════════════════════════════════════╝

// --- Feature toggles ---
#define WEIGHT_ENABLED    true    // Calibrated and enabled for production
#define SERIAL_ENABLED    false   // Production low-power mode (saves ~1mA)

// --- Timing ---
#define SLEEP_MINUTES     30    // Sleep between readings (1-60)
#define SENSOR_SETTLE_MS  250     // Time for sensors to stabilize after power-on

// --- Battery protection ---
#define LOW_BATT_VOLTAGE  2.80    // Below this: skip TX, double sleep time
#define CRIT_BATT_VOLTAGE 2.60    // Below this: sleep indefinitely (emergency)

// --- HX711 calibration (update from v2_07_calibration) ---
#define CALIBRATION_FACTOR  20.9000 // raw units per gram (calibrated)
#define TARE_OFFSET         30500   // empty scale, no tray (calibrated)
#define WEIGHT_MAX_KG       200.0 // Clamp maximum weight
#define HX711_SAMPLES       5    // Readings to average

// --- LoRa ---
#define TX_POWER            10   // dBm (2-20, higher = more range, more current)

// Encryption disabled due to WDT interrupt conflict with Crypto library
// (Both sketch sleep and RNG try to use __vector_6)

// ===== Pin Assignments =====
#define MOSFET_PIN  4     // P-FET gate: LOW=ON, HIGH=OFF
#define VBAT_PIN    A0    // Battery voltage (54k/20k divider)
#define HX_DOUT     5     // HX711 data
#define HX_SCK      6     // HX711 clock
#define RFM95_CS    10    // LoRa chip select
#define RFM95_RST   9     // LoRa reset
#define RFM95_INT   2     // LoRa DIO0 (INT0)
#define RFM95_FREQ  868.0 // LoRa frequency MHz

// ===== EEPROM layout =====
#define EEPROM_MAGIC_ADDR    0    // 1 byte: 0xBE = initialized
#define EEPROM_COUNTER_ADDR  1    // 4 bytes: uint32_t TX counter
#define EEPROM_SAVE_EVERY    10   // Write counter to EEPROM every N transmissions
#define EEPROM_MAGIC         0xBE

// ===== Sleep Config =====
// WDT max = 8s. cycles = (minutes * 60) / 8
#define SLEEP_CYCLES  ((SLEEP_MINUTES * 60L) / 8)

// ===== Voltage divider =====
const float DIVIDER_RATIO = 3.7;  // (54k+20k)/20k
const float VREF = 1.1;           // Internal 1.1V reference

// ===== LiFePO4 battery lookup =====
struct VoltPt { float v; uint8_t p; };
const VoltPt LFP[] PROGMEM = {
  {3.40, 100}, {3.35, 90}, {3.33, 80}, {3.30, 60},
  {3.25,  40}, {3.20, 20}, {3.10, 10}, {2.80,  0}
};
const int LFP_N = 8;

// ===== Objects =====
Adafruit_SHT4x sht4 = Adafruit_SHT4x();
#if WEIGHT_ENABLED
HX711 scale;
#endif
RH_RF95 rf95(RFM95_CS, RFM95_INT);

// ===== State =====
uint32_t counter = 0;        // TX counter (persisted in EEPROM)
bool radioOk = false;        // Track radio init state
volatile bool wdt_fired = false;

// ===== Debug macros =====
// Compiles out all serial code when SERIAL_ENABLED is false
#if SERIAL_ENABLED
  #define DBG_BEGIN(baud)  Serial.begin(baud)
  #define DBG(x)           Serial.print(x)
  #define DBG_LN(x)        Serial.println(x)
  #define DBG_F(x)         Serial.print(F(x))
  #define DBG_FLN(x)       Serial.println(F(x))
  #define DBG_VAL(x, d)    Serial.print(x, d)
  #define DBG_FLUSH()      Serial.flush()
#else
  #define DBG_BEGIN(baud)
  #define DBG(x)
  #define DBG_LN(x)
  #define DBG_F(x)
  #define DBG_FLN(x)
  #define DBG_VAL(x, d)
  #define DBG_FLUSH()
#endif

// ===== Watchdog Timer ISR =====
ISR(WDT_vect) {
  wdt_fired = true;
  WDTCSR |= (1 << WDIE);  // Re-arm: hardware auto-clears WDIE after firing
}

// ────────────────────────────────────────────────────────────
//  EEPROM helpers
// ────────────────────────────────────────────────────────────

void eepromLoadCounter() {
  if (EEPROM.read(EEPROM_MAGIC_ADDR) == EEPROM_MAGIC) {
    EEPROM.get(EEPROM_COUNTER_ADDR, counter);
  } else {
    // First boot — initialize EEPROM
    counter = 0;
    EEPROM.write(EEPROM_MAGIC_ADDR, EEPROM_MAGIC);
    EEPROM.put(EEPROM_COUNTER_ADDR, counter);
  }
}

void eepromSaveCounter() {
  // Only write every Nth TX to extend EEPROM life
  // (100k writes ÷ 96/day @ 15 min = ~2.8 years even if writing every time,
  //  but every 10th gives ~28 years)
  if (counter % EEPROM_SAVE_EVERY == 0) {
    EEPROM.put(EEPROM_COUNTER_ADDR, counter);
  }
}

// ────────────────────────────────────────────────────────────
//  Power Management
// ────────────────────────────────────────────────────────────

void sensorsOn() {
  digitalWrite(MOSFET_PIN, LOW);   // P-FET: LOW = ON
}

void sensorsOff() {
  digitalWrite(MOSFET_PIN, HIGH);  // P-FET: HIGH = OFF
}

void setupWDT() {
  cli();
  wdt_reset();
  // Set WDCE and WDE to enable changes
  WDTCSR = (1 << WDCE) | (1 << WDE);
  // Interrupt mode (no reset), 8 second timeout
  // WDP3=1, WDP2=0, WDP1=0, WDP0=1 = 8s
  WDTCSR = (1 << WDIE) | (1 << WDP3) | (1 << WDP0);
  sei();
}

void disableWDT() {
  cli();
  wdt_reset();
  MCUSR &= ~(1 << WDRF);
  WDTCSR = (1 << WDCE) | (1 << WDE);
  WDTCSR = 0x00;
  sei();
}

void sleepNow() {
  set_sleep_mode(SLEEP_MODE_PWR_DOWN);
  sleep_enable();

  // Disable ADC (saves ~120µA)
  ADCSRA &= ~(1 << ADEN);

  // Disable brown-out detector in software (saves ~25µA)
  sleep_bod_disable();

  sleep_mode();  // ← CPU halts here, wakes on WDT interrupt

  sleep_disable();

  // Re-enable ADC
  ADCSRA |= (1 << ADEN);
}

void deepSleep(long cycles) {
  // Disable serial UART for lowest power during sleep
#if SERIAL_ENABLED
  DBG_FLUSH();
  // Disable USART to save ~0.5mA
  power_usart0_disable();
#endif

  setupWDT();

  for (long i = 0; i < cycles; i++) {
    wdt_fired = false;
    sleepNow();
  }

  disableWDT();

#if SERIAL_ENABLED
  power_usart0_enable();
#endif
}

// ────────────────────────────────────────────────────────────
//  Battery Reading
// ────────────────────────────────────────────────────────────

float readVbat() {
  // Switch to internal 1.1V reference
  analogReference(INTERNAL);
  // Discard first readings after reference switch (cap charge time)
  for (int i = 0; i < 5; i++) {
    analogRead(VBAT_PIN);
    delay(2);
  }

  uint32_t sum = 0;
  for (int i = 0; i < 16; i++) {
    sum += analogRead(VBAT_PIN);
    delay(2);
  }
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

// ────────────────────────────────────────────────────────────
//  Radio
// ────────────────────────────────────────────────────────────

bool initRadio() {
  pinMode(RFM95_RST, OUTPUT);
  digitalWrite(RFM95_RST, HIGH);
  delay(10);
  digitalWrite(RFM95_RST, LOW);
  delay(10);
  digitalWrite(RFM95_RST, HIGH);
  delay(10);

  if (!rf95.init()) return false;
  if (!rf95.setFrequency(RFM95_FREQ)) return false;
  rf95.setTxPower(TX_POWER, false);
  return true;
}

// ────────────────────────────────────────────────────────────
//  JSON Payload Builder (AVR-safe, no %f)
// ────────────────────────────────────────────────────────────
//  ATmega328P's default vsnprintf does not support %f.
//  We use dtostrf() to convert each float, then snprintf with %s.

void buildPayload(char* buf, size_t len, float t, float h, float w,
                  float bv, int bp, uint32_t n) {
  char st[8], sh[8], sw[8], sbv[8];
  dtostrf(t,  1, 1, st);   // "21.5"
  dtostrf(h,  1, 1, sh);   // "55.3"
  dtostrf(w,  1, 2, sw);   // "45.12"
  dtostrf(bv, 1, 2, sbv);  // "3.25"

  snprintf(buf, len,
    "{\"t\":%s,\"h\":%s,\"w\":%s,\"bv\":%s,\"bp\":%d,\"n\":%lu}",
    st, sh, sw, sbv, bp, (unsigned long)n);
}

// ════════════════════════════════════════════════════════════
//  SETUP
// ════════════════════════════════════════════════════════════

void setup() {
  // Disable unused peripherals immediately for power saving
  power_twi_disable();     // Enable only when reading I2C sensors
  power_timer1_disable();
  power_timer2_disable();
  // Keep: SPI (LoRa), ADC (battery), Timer0 (millis/delay)

  // MOSFET OFF immediately (sensors unpowered)
  pinMode(MOSFET_PIN, OUTPUT);
  sensorsOff();

  // Unused pins → INPUT_PULLUP to prevent floating (saves a few µA)
  const uint8_t unusedPins[] = {3, 7, 8};
  for (uint8_t i = 0; i < sizeof(unusedPins); i++) {
    pinMode(unusedPins[i], INPUT_PULLUP);
  }
  pinMode(A1, INPUT_PULLUP);
  pinMode(A2, INPUT_PULLUP);
  pinMode(A3, INPUT_PULLUP);

  // Serial (debug only)
  DBG_BEGIN(9600);
#if SERIAL_ENABLED
  delay(200);
#endif

  DBG_FLN("");
  DBG_FLN("=== BEEHIVE NODE v2.0 ===");
  DBG_FLN("Pro Mini 3.3V/8MHz + LiFePO4");
#if WEIGHT_ENABLED
  DBG_FLN("Weight: ENABLED");
#else
  DBG_FLN("Weight: DISABLED (no load cells)");
#endif

  // Load persistent TX counter from EEPROM
  eepromLoadCounter();
  DBG_F("Counter: "); DBG_LN(counter);

  // Init radio (always powered from VBAT, not via MOSFET)
  radioOk = initRadio();
  if (radioOk) {
    DBG_FLN("RFM95 OK");
    rf95.sleep();  // Sleep radio until first TX
  } else {
    DBG_FLN("RFM95 FAIL — will retry each cycle");
  }

  DBG_FLN("=========================\n");
  DBG_FLUSH();
}

// ════════════════════════════════════════════════════════════
//  MAIN LOOP — one iteration per wake cycle
// ════════════════════════════════════════════════════════════

void loop() {
  DBG_FLN("--- Wake ---");

  // ── 1. Read battery voltage (divider always connected) ──
  float bv = readVbat();
  int bp = battPct(bv);
  DBG_F("Batt: "); DBG_VAL(bv, 3); DBG_F("V "); DBG(bp); DBG_FLN("%");

  // ── 2. Critical battery check ──
  if (bv < CRIT_BATT_VOLTAGE) {
    DBG_FLN("CRITICAL BATTERY — emergency sleep");
    sensorsOff();
    rf95.sleep();
    DBG_FLUSH();
    deepSleep(SLEEP_CYCLES * 4);  // Sleep 4× longer (~1 hour)
    return;
  }

  // Low battery: skip TX, conserve energy
  if (bv < LOW_BATT_VOLTAGE) {
    DBG_FLN("LOW BATTERY — sleeping without TX");
    sensorsOff();
    rf95.sleep();
    DBG_FLUSH();
    deepSleep(SLEEP_CYCLES * 2);  // Sleep 2× longer (~30 min)
    return;
  }

  // ── 3. Retry radio init if it failed in setup ──
  if (!radioOk) {
    radioOk = initRadio();
    if (!radioOk) {
      DBG_FLN("RFM95 still failing — sleep & retry");
      DBG_FLUSH();
      deepSleep(SLEEP_CYCLES);
      return;
    }
    DBG_FLN("RFM95 recovered");
  }

  // ── 4. Power up sensors via MOSFET ──
  power_twi_enable();
  sensorsOn();
  delay(SENSOR_SETTLE_MS);

  // ── 5. Init I2C ──
  Wire.begin();
  delay(50);

  // ── 6. Read SHT40 (temperature + humidity) ──
  float t = 0, h = 0;
  bool shtOk = sht4.begin();
  if (shtOk) {
    sht4.setPrecision(SHT4X_HIGH_PRECISION);
    sht4.setHeater(SHT4X_NO_HEATER);
    sensors_event_t hEvt, tEvt;
    sht4.getEvent(&hEvt, &tEvt);
    t = tEvt.temperature;
    h = hEvt.relative_humidity;
    DBG_F("T="); DBG_VAL(t, 1); DBG_F("C H="); DBG_VAL(h, 1); DBG_FLN("%");
  } else {
    DBG_FLN("SHT40: FAIL");
  }

  // ── 7. Read HX711 (weight) — only if enabled ──
  float w = 0;
#if WEIGHT_ENABLED
  scale.begin(HX_DOUT, HX_SCK);
  unsigned long hxStart = millis();
  while (!scale.is_ready() && millis() - hxStart < 3000) {
    delay(100);
  }
  if (scale.is_ready()) {
    long raw = scale.read_average(HX711_SAMPLES);
    float grams = (float)(raw - TARE_OFFSET) / CALIBRATION_FACTOR;
    w = grams / 1000.0;  // Convert to kg
    if (w < 0) w = 0;
    if (w > WEIGHT_MAX_KG) w = WEIGHT_MAX_KG;
    DBG_F("W="); DBG_VAL(w, 2); DBG_FLN("kg");
  } else {
    DBG_FLN("HX711: NOT READY");
  }
  scale.power_down();
#endif

  // ── 8. Power down sensors ──
  // Disable I2C hardware (prevents backfeed through SDA/SCL pullups)
#if defined(TWCR)
  TWCR = 0;  // Disable TWI hardware
#endif
  pinMode(A4, INPUT);  // SDA high-Z
  pinMode(A5, INPUT);  // SCL high-Z
  delay(5);
  sensorsOff();        // MOSFET off — cuts sensor power rail
  power_twi_disable();

  // ── 9. Build JSON payload ──
  counter++;
  char payload[100];
  buildPayload(payload, sizeof(payload), t, h, w, bv, bp, counter);

  DBG_F("TX: "); DBG_LN(payload);

  // ── 10. Transmit via LoRa ──
  rf95.setModeIdle();
  delay(10);
  rf95.send((uint8_t*)payload, strlen(payload));
  rf95.waitPacketSent();
  DBG_FLN("Sent OK");

  // ── 11. Put radio to sleep (~1µA) ──
  rf95.sleep();

  // ── 12. Save counter to EEPROM periodically ──
  eepromSaveCounter();

  // ── 13. Enter deep sleep ──
  DBG_F("Sleep "); DBG(SLEEP_MINUTES); DBG_FLN("min\n");
  DBG_FLUSH();

  deepSleep(SLEEP_CYCLES);

  // Execution resumes here → loop() repeats
}
