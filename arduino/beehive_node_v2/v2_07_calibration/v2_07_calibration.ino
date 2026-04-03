// ============================================================
// TEST 07: HX711 CALIBRATION
// Arduino Pro Mini 3.3V/8MHz + A1SHB MOSFET + HX711
//
// PURPOSE: Determine calibration factor using known weights
//          Interactive serial menu for tare + calibration
// SETUP:   All sensor wiring complete, load cell mounted
//
// PROCEDURE:
//   1. Upload and open Serial Monitor at 9600 baud
//   2. Remove all weight → press 't' to tare
//   3. Place known weight (e.g. 1000g) → press 'c'
//   4. Enter the known weight in grams
//   5. Note the calibration factor for the final sketch
// ============================================================

#include "HX711.h"
#include <stdlib.h>

#define MOSFET_PIN 4
#define HX_DOUT    5
#define HX_SCK     6

HX711 scale;

long tareOffset = 30200;  // Empty scale, no tray (measured: 30200)

uint8_t currentGain = 1;  // 1=×128, 2=×64, 3=×32
float calibrationFactor = 50.8000;  // raw units per gram (measured: (81000-30200)/1000 = 50.8)

const float TRAY_WEIGHT_G = 700.0;
const float DEFAULT_KNOWN_WEIGHT_G = 1000.0;  // 1 kg flour pack

void sensorsOn() {
  digitalWrite(MOSFET_PIN, LOW);
}

void sensorsOff() {
  digitalWrite(MOSFET_PIN, HIGH);
}

void printMenu() {
  Serial.println(F("─────────────────────────────────"));
  Serial.println(F("Commands:"));
  Serial.println(F("  t = Tare current setup state"));
  Serial.println(F("  c = Calibrate (tray + flour)"));
  Serial.println(F("  m = Measure NO-TRAY tare for final sketch"));
  Serial.println(F("  d = Diagnostic: test wiring direction"));
  Serial.println(F("  g = Change HX711 gain (×128/×64/×32)"));
  Serial.println(F("  r = Show raw readings"));
  Serial.println(F("  w = Show calibrated weight"));
  Serial.println(F("  p = Print current values"));
    char buf[40];
    snprintf(buf, sizeof(buf), "  Current gain: ×%d", currentGain == 1 ? 128 : (currentGain == 2 ? 64 : 32));
    Serial.println(buf);
  Serial.println(F("─────────────────────────────────"));
}

void changeGain() {
  Serial.println(F("\n>>> CHANGE HX711 GAIN"));
  Serial.println(F("  1 = ×128 (default, high sensitivity)"));
  Serial.println(F("  2 = ×64  (medium sensitivity)"));
  Serial.println(F("  3 = ×32  (low sensitivity, prevents saturation)"));
  Serial.print(F("  Enter choice (1-3): "));
  
  unsigned long start = millis();
  while (!Serial.available() && millis() - start < 10000) delay(10);
  
  if (!Serial.available()) {
    Serial.println(F("\n    Timeout"));
    return;
  }
  
  char c = Serial.read();
  while (Serial.available()) Serial.read();  // Clear buffer
  
  if (c >= '1' && c <= '3') {
    currentGain = c - '0';
    uint8_t gainVal = (currentGain == 1) ? 128 : (currentGain == 2) ? 64 : 32;
    scale.set_gain(gainVal);
    Serial.print(F("\n    Gain changed to ×"));
    Serial.println(gainVal);
    Serial.println(F("    IMPORTANT: Re-tare and re-calibrate with new gain!"));
  } else {
    Serial.println(F("\n    Invalid choice"));
  }
}

bool readKnownWeightFromSerial(float &knownWeight) {
  // Remove stale bytes (e.g., leftover \n from command key)
  while (Serial.available()) Serial.read();

  Serial.print(F("    Enter known weight in grams and press Enter"));
  Serial.print(F(" [default "));
  Serial.print(DEFAULT_KNOWN_WEIGHT_G, 0);
  Serial.println(F("]:"));

  unsigned long start = millis();
  while (!Serial.available()) {
    if (millis() - start > 30000UL) {
      Serial.println(F("    ERROR: Input timeout (30s)"));
      return false;
    }
    delay(10);
  }

  char input[24];
  size_t len = Serial.readBytesUntil('\n', input, sizeof(input) - 1);
  input[len] = '\0';

  // Trim trailing CR/spaces/tabs
  while (len > 0 && (input[len - 1] == '\r' || input[len - 1] == ' ' || input[len - 1] == '\t')) {
    input[--len] = '\0';
  }

  // Empty input = use default (1kg flour)
  if (len == 0) {
    knownWeight = DEFAULT_KNOWN_WEIGHT_G;
    return true;
  }

  char *endPtr;
  float value = (float)strtod(input, &endPtr);

  while (*endPtr == ' ' || *endPtr == '\t') endPtr++;

  if (endPtr == input || *endPtr != '\0' || value <= 0) {
    Serial.print(F("    ERROR: Invalid input: "));
    Serial.println(input);
    return false;
  }

  knownWeight = value;
  return true;
}

