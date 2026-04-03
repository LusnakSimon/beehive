// ============================================================
// TEST 08: HX711 NONLINEARITY DIAGNOSTICS
// Arduino Pro Mini 3.3V/8MHz + A1SHB MOSFET + HX711 + 4x 3-wire cells
//
// PURPOSE:
//   Identify root causes of non-linear weight response:
//   - mechanical binding / load path bypass
//   - cell polarity mismatch / bridge mis-pairing
//   - gain clipping / headroom issues
//   - instability, drift, creep, hysteresis
//
// USAGE:
//   Open Serial Monitor @ 9600
//   Follow menu-driven tests
// ============================================================

#include "HX711.h"
#include <stdlib.h>
#include <math.h>

#define MOSFET_PIN 4
#define HX_DOUT    5
#define HX_SCK     6

HX711 scale;

long tareOffset = 0;
uint8_t currentGainIdx = 0; // 0->128, 1->64, 2->32
const uint8_t GAIN_VALUES[3] = {128, 64, 32};

// ---------- Utilities ----------

void sensorsOn() {
  digitalWrite(MOSFET_PIN, LOW);
}

void sensorsOff() {
  digitalWrite(MOSFET_PIN, HIGH);
}

void clearSerial() {
  while (Serial.available()) Serial.read();
}

bool waitForEnter(uint32_t timeoutMs) {
  uint32_t start = millis();
  while (millis() - start < timeoutMs) {
    if (Serial.available()) {
      char c = Serial.read();
      if (c == '\n' || c == '\r') return true;
    }
    delay(10);
  }
  return false;
}

bool readFloatPrompt(const __FlashStringHelper* prompt, float &value, float defaultValue, uint32_t timeoutMs = 30000UL) {
  clearSerial();
  Serial.print(prompt);
  Serial.print(F(" [default "));
  Serial.print(defaultValue, 2);
  Serial.println(F("]:"));

  uint32_t start = millis();
  while (!Serial.available()) {
    if (millis() - start > timeoutMs) {
      Serial.println(F("  Timeout"));
      return false;
    }
    delay(10);
  }

  char input[24];
  size_t len = Serial.readBytesUntil('\n', input, sizeof(input) - 1);
  input[len] = '\0';

  while (len > 0 && (input[len - 1] == '\r' || input[len - 1] == ' ' || input[len - 1] == '\t')) {
    input[--len] = '\0';
  }

  if (len == 0) {
    value = defaultValue;
    return true;
  }

  char *endPtr;
  double parsed = strtod(input, &endPtr);
  while (*endPtr == ' ' || *endPtr == '\t') endPtr++;

  if (endPtr == input || *endPtr != '\0') {
    Serial.print(F("  Invalid number: "));
    Serial.println(input);
    return false;
  }

  value = (float)parsed;
  return true;
}

bool captureStats(uint16_t samples, uint16_t sampleDelayMs, float &mean, float &stddev, long &minV, long &maxV) {
  if (!scale.is_ready()) return false;

  double sum = 0;
  double sumSq = 0;
  minV = 2147483647L;
  maxV = -2147483647L;

  for (uint16_t i = 0; i < samples; i++) {
    if (!scale.is_ready()) return false;
    long v = scale.read();
    sum += v;
    sumSq += (double)v * (double)v;
    if (v < minV) minV = v;
    if (v > maxV) maxV = v;
    delay(sampleDelayMs);
  }

  mean = (float)(sum / samples);
  double var = (sumSq / samples) - ((double)mean * (double)mean);
  if (var < 0) var = 0;
  stddev = (float)sqrt(var);
  return true;
}

bool captureStableAverage(float &avgOut, uint16_t windowSamples = 25, uint16_t attempts = 8) {
  // Captures several windows and picks first whose span is small enough.
  // Helps avoid taking values while user is still placing weight.
  const float REL_SPAN_LIMIT = 0.0035f; // 0.35%
  const float ABS_SPAN_LIMIT = 1200.0f; // raw counts

  for (uint16_t a = 0; a < attempts; a++) {
    float mean, stddev;
    long minV, maxV;
    if (!captureStats(windowSamples, 25, mean, stddev, minV, maxV)) return false;

    float span = (float)(maxV - minV);
    float rel = (fabs(mean) > 1.0f) ? (span / fabs(mean)) : span;

    if (span <= ABS_SPAN_LIMIT || rel <= REL_SPAN_LIMIT) {
      avgOut = mean;
      return true;
    }

    delay(250);
  }

  // fallback: last quick average
  long v = scale.read_average(20);
  avgOut = (float)v;
  return true;
}

