// ============================================================
// TEST 03b: AHT10 DIRECT POWER TEST (no MOSFET)
// Arduino Pro Mini 3.3V/8MHz + AHT10
//
// PURPOSE: Rule out MOSFET as cause of I2C failure
// SETUP:   AHT10 VCC → Pro Mini VCC (3.3V direct)
//          AHT10 GND → Pro Mini GND
//          AHT10 SDA → A4
//          AHT10 SCL → A5
//          NO MOSFET involved
// ============================================================

#include <Wire.h>
#include <Adafruit_AHTX0.h>

Adafruit_AHTX0 aht;

void i2cScan() {
  Serial.println(F("I2C scan (0x01-0x7E):"));
  byte count = 0;
  for (byte addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);
    byte err = Wire.endTransmission();
    if (err == 0) {
      Serial.print(F("  0x"));
      if (addr < 16) Serial.print('0');
      Serial.print(addr, HEX);
      if (addr == 0x38) Serial.print(F(" <-- AHT10"));
      if (addr == 0x44) Serial.print(F(" <-- SHT40"));
      Serial.println();
      count++;
    } else if (err == 2) {
      // NACK on address — device not present (normal)
    } else if (err != 2) {
      // err=1: data too long, err=3: NACK on data, err=4: other, err=5: timeout
      Serial.print(F("  0x"));
      if (addr < 16) Serial.print('0');
      Serial.print(addr, HEX);
      Serial.print(F(" ERROR="));
      Serial.println(err);
    }
  }
  Serial.print(F("Total devices: "));
  Serial.println(count);
  if (count == 0) {
    Serial.println(F("\nNO DEVICES — check:"));
    Serial.println(F("  1. SDA wire → A4  (pin closest to A3)"));
    Serial.println(F("  2. SCL wire → A5  (pin closest to A4)"));
    Serial.println(F("  3. Verify with multimeter:"));
    Serial.println(F("     - Continuity from AHT10 SDA pad to Pro Mini A4"));
    Serial.println(F("     - Continuity from AHT10 SCL pad to Pro Mini A5"));
    Serial.println(F("  4. Some AHT10 modules need external 10k pullups:"));
    Serial.println(F("     - 10k from SDA to VCC"));
    Serial.println(F("     - 10k from SCL to VCC"));
    Serial.println(F("  5. Try different I2C speed (below)"));
  }
}

void setup() {
  Serial.begin(9600);
  delay(2000);

  Serial.println();
  Serial.println(F("=== TEST 03b: AHT10 DIRECT (no MOSFET) ==="));
  Serial.println(F("AHT10 powered from VCC, not MOSFET drain"));
  Serial.println(F("============================================"));
  Serial.println();

  // Standard speed I2C (100kHz)
  Wire.begin();
  delay(500);  // Give AHT10 plenty of time

  Serial.println(F("--- Standard I2C (100kHz) ---"));
  i2cScan();
  Serial.println();

  // Try slower I2C in case of long wires or no pullups
  Wire.setClock(50000);  // 50kHz
  delay(100);
  Serial.println(F("--- Slow I2C (50kHz) ---"));
  i2cScan();
  Serial.println();

  // Reset back to 100kHz
  Wire.setClock(100000);

  // Try AHT10 init
  Serial.print(F("aht.begin()... "));
  bool ok = aht.begin();
  if (ok) {
    Serial.println(F("OK!"));
  } else {
    Serial.println(F("FAIL"));
    Serial.println(F("\nIf scan also found nothing:"));
    Serial.println(F("  -> Wiring issue (SDA/SCL/GND)"));
    Serial.println(F("  -> Dead AHT10 module"));
    Serial.println(F("  -> Try adding 10k pullups to SDA & SCL"));
    Serial.println(F("\nIf scan found 0x38 but begin() fails:"));
    Serial.println(F("  -> Library version issue"));
    Serial.println(F("  -> Try: Adafruit_AHTX0 v2.0+"));
  }
  Serial.println();
}

void loop() {
  Serial.println(F("--- Reading ---"));

  // Scan every loop so you can wiggle wires and see if it appears
  i2cScan();

  bool ok = aht.begin();
  if (ok) {
    sensors_event_t humidity, temperature;
    aht.getEvent(&humidity, &temperature);
    Serial.print(F("T="));
    Serial.print(temperature.temperature, 1);
    Serial.print(F("C  H="));
    Serial.print(humidity.relative_humidity, 1);
    Serial.println(F("%"));
  } else {
    Serial.println(F("aht.begin() FAIL"));
  }

  Serial.println();
  delay(3000);
}