void diagnosticWiring() {
  Serial.println(F("\n>>> DIAGNOSTIC: Test load cell wiring direction"));
  Serial.println(F("    Remove all weight from load cell"));
  Serial.println(F("    Reading baseline in 3 seconds..."));
  delay(3000);

  if (!scale.is_ready()) {
    Serial.println(F("    ERROR: HX711 not ready"));
    return;
  }

  long baseline = scale.read_average(10);
  Serial.print(F("    Baseline (no weight): "));
  Serial.println(baseline);

  Serial.println();
  Serial.println(F("    Now PRESS DOWN on the load cell (or add weight)"));
  Serial.println(F("    Reading in 3 seconds..."));
  delay(3000);

  long weighted = scale.read_average(10);
  Serial.print(F("    With weight:          "));
  Serial.println(weighted);

  long delta = weighted - baseline;
  Serial.println();
  Serial.println(F("    ╔═══════════════════════════════════════╗"));
  Serial.print(F("    ║ Delta: "));
  Serial.print(delta);
  if (delta > 0) {
    Serial.println(F(" (POSITIVE - correct!) ║"));
    Serial.println(F("    ║ ✓ Wiring is CORRECT                   ║"));
    Serial.println(F("    ║   Weight increases reading            ║"));
  } else if (delta < 0) {
    Serial.println(F(" (NEGATIVE - wrong!)   ║"));
    Serial.println(F("    ║ ✗ Wiring is BACKWARDS                 ║"));
    Serial.println(F("    ║   FIX: Swap A+/A- wires on HX711      ║"));
  } else {
    Serial.println(F(" (ZERO - no change?)   ║"));
    Serial.println(F("    ║ ⚠ Load cell may not be working        ║"));
  }
  Serial.println(F("    ╚═══════════════════════════════════════╝"));
}

void measureTrayOnly() {
  Serial.println(F("\n>>> MEASURE NO-TRAY TARE (for final sketch)"));
  Serial.println(F("    Remove tray and all extra weight from platform"));
  Serial.println(F("    Reading in 3 seconds..."));
  delay(3000);

  if (!scale.is_ready()) {
    Serial.println(F("    ERROR: HX711 not ready"));
    return;
  }

  long noTrayRaw = scale.read_average(20);
  Serial.println();
  Serial.println(F("    ╔══════════════════════════════════╗"));
  Serial.print(F("    ║ No-tray raw value:   "));
  Serial.print(noTrayRaw);
  Serial.println(F("         ║"));
  Serial.println(F("    ║ For final sketch, use:           ║"));
  long adjustedTare = noTrayRaw;
  Serial.print(F("    ║ TARE_OFFSET = "));
  Serial.print(adjustedTare);
  Serial.println(F("      ║"));
  if (tareOffset != 0) {
    Serial.print(F("    ║ Drift vs last tare: "));
    Serial.print(noTrayRaw - tareOffset);
    Serial.println(F("         ║"));
  }
  Serial.println(F("    ║ (true zero-point without tray)   ║"));
  Serial.println(F("    ╚══════════════════════════════════╝"));
}

void doTare() {
  Serial.println(F("\n>>> TARE: Remove ALL weight from load cell"));
  Serial.println(F("    Reading in 3 seconds..."));
  delay(3000);

  if (!scale.is_ready()) {
    Serial.println(F("    ERROR: HX711 not ready"));
    return;
  }

  // Average 20 readings for stable tare
  tareOffset = scale.read_average(20);
  Serial.print(F("    Tare offset = "));
  Serial.println(tareOffset);
  Serial.println(F("    Tare complete. Now place known weight and press 'c'"));
}

