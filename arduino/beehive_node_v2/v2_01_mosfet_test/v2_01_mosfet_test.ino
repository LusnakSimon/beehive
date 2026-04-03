// ============================================================
// TEST 01: MOSFET POWER SWITCH TEST
// Arduino Pro Mini 3.3V/8MHz + A1SHB P-channel MOSFET
//
// PURPOSE: Verify MOSFET switches sensor power rail on/off
// SETUP:   Only MCU + MOSFET connected (no sensors yet)
//          Multimeter on MOSFET drain (sensor VCC rail) to GND
//          Or LED + 330Ω from drain to GND for visual feedback
//
// A1SHB SOT-23 WIRING (verify YOUR part's datasheet!):
//   Most common pinout (top view, marking up):
//     Pin 1 (Gate)   → D4 + 10k pullup to VBAT
//     Pin 2 (Source)  → VBAT
//     Pin 3 (Drain)   → Sensor VCC rail (or LED+resistor for test)
//
//   To verify pins with multimeter (diode mode):
//     Source→Drain: ~0.4-0.7V (body diode forward)
//     Drain→Source: OL (open)
//     Gate to either: OL (open both ways)
//
// EXPECTED:
//   ON  → drain voltage ≈ VBAT (3.0–3.4V)
//   OFF → drain voltage ≈ 0V
// ============================================================

#define MOSFET_PIN 4  // P-FET gate: LOW = ON, HIGH = OFF

void setup() {
  Serial.begin(9600);
  delay(1000);

  Serial.println();
  Serial.println(F("=== TEST 01: MOSFET POWER SWITCH ==="));
  Serial.println(F("Pin D4 -> MOSFET gate"));
  Serial.println(F("LOW  = sensors ON  (Vgs negative)"));
  Serial.println(F("HIGH = sensors OFF (Vgs = 0)"));
  Serial.println(F("===================================="));
  Serial.println();

  // Start with MOSFET OFF (sensors unpowered)
  pinMode(MOSFET_PIN, OUTPUT);
  digitalWrite(MOSFET_PIN, HIGH);  // OFF
  Serial.println(F("Initial state: OFF"));
  Serial.println(F("Measure drain pin with multimeter - should be ~0V"));
  Serial.println();

  delay(3000);
}

void loop() {
  // --- Turn ON ---
  Serial.println(F(">>> MOSFET ON (sensors powered)"));
  Serial.println(F("    Drain should read ~VBAT (3.0-3.4V)"));
  digitalWrite(MOSFET_PIN, LOW);  // P-FET: LOW = ON
  delay(5000);

  // --- Turn OFF ---
  Serial.println(F(">>> MOSFET OFF (sensors unpowered)"));
  Serial.println(F("    Drain should read ~0V"));
  digitalWrite(MOSFET_PIN, HIGH);  // P-FET: HIGH = OFF
  delay(5000);

  Serial.println(F("--- cycle ---"));
  Serial.println();
}
