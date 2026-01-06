/*
 * Beehive Scale Calibration v2
 * 
 * Comprehensive calibration for 4x50kg load cell bridge
 * Uses multi-point calibration for maximum accuracy
 * 
 * Hardware:
 *   - ESP32-C3 SuperMini
 *   - HX711 Load Cell Amplifier
 *   - 4x 50kg load cells in bridge configuration
 * 
 * Calibration Process:
 *   1. Remove everything from scale → Zero point
 *   2. Place tray on scale → Tare (tray becomes zero reference)
 *   3. Add 1kg known weight → First calibration point
 *   4. Add 2kg total → Verification point (checks linearity)
 *   5. Save to EEPROM
 * 
 * Wiring:
 *   HX711 DOUT → GPIO3
 *   HX711 SCK  → GPIO1
 */

#include <HX711.h>
#include <EEPROM.h>

// HX711 pins - must match main sketch!
#define HX711_DOUT 3
#define HX711_SCK  1

// Battery monitoring
#define BATTERY_PIN 0
#define VOLTAGE_DIVIDER_RATIO 2.96

// EEPROM addresses for calibration data
#define EEPROM_SIZE 64
#define EEPROM_MAGIC_ADDR 0      // 4 bytes - magic number to verify valid data
#define EEPROM_FACTOR_ADDR 4     // 4 bytes - calibration factor (float)
#define EEPROM_OFFSET_ADDR 8     // 4 bytes - zero offset (long)
#define EEPROM_MAGIC_VALUE 0xBEEF1234

HX711 scale;

// Calibration data
long rawZero = 0;           // Raw reading with nothing on scale
long rawTare = 0;           // Raw reading with tray (this becomes our zero reference)
long raw1kg = 0;            // Raw reading with tray + 1kg
long raw2kg = 0;            // Raw reading with tray + 2kg
float calibrationFactor = 0;
bool zeroSet = false;
bool tareSet = false;
bool cal1kgSet = false;
bool cal2kgSet = false;

// Stability detection settings
#define STABILITY_SAMPLES 10
#define STABILITY_THRESHOLD 50  // Max variation in raw units to consider stable
#define READING_SAMPLES 20      // Samples to average for final reading

void setup() {
  Serial.begin(115200);
  delay(2000);  // Longer delay for serial to connect
  
  Serial.println("\nInitializing...");
  
  // Initialize EEPROM
  EEPROM.begin(EEPROM_SIZE);
  
  // Power cycle the HX711 by toggling SCK
  // HX711 powers down when SCK is HIGH for >60us
  pinMode(HX711_SCK, OUTPUT);
  digitalWrite(HX711_SCK, HIGH);
  delay(100);  // Power down
  digitalWrite(HX711_SCK, LOW);
  delay(100);  // Power up
  
  // Initialize HX711
  scale.begin(HX711_DOUT, HX711_SCK);
  scale.set_gain(128);
  
  // Wait for HX711 to stabilize with retries
  Serial.println("Waiting for HX711...");
  
  bool hx711Found = false;
  for (int attempt = 0; attempt < 20; attempt++) {
    delay(500);
    
    if (scale.is_ready()) {
      hx711Found = true;
      Serial.print("HX711 ready after ");
      Serial.print(attempt + 1);
      Serial.println(" attempts");
      break;
    }
    
    Serial.print(".");
    
    // Try power cycling again every 5 attempts
    if (attempt % 5 == 4) {
      Serial.println(" retrying...");
      digitalWrite(HX711_SCK, HIGH);
      delay(100);
      digitalWrite(HX711_SCK, LOW);
      delay(100);
      scale.begin(HX711_DOUT, HX711_SCK);
      scale.set_gain(128);
    }
  }
  
  if (!hx711Found) {
    Serial.println("\n\n!!! HX711 NOT DETECTED !!!");
    Serial.println("Troubleshooting:");
    Serial.println("  1. Check wiring:");
    Serial.println("     DOUT -> GPIO3");
    Serial.println("     SCK  -> GPIO1");
    Serial.println("     VCC  -> 5V (try 5V if 3.3V doesn't work!)");
    Serial.println("     GND  -> GND");
    Serial.println("  2. Try powering HX711 from 5V instead of 3.3V");
    Serial.println("  3. Check if load cells are connected to HX711");
    Serial.println("  4. Press RST to retry");
    Serial.println("\nContinuing anyway - some HX711 boards work without is_ready()...\n");
    delay(3000);
  }
  
  // Try a test read even if is_ready() failed
  Serial.println("\nAttempting test read...");
  long testRead = scale.read();
  Serial.print("Test read value: ");
  Serial.println(testRead);
  
  if (testRead == 0 || testRead == -1) {
    Serial.println("WARNING: Read returned 0 or -1, HX711 may not be working!");
  } else {
    Serial.println("HX711 appears to be working!");
  }
  
  printHeader();
  checkExistingCalibration();
  printMenu();
}