void doCalibrate() {
  if (tareOffset == 0) {
    Serial.println(F("\n    ERROR: Tare first! Press 't'"));
    return;
  }

  Serial.println(F("\n>>> CALIBRATE: Place known weight on load cell"));
  Serial.println(F("    Reading in 3 seconds..."));
  delay(3000);

  if (!scale.is_ready()) {
    Serial.println(F("    ERROR: HX711 not ready"));
    return;
  }

  long raw = scale.read_average(20);
  long delta = raw - tareOffset;

  Serial.print(F("    Raw with weight: "));
  Serial.println(raw);
  Serial.print(F("    Delta from tare: "));
  Serial.println(delta);

  Serial.println(F("    If you tared with tray only, enter flour weight (typically 1000g)."));
  float knownWeight = 0;
  if (!readKnownWeightFromSerial(knownWeight)) {
    Serial.println(F("    Calibration aborted."));
    return;
  }

  if (knownWeight <= 0) {
    Serial.println(F("    ERROR: Invalid weight"));
    return;
  }

  calibrationFactor = (float)delta / knownWeight;

  Serial.println();
  Serial.println(F("    ╔══════════════════════════════════╗"));
  Serial.print(F("    ║ TARE OFFSET:        "));
  Serial.print(tareOffset);
  Serial.println(F("          ║"));
  Serial.print(F("    ║ CALIBRATION FACTOR:  "));
  Serial.print(calibrationFactor, 4);
  Serial.println(F("    ║"));
  Serial.print(F("    ║ Known weight:        "));
  Serial.print(knownWeight, 0);
  Serial.println(F("g         ║"));
  Serial.print(F("    ║ Calculated weight:   "));
  float calcW = (float)delta / calibrationFactor;
  Serial.print(calcW, 1);
  Serial.println(F("g      ║"));
  Serial.println(F("    ╚══════════════════════════════════╝"));
  Serial.println();
  
  // Warn if calibration factor is negative 
  if (calibrationFactor < 0) {
    Serial.println(F("    ⚠ WARNING: Calibration factor is NEGATIVE!"));
    Serial.println(F("    This means: adding weight DECREASED the raw value"));
    Serial.println(F("    "));
    Serial.println(F("    FIX: Swap A+/A- signal wires on HX711"));
    Serial.println(F("         (keep E+/E- in current position)"));
    Serial.println(F("    "));
    Serial.println(F("    Or use 'd' command for wiring diagnostic."));
    Serial.println();
  }
  
  Serial.println(F("    Copy these values to the final sketch:"));
  Serial.print(F("    #define CALIBRATION_FACTOR "));
  Serial.println(calibrationFactor, 4);
  Serial.print(F("    #define TARE_OFFSET "));
  Serial.println(tareOffset);
  Serial.println();
  Serial.println(F("    IMPORTANT: Tare was measured WITH tray (~700g)!"));
  Serial.println(F("    Use 'm' to measure NO-TRAY tare for final sketch."));
}

void showRaw() {
  Serial.println(F("\n    Raw readings (10 samples):"));
  for (int i = 0; i < 10; i++) {
    if (scale.is_ready()) {
      long v = scale.read();
      Serial.print(F("    #"));
      Serial.print(i + 1);
      Serial.print(F(": "));
      Serial.println(v);
    } else {
      Serial.println(F("    not ready"));
    }
    delay(200);
  }
  Serial.print(F("    Average (10): "));
  Serial.println(scale.read_average(10));
}

void showWeight() {
  if (tareOffset == 0 || calibrationFactor <= 0) {
    Serial.println(F("\n    Tare and calibrate first!"));
    return;
  }

  Serial.println(F("\n    Calibrated weight readings:"));
  for (int i = 0; i < 5; i++) {
    long raw = scale.read_average(5);
    float grams = (float)(raw - tareOffset) / calibrationFactor;
    float kg = grams / 1000.0;

    Serial.print(F("    "));
    Serial.print(grams, 1);
    Serial.print(F("g  ("));
    Serial.print(kg, 3);
    Serial.println(F("kg)"));
    delay(500);
  }
}

void printValues() {
  Serial.println(F("\n    Current calibration values:"));
  Serial.print(F("    Tare offset:        "));
  Serial.println(tareOffset);
  Serial.print(F("    Calibration factor: "));
  Serial.println(calibrationFactor, 4);
}

void setup() {
  Serial.begin(9600);
  delay(1000);

  pinMode(MOSFET_PIN, OUTPUT);
  sensorsOn();  // Keep sensors powered for calibration
  delay(500);

  scale.begin(HX_DOUT, HX_SCK);

  Serial.println();
  Serial.println(F("=== TEST 07: HX711 CALIBRATION ==="));
  Serial.print(F("Tray reference weight: ~"));
  Serial.print(TRAY_WEIGHT_G, 0);
  Serial.println(F("g (for distribution only)"));

  // Wait for HX711
  Serial.print(F("HX711 init"));
  unsigned long start = millis();
  while (!scale.is_ready() && millis() - start < 5000) {
    Serial.print('.');
    delay(100);
  }

  if (scale.is_ready()) {
    Serial.println(F(" OK"));
    // Quick raw reading
    Serial.print(F("Initial raw: "));
    Serial.println(scale.read_average(5));
  } else {
    Serial.println(F(" FAIL"));
    Serial.println(F("Check wiring and try again"));
  }

  Serial.println();
  printMenu();
}

void loop() {
  if (Serial.available()) {
    char cmd = Serial.read();
    // Flush extra chars (newline etc.)
    delay(10);
    while (Serial.available()) Serial.read();

    switch (cmd) {
      case 't': doTare(); break;
      case 'c': doCalibrate(); break;
      case 'm': measureTrayOnly(); break;
      case 'd': diagnosticWiring(); break;
        case 'g': changeGain(); break;
      case 'r': showRaw(); break;
      case 'w': showWeight(); break;
      case 'p': printValues(); break;
      case '\n': case '\r': break;  // Ignore newlines
      default:
        Serial.print(F("Unknown command: "));
        Serial.println(cmd);
        printMenu();
        break;
    }
  }

  delay(10);
}