void setGainByIndex(uint8_t idx) {
  currentGainIdx = idx;
  scale.set_gain(GAIN_VALUES[currentGainIdx]);
  delay(200);
}

void printHeader(const __FlashStringHelper* title) {
  Serial.println();
  Serial.println(F("=================================================="));
  Serial.println(title);
  Serial.println(F("=================================================="));
}

void printMenu() {
  Serial.println();
  Serial.println(F("--- TEST 08 MENU ---"));
  Serial.println(F("h = Help/menu"));
  Serial.println(F("g = Set gain (128/64/32)"));
  Serial.println(F("t = Tare current state"));
  Serial.println(F("0 = Noise floor / idle stability"));
  Serial.println(F("1 = Polarity & direction sanity"));
  Serial.println(F("2 = Gain sweep headroom test"));
  Serial.println(F("3 = Settling test (time response)"));
  Serial.println(F("4 = Multi-point linearity test"));
  Serial.println(F("5 = Hysteresis test"));
  Serial.println(F("6 = Creep test (2 min)"));
  Serial.println(F("7 = Corner balance test"));
  Serial.println(F("8 = Clipping/saturation monitor"));
  Serial.println(F("p = Print current status"));
  Serial.println(F("--------------------"));
  Serial.print(F("Current gain: x"));
  Serial.println(GAIN_VALUES[currentGainIdx]);
}

void printStatus() {
  Serial.println();
  Serial.print(F("Gain: x"));
  Serial.println(GAIN_VALUES[currentGainIdx]);
  Serial.print(F("Tare offset: "));
  Serial.println(tareOffset);

  float mean, stddev;
  long minV, maxV;
  if (captureStats(30, 20, mean, stddev, minV, maxV)) {
    Serial.print(F("Live mean: "));
    Serial.println(mean, 1);
    Serial.print(F("Live stddev: "));
    Serial.println(stddev, 1);
    Serial.print(F("Live span: "));
    Serial.println(maxV - minV);
  } else {
    Serial.println(F("HX711 not ready"));
  }
}

// ---------- Tests ----------

void cmdSetGain() {
  printHeader(F("SET GAIN"));
  Serial.println(F("Enter 1,2,3 for x128,x64,x32"));
  Serial.print(F("> "));

  uint32_t start = millis();
  while (!Serial.available() && millis() - start < 10000UL) delay(10);
  if (!Serial.available()) {
    Serial.println(F("Timeout"));
    return;
  }

  char c = Serial.read();
  clearSerial();

  if (c == '1') setGainByIndex(0);
  else if (c == '2') setGainByIndex(1);
  else if (c == '3') setGainByIndex(2);
  else {
    Serial.println(F("Invalid choice"));
    return;
  }

  Serial.print(F("Gain set to x"));
  Serial.println(GAIN_VALUES[currentGainIdx]);
  Serial.println(F("Re-tare before calibration."));
}

void cmdTare() {
  printHeader(F("TARE"));
  Serial.println(F("Place platform in desired zero state, then press Enter."));
  if (!waitForEnter(30000UL)) {
    Serial.println(F("Timeout waiting for Enter"));
    return;
  }

  if (!scale.is_ready()) {
    Serial.println(F("HX711 not ready"));
    return;
  }

  tareOffset = scale.read_average(30);
  Serial.print(F("Tare offset set: "));
  Serial.println(tareOffset);
}

void testNoiseFloor() {
  printHeader(F("TEST 0: NOISE FLOOR / IDLE STABILITY"));
  Serial.println(F("Remove dynamic force. Keep setup untouched for 20s."));

  float mean, stddev;
  long minV, maxV;
  if (!captureStats(200, 100, mean, stddev, minV, maxV)) {
    Serial.println(F("HX711 not ready"));
    return;
  }

  Serial.print(F("Mean:   "));
  Serial.println(mean, 1);
  Serial.print(F("StdDev: "));
  Serial.println(stddev, 2);
  Serial.print(F("Span:   "));
  Serial.println(maxV - minV);

  if (stddev > 200.0f) {
    Serial.println(F("Result: HIGH NOISE (check wiring, shielding, supply, vibrations)"));
  } else {
    Serial.println(F("Result: Noise acceptable for hive trend monitoring"));
  }
}

