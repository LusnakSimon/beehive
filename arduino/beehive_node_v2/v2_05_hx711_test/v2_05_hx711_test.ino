// ============================================================
// TEST 05: HX711 LOAD CELL VIA MOSFET POWER
// Arduino Pro Mini 3.3V/8MHz + A1SHB MOSFET + HX711
//
// PURPOSE: Verify HX711 works after MOSFET power cycling
//          Shows raw values for later calibration
// SETUP:   HX711 VCC connected to MOSFET drain (sensor rail)
//          HX711 DT → D5, SCK → D6
//          HX711 GND → GND
//          Load cell connected to HX711 (E+,E-,A+,A-)
// ============================================================

#include "HX711.h"

#define MOSFET_PIN 4
#define HX_DOUT    5
#define HX_SCK     6

HX711 scale;

void sensorsOn() {
  digitalWrite(MOSFET_PIN, LOW);
}

void sensorsOff() {
  digitalWrite(MOSFET_PIN, HIGH);
}

void setup() {
  Serial.begin(9600);
  delay(1000);

  pinMode(MOSFET_PIN, OUTPUT);
  sensorsOff();

  Serial.println();
  Serial.println(F("=== TEST 05: HX711 VIA MOSFET ==="));
  Serial.println(F("DT=D5  SCK=D6"));
  Serial.println(F("================================="));
  Serial.println();
}

void loop() {
  // --- Power UP ---
  Serial.print(F("Powering sensors ON..."));
  sensorsOn();

  // HX711 needs time after power-up to stabilize
  // Datasheet says 400ms, give it 500ms
  delay(500);

  // Initialize HX711
  scale.begin(HX_DOUT, HX_SCK);

  // Wait for HX711 ready
  Serial.print(F(" waiting for HX711"));
  unsigned long start = millis();
  while (!scale.is_ready() && millis() - start < 3000) {
    Serial.print('.');
    delay(100);
  }

  if (!scale.is_ready()) {
    Serial.println(F(" FAIL - HX711 not ready after 3s"));
    Serial.println(F("  Check wiring: VCC→MOSFET drain, DT→D5, SCK→D6"));
    Serial.println(F("  Check load cell connections to HX711"));
  } else {
    Serial.println(F(" OK"));

    // Read raw value (single)
    long raw_single = scale.read();
    Serial.print(F("  Raw (single):    "));
    Serial.println(raw_single);

    // Read averaged (5 samples)
    long raw_avg5 = scale.read_average(5);
    Serial.print(F("  Raw (avg of 5):  "));
    Serial.println(raw_avg5);

    // Read averaged (10 samples)
    long raw_avg10 = scale.read_average(10);
    Serial.print(F("  Raw (avg of 10): "));
    Serial.println(raw_avg10);

    // Show stability (take 5 readings, show min/max/spread)
    Serial.println(F("  Stability test (5 single reads):"));
    long minVal = 0x7FFFFFFF, maxVal = -0x7FFFFFFF;
    for (int i = 0; i < 5; i++) {
      long v = scale.read();
      if (v < minVal) minVal = v;
      if (v > maxVal) maxVal = v;
      Serial.print(F("    #"));
      Serial.print(i + 1);
      Serial.print(F(": "));
      Serial.println(v);
      delay(100);
    }
    Serial.print(F("  Spread: "));
    Serial.print(maxVal - minVal);
    Serial.print(F("  (min="));
    Serial.print(minVal);
    Serial.print(F(" max="));
    Serial.print(maxVal);
    Serial.println(F(")"));

    // Hint for calibration
    Serial.println();
    Serial.println(F("  NOTE: Write down the 'no load' raw value."));
    Serial.println(F("  This becomes your tare offset for calibration."));
  }

  // --- Power DOWN ---
  // Power down HX711 before cutting MOSFET to avoid glitches
  scale.power_down();
  delay(10);
  sensorsOff();
  Serial.println(F("Sensors OFF\n"));

  delay(5000);
}