void printHeader() {
  Serial.println("\n");
  Serial.println("╔════════════════════════════════════════════════════════════╗");
  Serial.println("║        BEEHIVE SCALE CALIBRATION v2.0                      ║");
  Serial.println("║        4x50kg Load Cell Bridge Configuration               ║");
  Serial.println("╚════════════════════════════════════════════════════════════╝");
  Serial.println();
}

void checkExistingCalibration() {
  uint32_t magic;
  EEPROM.get(EEPROM_MAGIC_ADDR, magic);
  
  if (magic == EEPROM_MAGIC_VALUE) {
    float savedFactor;
    long savedOffset;
    EEPROM.get(EEPROM_FACTOR_ADDR, savedFactor);
    EEPROM.get(EEPROM_OFFSET_ADDR, savedOffset);
    
    Serial.println("┌─────────────────────────────────────────┐");
    Serial.println("│  EXISTING CALIBRATION FOUND IN EEPROM   │");
    Serial.println("├─────────────────────────────────────────┤");
    Serial.print("│  Calibration Factor: ");
    Serial.print(savedFactor, 4);
    Serial.println("            │");
    Serial.print("│  Zero Offset: ");
    Serial.print(savedOffset);
    Serial.println("                     │");
    Serial.println("└─────────────────────────────────────────┘");
    Serial.println("\nPress 'l' to load this calibration, or continue with new calibration.\n");
  } else {
    Serial.println("No existing calibration found in EEPROM.\n");
  }
}

void printMenu() {
  Serial.println("╔════════════════════════════════════════════════════════════╗");
  Serial.println("║                    CALIBRATION MENU                        ║");
  Serial.println("╠════════════════════════════════════════════════════════════╣");
  Serial.println("║  CALIBRATION STEPS (do in order):                          ║");
  Serial.println("║    1 = Set ZERO (scale completely empty)                   ║");
  Serial.println("║    2 = Set TARE (place tray, this becomes zero reference)  ║");
  Serial.println("║    3 = Calibrate with 1kg (tray + 1kg weight)              ║");
  Serial.println("║    4 = Verify with 2kg (tray + 2kg weight)                 ║");
  Serial.println("║    5 = SAVE calibration to EEPROM                          ║");
  Serial.println("╠════════════════════════════════════════════════════════════╣");
  Serial.println("║  OTHER COMMANDS:                                           ║");
  Serial.println("║    r = Continuous readings (calibrated weight)             ║");
  Serial.println("║    w = Single stable reading with statistics               ║");
  Serial.println("║    x = Raw readings (for debugging)                        ║");
  Serial.println("║    l = Load calibration from EEPROM                        ║");
  Serial.println("║    b = Battery voltage                                     ║");
  Serial.println("║    s = Show current calibration status                     ║");
  Serial.println("║    h = Show this menu                                      ║");
  Serial.println("╚════════════════════════════════════════════════════════════╝");
  Serial.println();
}