void testPolarityDirection() {
  printHeader(F("TEST 1: POLARITY & DIRECTION"));
  Serial.println(F("Step A: remove force, press Enter."));
  if (!waitForEnter(30000UL)) return;

  float baseline;
  if (!captureStableAverage(baseline)) {
    Serial.println(F("Capture failed"));
    return;
  }

  Serial.println(F("Step B: apply firm downward force (or add weight), then press Enter."));
  if (!waitForEnter(30000UL)) return;

  float loaded;
  if (!captureStableAverage(loaded)) {
    Serial.println(F("Capture failed"));
    return;
  }

  float delta = loaded - baseline;
  Serial.print(F("Baseline: "));
  Serial.println(baseline, 1);
  Serial.print(F("Loaded:   "));
  Serial.println(loaded, 1);
  Serial.print(F("Delta:    "));
  Serial.println(delta, 1);

  if (delta > 0) Serial.println(F("Direction: POSITIVE with load"));
  else if (delta < 0) Serial.println(F("Direction: NEGATIVE with load (OK if calibration uses same sign)"));
  else Serial.println(F("No response: check mechanics/wiring"));
}

void testGainSweep() {
  printHeader(F("TEST 2: GAIN SWEEP HEADROOM"));
  Serial.println(F("Keep same static load during whole sweep."));

  for (uint8_t i = 0; i < 3; i++) {
    setGainByIndex(i);
    delay(400);

    float mean, stddev;
    long minV, maxV;
    if (!captureStats(80, 20, mean, stddev, minV, maxV)) {
      Serial.println(F("HX711 not ready"));
      return;
    }

    Serial.print(F("Gain x")); Serial.print(GAIN_VALUES[i]);
    Serial.print(F(" | mean=")); Serial.print(mean, 1);
    Serial.print(F(" std=")); Serial.print(stddev, 1);
    Serial.print(F(" span=")); Serial.println(maxV - minV);

    if (labs(minV) > 8000000L || labs(maxV) > 8000000L) {
      Serial.println(F("  Warning: near clipping/saturation"));
    }
  }

  Serial.println(F("Pick highest gain that stays linear and unclipped."));
}

void testSettling() {
  printHeader(F("TEST 3: SETTLING RESPONSE"));
  Serial.println(F("Press Enter, then place/load once quickly and do not touch for 20s."));
  if (!waitForEnter(30000UL)) return;

  for (uint8_t s = 0; s < 20; s++) {
    float mean, stddev;
    long minV, maxV;
    if (!captureStats(20, 20, mean, stddev, minV, maxV)) {
      Serial.println(F("Capture failed"));
      return;
    }

    Serial.print(F("t=")); Serial.print(s + 1);
    Serial.print(F("s mean=")); Serial.print(mean, 1);
    Serial.print(F(" span=")); Serial.println(maxV - minV);
    delay(560);
  }

  Serial.println(F("If mean keeps drifting strongly, suspect creep/mechanics."));
}

