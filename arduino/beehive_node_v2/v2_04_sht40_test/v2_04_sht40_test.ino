// ============================================================
// TEST 04: SHT40 SENSOR VIA MOSFET POWER
// Arduino Pro Mini 3.3V/8MHz + A1SHB MOSFET + SHT40
//
// PURPOSE: Verify SHT40 works when powered through MOSFET
//          The SHT40 will measure internal hive temperature
// SETUP:   SHT40 VCC connected to MOSFET drain (sensor rail)
//          SHT40 SDA → A4, SCL → A5
//          SHT40 GND → GND
//
// NOTE: SHT40 I2C address = 0x44
//       AHT10 I2C address = 0x38
//       They can coexist on the same bus
// ============================================================

#include <Wire.h>
#include "Adafruit_SHT4x.h"

#define MOSFET_PIN 4  // P-FET gate: LOW = ON, HIGH = OFF

Adafruit_SHT4x sht4 = Adafruit_SHT4x();

void sensorsOn() {
  digitalWrite(MOSFET_PIN, LOW);
}

void sensorsOff() {
  digitalWrite(MOSFET_PIN, HIGH);
}

// Quick I2C scanner to verify device is visible
void i2cScan() {
  Serial.println(F("  I2C scan:"));
  byte count = 0;
  for (byte addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);
    if (Wire.endTransmission() == 0) {
      Serial.print(F("    Found 0x"));
      if (addr < 16) Serial.print('0');
      Serial.print(addr, HEX);
      if (addr == 0x44) Serial.print(F(" (SHT40)"));
      if (addr == 0x38) Serial.print(F(" (AHT10)"));
      Serial.println();
      count++;
    }
  }
  if (count == 0) {
    Serial.println(F("    No I2C devices found!"));
  }
}

void setup() {
  Serial.begin(9600);
  delay(1000);

  pinMode(MOSFET_PIN, OUTPUT);
  sensorsOff();

  Serial.println();
  Serial.println(F("=== TEST 04: SHT40 VIA MOSFET ==="));
  Serial.println(F("Internal hive temperature sensor"));
  Serial.println(F("I2C address: 0x44"));
  Serial.println(F("=================================="));
  Serial.println();
}

void loop() {
  // --- Power UP ---
  Serial.print(F("Powering sensors ON... "));
  sensorsOn();
  delay(100);

  Wire.begin();
  delay(50);

  // Scan bus first
  Serial.println();
  i2cScan();

  // Init SHT40
  bool ok = sht4.begin();
  if (!ok) {
    delay(200);
    ok = sht4.begin();
  }

  if (!ok) {
    Serial.println(F("FAIL - SHT40 not detected"));
    Serial.println(F("  Check wiring: VCC→MOSFET drain, SDA→A4, SCL→A5"));
    Serial.println(F("  Verify 0x44 appears in I2C scan above"));
  } else {
    Serial.println(F("SHT40 OK"));

    // Set precision (high precision, no heater)
    sht4.setPrecision(SHT4X_HIGH_PRECISION);
    sht4.setHeater(SHT4X_NO_HEATER);

    // Read
    sensors_event_t humidity, temperature;
    sht4.getEvent(&humidity, &temperature);

    float t = temperature.temperature;
    float h = humidity.relative_humidity;

    Serial.print(F("  Temperature: "));
    Serial.print(t, 2);
    Serial.println(F(" °C"));
    Serial.print(F("  Humidity:    "));
    Serial.print(h, 1);
    Serial.println(F(" %"));

    // Print serial number for verification
    Serial.print(F("  Serial: 0x"));
    Serial.println(sht4.readSerial(), HEX);

    if (t < -10 || t > 70) {
      Serial.println(F("  WARNING: temperature out of expected range"));
    }
  }

  // --- Power DOWN ---
  Wire.end();
  delay(10);
  sensorsOff();
  Serial.println(F("Sensors OFF\n"));

  delay(5000);
}
