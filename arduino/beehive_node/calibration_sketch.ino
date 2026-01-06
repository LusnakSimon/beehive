// ============================================================
// BEEHIVE NODE CALIBRATION SKETCH
// ESP32-C3 SuperMini + HX711 + AHT10 + Battery
// 
// Serial Commands (115200 baud):
//   t - Tare (zero) the scale
//   c - Start calibration with known weight
//   r - Read all sensors once
//   b - Read battery voltage
//   h - Show help
// ============================================================

#include <Wire.h>
#include <Adafruit_AHTX0.h>
#include <HX711.h>

// ===== PIN DEFINITIONS =====
#define HX711_DOUT  3   // Same as main sketch
#define HX711_SCK   1   // Same as main sketch
#define BATTERY_PIN 0   // GPIO0 for battery ADC
#define I2C_SDA     8
#define I2C_SCL     9

// ===== BATTERY CONFIG =====
// Voltage divider: 480k / 220k
// Ratio = (480k + 220k) / 220k = 3.18
#define VOLTAGE_DIVIDER_RATIO 3.18
#define ADC_RESOLUTION 4095.0
#define ADC_VREF 3.3

// ===== OBJECTS =====
HX711 scale;
Adafruit_AHTX0 aht;

// ===== CALIBRATION VALUES =====
float calibrationFactor = 1.0;  // Will be calculated
long zeroOffset = 0;            // Tare offset

// ===== SETUP =====
void setup() {
  Serial.begin(115200);
  delay(2000);
  
  Serial.println("\n");
  Serial.println("╔══════════════════════════════════════════╗");
  Serial.println("║    BEEHIVE NODE CALIBRATION SKETCH       ║");
  Serial.println("╚══════════════════════════════════════════╝");
  Serial.println();
  
  // Initialize I2C
  Wire.begin(I2C_SDA, I2C_SCL);
  
  // Initialize AHT10
  Serial.print("AHT10: ");
  if (aht.begin()) {
    Serial.println("OK ✓");
  } else {
    Serial.println("FAILED ✗");
  }
  
  // Initialize HX711
  Serial.print("HX711: ");
  scale.begin(HX711_DOUT, HX711_SCK);
  delay(500);
  if (scale.is_ready()) {
    Serial.println("OK ✓");
    zeroOffset = scale.read_average(10);
    Serial.print("  Initial offset: ");
    Serial.println(zeroOffset);
  } else {
    Serial.println("FAILED ✗");
  }
  
  // Initialize Battery ADC
  analogReadResolution(12);
  pinMode(BATTERY_PIN, INPUT);
  Serial.println("Battery ADC: OK ✓");
  
  Serial.println();
  printHelp();
  Serial.println("\n--- Continuous readings (send command to interact) ---\n");
}

// ===== MAIN LOOP =====
void loop() {
  // Handle serial commands
  if (Serial.available()) {
    char cmd = Serial.read();
    handleCommand(cmd);
  }
  
  // Continuous display
  printContinuousReadings();
  delay(1000);
}

// ===== COMMAND HANDLER =====
void handleCommand(char cmd) {
  Serial.println();
  
  switch (cmd) {
    case 't':
    case 'T':
      doTare();
      break;
      
    case 'c':
    case 'C':
      doCalibration();
      break;
      
    case 'r':
    case 'R':
      printDetailedReadings();
      break;
      
    case 'b':
    case 'B':
      printBatteryDetails();
      break;
      
    case 'h':
    case 'H':
    case '?':
      printHelp();
      break;
      
    case '\n':
    case '\r':
      // Ignore newlines
      break;
      
    default:
      Serial.print("Unknown command: ");
      Serial.println(cmd);
      break;
  }
}

// ===== TARE (ZERO) =====
void doTare() {
  Serial.println("╔════════════════════════════════════╗");
  Serial.println("║         TARE (ZERO SCALE)          ║");
  Serial.println("╚════════════════════════════════════╝");
  Serial.println("Remove all weight from the scale...");
  Serial.println("Taking 20 readings...");
  
  if (!scale.is_ready()) {
    Serial.println("ERROR: HX711 not ready!");
    return;
  }
  
  long sum = 0;
  for (int i = 0; i < 20; i++) {
    sum += scale.read();
    Serial.print(".");
    delay(100);
  }
  zeroOffset = sum / 20;
  
  Serial.println(" Done!");
  Serial.print("New zero offset: ");
  Serial.println(zeroOffset);
  Serial.println();
}