void printStatus() {
  Serial.println("\n┌─────────────────────────────────────────┐");
  Serial.println("│         CALIBRATION STATUS              │");
  Serial.println("├─────────────────────────────────────────┤");
  
  Serial.print("│  [");
  Serial.print(zeroSet ? "✓" : " ");
  Serial.print("] Zero point: ");
  if (zeroSet) {
    Serial.print(rawZero);
  } else {
    Serial.print("not set");
  }
  Serial.println("                    │");
  
  Serial.print("│  [");
  Serial.print(tareSet ? "✓" : " ");
  Serial.print("] Tare (tray): ");
  if (tareSet) {
    Serial.print(rawTare);
    Serial.print(" (tray ~");
    if (calibrationFactor > 0) {
      Serial.print((rawTare - rawZero) / calibrationFactor, 0);
      Serial.print("g)");
    } else {
      Serial.print("?g)");
    }
  } else {
    Serial.print("not set");
  }
  Serial.println("           │");
  
  Serial.print("│  [");
  Serial.print(cal1kgSet ? "✓" : " ");
  Serial.print("] 1kg point: ");
  if (cal1kgSet) {
    Serial.print(raw1kg);
  } else {
    Serial.print("not set");
  }
  Serial.println("                    │");
  
  Serial.print("│  [");
  Serial.print(cal2kgSet ? "✓" : " ");
  Serial.print("] 2kg verify: ");
  if (cal2kgSet) {
    Serial.print(raw2kg);
  } else {
    Serial.print("not set");
  }
  Serial.println("                   │");
  
  Serial.println("├─────────────────────────────────────────┤");
  Serial.print("│  Calibration Factor: ");
  if (calibrationFactor > 0) {
    Serial.print(calibrationFactor, 4);
  } else {
    Serial.print("not calculated");
  }
  Serial.println("            │");
  Serial.println("└─────────────────────────────────────────┘\n");
}

// Wait for readings to stabilize and return averaged value
long getStableReading() {
  Serial.println("  Waiting for stability...");
  
  long readings[STABILITY_SAMPLES];
  int stableCount = 0;
  int attempts = 0;
  const int maxAttempts = 100;
  
  while (stableCount < 3 && attempts < maxAttempts) {
    attempts++;
    
    // Fill buffer with readings
    for (int i = 0; i < STABILITY_SAMPLES; i++) {
      readings[i] = scale.read();
      delay(50);
    }
    
    // Calculate mean and standard deviation
    long sum = 0;
    for (int i = 0; i < STABILITY_SAMPLES; i++) {
      sum += readings[i];
    }
    long mean = sum / STABILITY_SAMPLES;
    
    long maxDev = 0;
    for (int i = 0; i < STABILITY_SAMPLES; i++) {
      long dev = abs(readings[i] - mean);
      if (dev > maxDev) maxDev = dev;
    }
    
    if (maxDev < STABILITY_THRESHOLD) {
      stableCount++;
      Serial.print("  Stable reading ");
      Serial.print(stableCount);
      Serial.print("/3: ");
      Serial.print(mean);
      Serial.print(" (variation: ±");
      Serial.print(maxDev);
      Serial.println(")");
    } else {
      stableCount = 0;
      if (attempts % 10 == 0) {
        Serial.print("  Still settling... (variation: ±");
        Serial.print(maxDev);
        Serial.println(")");
      }
    }
  }
  
  if (attempts >= maxAttempts) {
    Serial.println("  WARNING: Could not achieve full stability!");
  }
  
  // Take final averaged reading
  Serial.println("  Taking final measurement...");
  long finalSum = 0;
  for (int i = 0; i < READING_SAMPLES; i++) {
    finalSum += scale.read();
    delay(50);
  }
  
  return finalSum / READING_SAMPLES;
}