void testLinearity() {
  printHeader(F("TEST 4: MULTI-POINT LINEARITY"));
  Serial.println(F("Recommended points: 0g, 1000g, 2000g, 3000g at CENTER."));

  const uint8_t N = 4;
  float grams[N];
  float raws[N];

  for (uint8_t i = 0; i < N; i++) {
    float gDefault = i * 1000.0f;
    if (!readFloatPrompt(F("Enter current known load (g)"), grams[i], gDefault)) return;

    Serial.println(F("Stabilizing... keep hands off"));
    if (!captureStableAverage(raws[i])) {
      Serial.println(F("Capture failed"));
      return;
    }

    Serial.print(F("Point "));
    Serial.print(i);
    Serial.print(F(": g="));
    Serial.print(grams[i], 1);
    Serial.print(F(" raw="));
    Serial.println(raws[i], 1);
  }

  // Linear regression raw = a + b*grams
  float sumG = 0, sumR = 0, sumGG = 0, sumGR = 0;
  for (uint8_t i = 0; i < N; i++) {
    sumG += grams[i];
    sumR += raws[i];
    sumGG += grams[i] * grams[i];
    sumGR += grams[i] * raws[i];
  }

  float denom = (N * sumGG - sumG * sumG);
  if (fabs(denom) < 1e-6f) {
    Serial.println(F("Invalid points"));
    return;
  }

  float b = (N * sumGR - sumG * sumR) / denom; // counts per gram
  float a = (sumR - b * sumG) / N;

  // R^2
  float ssTot = 0, ssRes = 0;
  float meanR = sumR / N;
  for (uint8_t i = 0; i < N; i++) {
    float pred = a + b * grams[i];
    float e = raws[i] - pred;
    ssRes += e * e;
    float d = raws[i] - meanR;
    ssTot += d * d;
  }
  float r2 = (ssTot > 1e-9f) ? (1.0f - ssRes / ssTot) : 0.0f;

  Serial.println();
  Serial.println(F("Linearity result:"));
  Serial.print(F("  slope (counts/g): "));
  Serial.println(b, 4);
  Serial.print(F("  intercept:        "));
  Serial.println(a, 2);
  Serial.print(F("  R^2:              "));
  Serial.println(r2, 5);

  for (uint8_t i = 1; i < N; i++) {
    float dg = grams[i] - grams[i - 1];
    if (fabs(dg) < 1e-6f) continue;
    float localSlope = (raws[i] - raws[i - 1]) / dg;
    Serial.print(F("  local slope "));
    Serial.print(i - 1);
    Serial.print(F("->"));
    Serial.print(i);
    Serial.print(F(": "));
    Serial.println(localSlope, 4);
  }

  if (r2 < 0.995f) {
    Serial.println(F("Interpretation: nonlinearity likely mechanical (binding/load path)."));
  } else {
    Serial.println(F("Interpretation: response is linear."));
  }
}

void testHysteresis() {
  printHeader(F("TEST 5: HYSTERESIS"));
  Serial.println(F("Step A: no load, press Enter."));
  if (!waitForEnter(30000UL)) return;
  float rawA;
  if (!captureStableAverage(rawA)) return;

  Serial.println(F("Step B: apply test load (e.g. 1kg), press Enter."));
  if (!waitForEnter(30000UL)) return;
  float rawB;
  if (!captureStableAverage(rawB)) return;

  Serial.println(F("Step C: remove same load, press Enter."));
  if (!waitForEnter(30000UL)) return;
  float rawC;
  if (!captureStableAverage(rawC)) return;

  Serial.print(F("No-load before: "));
  Serial.println(rawA, 1);
  Serial.print(F("Loaded:         "));
  Serial.println(rawB, 1);
  Serial.print(F("No-load after:  "));
  Serial.println(rawC, 1);

  float hyst = rawC - rawA;
  Serial.print(F("Hysteresis (after-before): "));
  Serial.println(hyst, 1);

  if (fabs(hyst) > 1500.0f) Serial.println(F("High hysteresis: suspect mechanics/cell preload/friction."));
}

void testCreep() {
  printHeader(F("TEST 6: CREEP (2 min)"));
  Serial.println(F("Apply constant load now, then press Enter. Do not touch setup."));
  if (!waitForEnter(30000UL)) return;

  float first = 0;
  for (uint8_t i = 0; i < 12; i++) {
    float avg;
    if (!captureStableAverage(avg, 20, 4)) return;

    if (i == 0) first = avg;
    float drift = avg - first;

    Serial.print(F("t=")); Serial.print(i * 10);
    Serial.print(F("s raw=")); Serial.print(avg, 1);
    Serial.print(F(" drift=")); Serial.println(drift, 1);

    delay(10000);
  }

  Serial.println(F("Large monotonic drift indicates creep/thermal/mechanical settling."));
}

