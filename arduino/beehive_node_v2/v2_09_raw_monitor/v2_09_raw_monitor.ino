// ============================================================
// HX711 RAW VALUE MONITOR
// Simple continuous raw reading display
// ============================================================

#include "HX711.h"

#define MOSFET_PIN 4
#define HX_DOUT    5
#define HX_SCK     6

HX711 scale;

void setup() {
  Serial.begin(9600);
  delay(1000);

  pinMode(MOSFET_PIN, OUTPUT);
  digitalWrite(MOSFET_PIN, LOW);  // Sensors ON
  delay(500);

  scale.begin(HX_DOUT, HX_SCK);
  
  Serial.println(F("=== HX711 RAW MONITOR ==="));
  Serial.print(F("Initializing"));
  
  unsigned long start = millis();
  while (!scale.is_ready() && millis() - start < 5000) {
    Serial.print('.');
    delay(100);
  }
  
  if (scale.is_ready()) {
    Serial.println(F(" OK"));
  } else {
    Serial.println(F(" FAILED"));
    Serial.println(F("Check wiring."));
  }
  
  Serial.println(F("Printing raw values (10 Hz):"));
  Serial.println();
}

void loop() {
  if (scale.is_ready()) {
    long raw = scale.read();
    Serial.println(raw);
  } else {
    Serial.println(F("Not ready"));
  }
  
  delay(100);
}
