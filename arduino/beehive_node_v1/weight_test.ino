/*
 * Simple Weight Display Test
 * Uses calibration values from calibration_v2
 */

#include <HX711.h>

#define HX711_DOUT 3
#define HX711_SCK  1

// Calibration values from calibration_v2
#define CALIBRATION_FACTOR 20.4883
#define TARE_OFFSET 45256

HX711 scale;

void setup() {
  Serial.begin(115200);
  delay(2000);
  
  Serial.println("\n=== Weight Test ===\n");
  
  // Power cycle HX711
  pinMode(HX711_SCK, OUTPUT);
  digitalWrite(HX711_SCK, HIGH);
  delay(100);
  digitalWrite(HX711_SCK, LOW);
  delay(100);
  
  scale.begin(HX711_DOUT, HX711_SCK);
  scale.set_gain(128);
  
  // Wait for ready
  Serial.print("Waiting for HX711");
  while (!scale.is_ready()) {
    Serial.print(".");
    delay(100);
  }
  Serial.println(" Ready!\n");
  
  Serial.println("Press 't' to tare (set current weight as zero)");
  Serial.println("Press 'r' to reset to saved tare offset\n");
  Serial.println("────────────────────────────────");
}

long currentOffset = TARE_OFFSET;

void loop() {
  // Check for commands
  if (Serial.available()) {
    char c = Serial.read();
    if (c == 't' || c == 'T') {
      // Tare - set current reading as zero
      long raw = scale.read();
      currentOffset = raw;
      Serial.println("\n>>> TARED! <<<\n");
    } else if (c == 'r' || c == 'R') {
      currentOffset = TARE_OFFSET;
      Serial.println("\n>>> Reset to saved offset <<<\n");
    }
  }
  
  if (scale.is_ready()) {
    long raw = scale.read();
    float grams = (raw - currentOffset) / CALIBRATION_FACTOR;
    
    // Display
    Serial.print("Weight: ");
    
    if (grams >= 1000) {
      Serial.print(grams / 1000.0, 3);
      Serial.print(" kg");
    } else {
      Serial.print(grams, 1);
      Serial.print(" g");
    }
    
    Serial.print("  (raw: ");
    Serial.print(raw);
    Serial.println(")");
  }
  
  delay(500);
}