// ===== CALIBRATION =====
void doCalibration() {
  Serial.println("╔════════════════════════════════════╗");
  Serial.println("║      WEIGHT CALIBRATION            ║");
  Serial.println("╚════════════════════════════════════╝");
  Serial.println();
  Serial.println("Step 1: Make sure the scale is tared (empty)");
  Serial.println("Step 2: Place a KNOWN weight on the scale");
  Serial.println("Step 3: Enter the weight in grams (e.g., 1000 for 1kg)");
  Serial.println();
  Serial.print("Enter known weight in grams: ");
  
  // Wait for input
  while (!Serial.available()) {
    delay(100);
  }
  
  float knownWeight = Serial.parseFloat();
  Serial.println(knownWeight);
  
  if (knownWeight <= 0) {
    Serial.println("ERROR: Invalid weight!");
    return;
  }
  
  Serial.println("Reading scale with known weight...");
  
  if (!scale.is_ready()) {
    Serial.println("ERROR: HX711 not ready!");
    return;
  }
  
  long sum = 0;
  for (int i = 0; i < 20; i++) {
    sum += scale.read();
    Serial.print(".");
    delay(100);
  }
  long rawValue = sum / 20;
  
  Serial.println(" Done!");
  Serial.print("Raw value with weight: ");
  Serial.println(rawValue);
  
  long deltaRaw = rawValue - zeroOffset;
  Serial.print("Delta from zero: ");
  Serial.println(deltaRaw);
  
  if (deltaRaw == 0) {
    Serial.println("ERROR: No weight change detected!");
    return;
  }
  
  calibrationFactor = (float)deltaRaw / knownWeight;
  
  Serial.println();
  Serial.println("════════════════════════════════════════");
  Serial.print("CALIBRATION FACTOR: ");
  Serial.println(calibrationFactor, 2);
  Serial.println("════════════════════════════════════════");
  Serial.println();
  Serial.println("Copy this value to your main sketch:");
  Serial.print("  #define HX711_SCALE ");
  Serial.println(calibrationFactor, 2);
  Serial.println();
}

// ===== CONTINUOUS READINGS =====
void printContinuousReadings() {
  // Weight
  float weight = 0;
  if (scale.is_ready()) {
    // Average 5 readings for stability
    long sum = 0;
    for (int i = 0; i < 5; i++) {
      sum += scale.read();
    }
    long rawValue = sum / 5;
    
    float delta = rawValue - zeroOffset;
    
    if (calibrationFactor != 1.0) {
      // Calibrated - show in grams
      weight = delta / calibrationFactor;
      Serial.print("W: ");
      Serial.print(weight, 1);
      Serial.print("g | ");
    } else {
      // Not calibrated - show raw delta
      Serial.print("W: raw delta=");
      Serial.print((long)delta);
      Serial.print(" | ");
    }
  } else {
    Serial.print("W: -- | ");
  }
  
  // Temperature & Humidity
  sensors_event_t humidity, temp;
  if (aht.getEvent(&humidity, &temp)) {
    Serial.print("T: ");
    Serial.print(temp.temperature, 1);
    Serial.print("°C  H: ");
    Serial.print(humidity.relative_humidity, 1);
    Serial.print("% | ");
  } else {
    Serial.print("T: -- H: -- | ");
  }
  
  // Battery
  float voltage = readBatteryVoltage();
  Serial.print("Bat: ");
  Serial.print(voltage, 2);
  Serial.println("V");
}