void setZero() {
  Serial.println("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  Serial.println("  STEP 1: SET ZERO POINT");
  Serial.println("  Remove EVERYTHING from the scale (no tray, nothing)");
  Serial.println("  Press any key when ready...");
  Serial.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  while (!Serial.available()) delay(10);
  while (Serial.available()) Serial.read();
  
  rawZero = getStableReading();
  zeroSet = true;
  
  Serial.println("\n  ✓ ZERO POINT SET!");
  Serial.print("  Raw zero value: ");
  Serial.println(rawZero);
  Serial.println("\n  Next: Press '2' to set tare with tray\n");
}

void setTare() {
  if (!zeroSet) {
    Serial.println("\n  ⚠ Please set zero point first (press '1')\n");
    return;
  }
  
  Serial.println("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  Serial.println("  STEP 2: SET TARE (TRAY)");
  Serial.println("  Place the metal tray on the scale");
  Serial.println("  The tray weight will be subtracted from all readings");
  Serial.println("  Press any key when ready...");
  Serial.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  while (!Serial.available()) delay(10);
  while (Serial.available()) Serial.read();
  
  rawTare = getStableReading();
  tareSet = true;
  
  Serial.println("\n  ✓ TARE SET!");
  Serial.print("  Raw tare value: ");
  Serial.println(rawTare);
  Serial.print("  Tray raw delta: ");
  Serial.println(rawTare - rawZero);
  Serial.println("\n  Next: Press '3' to calibrate with 1kg weight\n");
}

void calibrate1kg() {
  if (!tareSet) {
    Serial.println("\n  ⚠ Please set tare first (press '2')\n");
    return;
  }
  
  Serial.println("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  Serial.println("  STEP 3: CALIBRATE WITH 1KG");
  Serial.println("  Place exactly 1kg (1000g) on the tray");
  Serial.println("  (one pack of flour)");
  Serial.println("  Press any key when ready...");
  Serial.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  while (!Serial.available()) delay(10);
  while (Serial.available()) Serial.read();
  
  raw1kg = getStableReading();
  cal1kgSet = true;
  
  // Calculate calibration factor from 1kg point
  long delta1kg = raw1kg - rawTare;
  calibrationFactor = (float)delta1kg / 1000.0;  // raw units per gram
  
  Serial.println("\n  ✓ 1KG CALIBRATION COMPLETE!");
  Serial.print("  Raw 1kg value: ");
  Serial.println(raw1kg);
  Serial.print("  Delta from tare: ");
  Serial.println(delta1kg);
  Serial.print("  Calibration factor: ");
  Serial.print(calibrationFactor, 4);
  Serial.println(" raw/gram");
  
  // Estimate tray weight now that we have a factor
  float trayWeight = (rawTare - rawZero) / calibrationFactor;
  Serial.print("  Estimated tray weight: ");
  Serial.print(trayWeight, 0);
  Serial.println("g");
  
  Serial.println("\n  Next: Press '4' to verify with 2kg weight\n");
}

void verify2kg() {
  if (!cal1kgSet) {
    Serial.println("\n  ⚠ Please calibrate with 1kg first (press '3')\n");
    return;
  }
  
  Serial.println("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  Serial.println("  STEP 4: VERIFY WITH 2KG");
  Serial.println("  Place exactly 2kg (2000g) on the tray");
  Serial.println("  (both packs of flour)");
  Serial.println("  Press any key when ready...");
  Serial.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  while (!Serial.available()) delay(10);
  while (Serial.available()) Serial.read();
  
  raw2kg = getStableReading();
  cal2kgSet = true;
  
  // Check linearity
  long delta2kg = raw2kg - rawTare;
  float measured2kg = delta2kg / calibrationFactor;
  float error2kg = measured2kg - 2000.0;
  float errorPercent = (error2kg / 2000.0) * 100.0;
  
  Serial.println("\n  ✓ 2KG VERIFICATION COMPLETE!");
  Serial.print("  Raw 2kg value: ");
  Serial.println(raw2kg);
  Serial.print("  Measured weight: ");
  Serial.print(measured2kg, 1);
  Serial.println("g");
  Serial.print("  Expected: 2000g");
  Serial.print("  Error: ");
  Serial.print(error2kg, 1);
  Serial.print("g (");
  Serial.print(errorPercent, 2);
  Serial.println("%)");
  
  Serial.println("\n  ┌─────────────────────────────────────────┐");
  if (abs(errorPercent) < 1.0) {
    Serial.println("  │  ✓ EXCELLENT! Error < 1%                │");
    Serial.println("  │    Scale is highly linear               │");
  } else if (abs(errorPercent) < 2.0) {
    Serial.println("  │  ✓ GOOD! Error < 2%                     │");
    Serial.println("  │    Acceptable for beehive monitoring    │");
  } else if (abs(errorPercent) < 5.0) {
    Serial.println("  │  ⚠ FAIR. Error < 5%                     │");
    Serial.println("  │    Consider adjusting factor            │");
  } else {
    Serial.println("  │  ✗ POOR. Error > 5%                     │");
    Serial.println("  │    Check load cell mounting             │");
  }
  Serial.println("  └─────────────────────────────────────────┘");
  
  // Option to use 2-point average for better accuracy
  Serial.println("\n  Would you like to use 2-point average calibration?");
  Serial.println("  This averages the factor from 1kg and 2kg points.");
  Serial.println("  Press 'y' for yes, any other key to keep 1kg factor...");
  
  while (!Serial.available()) delay(10);
  char c = Serial.read();
  while (Serial.available()) Serial.read();
  
  if (c == 'y' || c == 'Y') {
    float factor1kg = (float)(raw1kg - rawTare) / 1000.0;
    float factor2kg = (float)(raw2kg - rawTare) / 2000.0;
    calibrationFactor = (factor1kg + factor2kg) / 2.0;
    
    Serial.print("  Using averaged calibration factor: ");
    Serial.println(calibrationFactor, 4);
  }
  
  Serial.println("\n  Calibration complete! Press '5' to save to EEPROM\n");
  Serial.println("  Or press 'r' to test with continuous readings\n");
}

void saveCalibration() {
  if (calibrationFactor <= 0 || !tareSet) {
    Serial.println("\n  ⚠ Complete calibration first!\n");
    return;
  }
  
  // Save to EEPROM
  EEPROM.put(EEPROM_MAGIC_ADDR, (uint32_t)EEPROM_MAGIC_VALUE);
  EEPROM.put(EEPROM_FACTOR_ADDR, calibrationFactor);
  EEPROM.put(EEPROM_OFFSET_ADDR, rawTare);  // Store tare as the zero reference
  EEPROM.commit();
  
  Serial.println("\n  ┌─────────────────────────────────────────┐");
  Serial.println("  │  ✓ CALIBRATION SAVED TO EEPROM!         │");
  Serial.println("  ├─────────────────────────────────────────┤");
  Serial.print("  │  Factor: ");
  Serial.print(calibrationFactor, 4);
  Serial.println("                       │");
  Serial.print("  │  Offset: ");
  Serial.print(rawTare);
  Serial.println("                            │");
  Serial.println("  └─────────────────────────────────────────┘");
  
  Serial.println("\n  Copy these values to your main sketch:");
  Serial.println("  ─────────────────────────────────────────");
  Serial.print("  #define CALIBRATION_FACTOR ");
  Serial.println(calibrationFactor, 4);
  Serial.println("  ─────────────────────────────────────────\n");
}

void loadCalibration() {
  uint32_t magic;
  EEPROM.get(EEPROM_MAGIC_ADDR, magic);
  
  if (magic != EEPROM_MAGIC_VALUE) {
    Serial.println("\n  ⚠ No valid calibration in EEPROM!\n");
    return;
  }
  
  EEPROM.get(EEPROM_FACTOR_ADDR, calibrationFactor);
  EEPROM.get(EEPROM_OFFSET_ADDR, rawTare);
  tareSet = true;
  
  Serial.println("\n  ✓ Calibration loaded from EEPROM!");
  Serial.print("  Factor: ");
  Serial.println(calibrationFactor, 4);
  Serial.print("  Offset: ");
  Serial.println(rawTare);
  Serial.println();
}

void continuousReadings() {
  if (calibrationFactor <= 0) {
    Serial.println("\n  ⚠ No calibration! Showing raw values only.\n");
  }
  
  Serial.println("\n  Continuous readings (press any key to stop)...\n");
  Serial.println("  Raw        | Weight     | Delta from last");
  Serial.println("  -----------|------------|----------------");
  
  long lastWeight = 0;
  
  while (!Serial.available()) {
    long raw = scale.read();
    long rawDelta = raw - rawTare;
    float weight = (calibrationFactor > 0) ? rawDelta / calibrationFactor : 0;
    float delta = weight - lastWeight;
    lastWeight = weight;
    
    Serial.print("  ");
    Serial.print(raw);
    Serial.print("\t| ");
    if (calibrationFactor > 0) {
      Serial.print(weight, 1);
      Serial.print("g\t| ");
      if (delta >= 0) Serial.print("+");
      Serial.print(delta, 1);
      Serial.println("g");
    } else {
      Serial.println("N/A\t| N/A");
    }
    
    delay(500);
  }
  while (Serial.available()) Serial.read();
  Serial.println("\n  Stopped.\n");
}

void singleReading() {
  Serial.println("\n  Taking stable reading...");
  
  long raw = getStableReading();
  long rawDelta = raw - rawTare;
  float weight = (calibrationFactor > 0) ? rawDelta / calibrationFactor : 0;
  
  Serial.println("\n  ┌─────────────────────────────────────────┐");
  Serial.print("  │  Raw value: ");
  Serial.print(raw);
  Serial.println("                       │");
  Serial.print("  │  Raw delta: ");
  Serial.print(rawDelta);
  Serial.println("                        │");
  if (calibrationFactor > 0) {
    Serial.print("  │  Weight: ");
    Serial.print(weight, 1);
    Serial.println("g                        │");
  }
  Serial.println("  └─────────────────────────────────────────┘\n");
}

void rawReadings() {
  Serial.println("\n  Raw readings (press any key to stop)...\n");
  
  while (!Serial.available()) {
    if (scale.is_ready()) {
      long raw = scale.read();
      Serial.print("  Raw: ");
      Serial.print(raw);
      if (rawZero != 0) {
        Serial.print("  (delta from zero: ");
        Serial.print(raw - rawZero);
        Serial.print(")");
      }
      Serial.println();
    }
    delay(200);
  }
  while (Serial.available()) Serial.read();
  Serial.println("\n  Stopped.\n");
}

void readBattery() {
  // Take multiple readings and average
  long sum = 0;
  const int samples = 10;
  
  for (int i = 0; i < samples; i++) {
    sum += analogRead(BATTERY_PIN);
    delay(10);
  }
  
  int rawADC = sum / samples;
  float adcVoltage = (rawADC / 4095.0) * 3.3;
  float batteryVoltage = adcVoltage * VOLTAGE_DIVIDER_RATIO;
  
  // Calculate percentage (Li-Ion: 3.0V = 0%, 4.2V = 100%)
  int percentage = constrain(map(batteryVoltage * 100, 300, 420, 0, 100), 0, 100);
  
  Serial.println("\n  ┌─────────────────────────────────────────┐");
  Serial.println("  │           BATTERY STATUS                │");
  Serial.println("  ├─────────────────────────────────────────┤");
  Serial.print("  │  ADC Raw: ");
  Serial.print(rawADC);
  Serial.println("                          │");
  Serial.print("  │  ADC Voltage: ");
  Serial.print(adcVoltage, 3);
  Serial.println("V                    │");
  Serial.print("  │  Battery: ");
  Serial.print(batteryVoltage, 2);
  Serial.print("V (");
  Serial.print(percentage);
  Serial.println("%)                │");
  Serial.println("  └─────────────────────────────────────────┘");
  
  Serial.println("\n  If battery voltage is inaccurate, measure actual voltage");
  Serial.println("  with multimeter and calculate: NEW_RATIO = 2.96 * (actual/displayed)\n");
}

void loop() {
  if (Serial.available()) {
    char cmd = Serial.read();
    while (Serial.available()) Serial.read();  // Clear buffer
    
    switch (cmd) {
      case '1':
        setZero();
        break;
      case '2':
        setTare();
        break;
      case '3':
        calibrate1kg();
        break;
      case '4':
        verify2kg();
        break;
      case '5':
        saveCalibration();
        break;
      case 'r':
      case 'R':
        continuousReadings();
        break;
      case 'w':
      case 'W':
        singleReading();
        break;
      case 'x':
      case 'X':
        rawReadings();
        break;
      case 'l':
      case 'L':
        loadCalibration();
        break;
      case 'b':
      case 'B':
        readBattery();
        break;
      case 's':
      case 'S':
        printStatus();
        break;
      case 'h':
      case 'H':
      case '?':
        printMenu();
        break;
      case '\n':
      case '\r':
        // Ignore newlines
        break;
      default:
        Serial.print("  Unknown command: '");
        Serial.print(cmd);
        Serial.println("'. Press 'h' for help.");
        break;
    }
  }
}