void testCornerBalance() {
  printHeader(F("TEST 7: CORNER BALANCE"));
  Serial.println(F("This isolates uneven mechanics/preload among the 4 cells."));

  Serial.println(F("Step A: no touch, press Enter."));
  if (!waitForEnter(30000UL)) return;
  float baseline;
  if (!captureStableAverage(baseline)) return;

  const char* labels[4] = {"Top-Left", "Top-Right", "Bottom-Left", "Bottom-Right"};
  float deltas[4];

  for (uint8_t i = 0; i < 4; i++) {
    Serial.print(F("Apply same force at "));
    Serial.print(labels[i]);
    Serial.println(F(", then press Enter."));
    if (!waitForEnter(30000UL)) return;

    float v;
    if (!captureStableAverage(v, 20, 5)) return;
    deltas[i] = v - baseline;

    Serial.print(labels[i]);
    Serial.print(F(" delta="));
    Serial.println(deltas[i], 1);
  }

  float absMin = fabs(deltas[0]);
  float absMax = fabs(deltas[0]);
  for (uint8_t i = 1; i < 4; i++) {
    float a = fabs(deltas[i]);
    if (a < absMin) absMin = a;
    if (a > absMax) absMax = a;
  }

  float ratio = (absMin > 1e-6f) ? (absMax / absMin) : 999.0f;
  Serial.print(F("Corner response ratio max/min: "));
  Serial.println(ratio, 3);

  if (ratio > 1.6f) {
    Serial.println(F("Likely uneven load path or mounting/preload issue."));
  } else {
    Serial.println(F("Corner balance looks acceptable."));
  }
}

void testClippingMonitor() {
  printHeader(F("TEST 8: CLIPPING / SATURATION MONITOR (30s)"));
  Serial.println(F("Apply increasing load gradually. Watch for rail warnings."));

  long globalMin = 2147483647L;
  long globalMax = -2147483647L;

  uint32_t start = millis();
  while (millis() - start < 30000UL) {
    if (!scale.is_ready()) continue;
    long v = scale.read();
    if (v < globalMin) globalMin = v;
    if (v > globalMax) globalMax = v;

    if (labs(v) > 8000000L) {
      Serial.print(F("Warning near clip: "));
      Serial.println(v);
    }
    delay(20);
  }

  Serial.print(F("Min: "));
  Serial.println(globalMin);
  Serial.print(F("Max: "));
  Serial.println(globalMax);
  Serial.print(F("Span: "));
  Serial.println(globalMax - globalMin);

  if (labs(globalMin) > 8000000L || labs(globalMax) > 8000000L) {
    Serial.println(F("Conclusion: clipping likely. Lower gain or reduce bridge excitation/load."));
  } else {
    Serial.println(F("Conclusion: no hard clipping observed in this interval."));
  }
}

void setup() {
  Serial.begin(9600);
  delay(1000);

  pinMode(MOSFET_PIN, OUTPUT);
  sensorsOn();
  delay(500);

  scale.begin(HX_DOUT, HX_SCK);
  setGainByIndex(0); // x128 default

  Serial.println();
  Serial.println(F("=== TEST 08: HX711 NONLINEARITY DIAGNOSTICS ==="));

  Serial.print(F("HX711 init"));
  uint32_t start = millis();
  while (!scale.is_ready() && millis() - start < 5000UL) {
    Serial.print('.');
    delay(100);
  }

  if (scale.is_ready()) {
    Serial.println(F(" OK"));
    Serial.print(F("Initial raw: "));
    Serial.println(scale.read_average(10));
  } else {
    Serial.println(F(" FAIL"));
    Serial.println(F("Check wiring."));
  }

  printMenu();
}

void loop() {
  if (!Serial.available()) {
    delay(10);
    return;
  }

  char cmd = Serial.read();
  clearSerial();

  switch (cmd) {
    case 'h': printMenu(); break;
    case 'g': cmdSetGain(); break;
    case 't': cmdTare(); break;
    case '0': testNoiseFloor(); break;
    case '1': testPolarityDirection(); break;
    case '2': testGainSweep(); break;
    case '3': testSettling(); break;
    case '4': testLinearity(); break;
    case '5': testHysteresis(); break;
    case '6': testCreep(); break;
    case '7': testCornerBalance(); break;
    case '8': testClippingMonitor(); break;
    case 'p': printStatus(); break;
    case '\n':
    case '\r':
      break;
    default:
      Serial.print(F("Unknown command: "));
      Serial.println(cmd);
      printMenu();
      break;
  }
}