// ===== DETAILED READINGS =====
void printDetailedReadings() {
  Serial.println("╔════════════════════════════════════╗");
  Serial.println("║       DETAILED SENSOR READING      ║");
  Serial.println("╚════════════════════════════════════╝");
  Serial.println();
  
  // HX711
  Serial.println("── HX711 Load Cell ──");
  if (scale.is_ready()) {
    Serial.print("  Raw value:      ");
    long raw = scale.read_average(10);
    Serial.println(raw);
    Serial.print("  Zero offset:    ");
    Serial.println(zeroOffset);
    Serial.print("  Delta:          ");
    Serial.println(raw - zeroOffset);
    Serial.print("  Cal factor:     ");
    Serial.println(calibrationFactor, 2);
    Serial.print("  Weight:         ");
    if (calibrationFactor != 0 && calibrationFactor != 1.0) {
      Serial.print((raw - zeroOffset) / calibrationFactor, 2);
      Serial.println(" g");
    } else {
      Serial.println("(not calibrated)");
    }
  } else {
    Serial.println("  ERROR: Not ready!");
  }
  Serial.println();
  
  // AHT10
  Serial.println("── AHT10 Temp/Humidity ──");
  sensors_event_t humidity, temp;
  if (aht.getEvent(&humidity, &temp)) {
    Serial.print("  Temperature:    ");
    Serial.print(temp.temperature, 2);
    Serial.println(" °C");
    Serial.print("  Humidity:       ");
    Serial.print(humidity.relative_humidity, 2);
    Serial.println(" %");
  } else {
    Serial.println("  ERROR: Read failed!");
  }
  Serial.println();
  
  // Battery
  printBatteryDetails();
}

// ===== BATTERY DETAILS =====
void printBatteryDetails() {
  Serial.println("── Battery Measurement ──");
  
  // Take multiple readings
  long sum = 0;
  int samples = 20;
  for (int i = 0; i < samples; i++) {
    sum += analogRead(BATTERY_PIN);
    delay(10);
  }
  int rawADC = sum / samples;
  
  float adcVoltage = (rawADC / ADC_RESOLUTION) * ADC_VREF;
  float batteryVoltage = adcVoltage * VOLTAGE_DIVIDER_RATIO;
  int percent = voltageToPercent(batteryVoltage);
  
  Serial.print("  Raw ADC:        ");
  Serial.println(rawADC);
  Serial.print("  ADC Voltage:    ");
  Serial.print(adcVoltage, 3);
  Serial.println(" V");
  Serial.print("  Divider ratio:  ");
  Serial.println(VOLTAGE_DIVIDER_RATIO, 2);
  Serial.print("  Battery V:      ");
  Serial.print(batteryVoltage, 2);
  Serial.println(" V");
  Serial.print("  Percent:        ");
  Serial.print(percent);
  Serial.println(" %");
  Serial.println();
  
  // Expected values
  Serial.println("  Expected ranges (LiPo 1S):");
  Serial.println("    Full:  4.20V (100%)");
  Serial.println("    Nom:   3.70V (~50%)");
  Serial.println("    Low:   3.30V (~10%)");
  Serial.println("    Empty: 3.00V (0%)");
  Serial.println();
}

// ===== READ BATTERY VOLTAGE =====
float readBatteryVoltage() {
  long sum = 0;
  for (int i = 0; i < 10; i++) {
    sum += analogRead(BATTERY_PIN);
    delay(2);
  }
  int rawADC = sum / 10;
  float adcVoltage = (rawADC / ADC_RESOLUTION) * ADC_VREF;
  return adcVoltage * VOLTAGE_DIVIDER_RATIO;
}

// ===== VOLTAGE TO PERCENT =====
int voltageToPercent(float voltage) {
  // LiPo discharge curve approximation
  if (voltage >= 4.20) return 100;
  if (voltage <= 3.00) return 0;
  
  // Piecewise linear approximation
  if (voltage >= 4.00) return map(voltage * 100, 400, 420, 80, 100);
  if (voltage >= 3.70) return map(voltage * 100, 370, 400, 30, 80);
  if (voltage >= 3.30) return map(voltage * 100, 330, 370, 10, 30);
  return map(voltage * 100, 300, 330, 0, 10);
}

// ===== HELP =====
void printHelp() {
  Serial.println("╔════════════════════════════════════╗");
  Serial.println("║           COMMANDS                 ║");
  Serial.println("╠════════════════════════════════════╣");
  Serial.println("║  t - Tare (zero) the scale         ║");
  Serial.println("║  c - Calibrate with known weight   ║");
  Serial.println("║  r - Read all sensors (detailed)   ║");
  Serial.println("║  b - Battery voltage details       ║");
  Serial.println("║  h - Show this help                ║");
  Serial.println("╚════════════════════════════════════╝");
}
