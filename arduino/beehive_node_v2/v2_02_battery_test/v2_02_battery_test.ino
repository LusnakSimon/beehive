// ============================================================
// TEST 02: BATTERY VOLTAGE SENSING
// Arduino Pro Mini 3.3V/8MHz + 54k/20k voltage divider
//
// PURPOSE: Verify ADC reads correct LiFePO4 battery voltage
// SETUP:   54k from VBAT to A0, 20k from A0 to GND
//          Measure VBAT with multimeter to compare
//
// Uses internal 1.1V reference for better resolution
// Divider ratio: (54k+20k)/20k = 3.7
// Resolution: ~3.97mV per ADC step
// ============================================================

#define VBAT_PIN A0

// Voltage divider: 54k top, 20k bottom
// Vout = Vbat * R2/(R1+R2) = Vbat * 20/74
// Vbat = Vout * (R1+R2)/R2 = Vout * 3.7
const float DIVIDER_RATIO = 3.7;   // (54+20)/20
const float VREF = 1.1;            // Internal 1.1V reference

// LiFePO4 voltage lookup table for battery %
// LiFePO4 has a very flat discharge curve
struct VoltagePoint {
  float voltage;
  uint8_t percent;
};

const VoltagePoint LIPO4_TABLE[] = {
  {3.40, 100},
  {3.35,  90},
  {3.33,  80},
  {3.30,  60},
  {3.25,  40},
  {3.20,  20},
  {3.10,  10},
  {2.80,   0}
};
const int TABLE_SIZE = sizeof(LIPO4_TABLE) / sizeof(LIPO4_TABLE[0]);

float readBatteryVoltage() {
  // Take 16 samples and average for noise reduction
  uint32_t sum = 0;
  for (int i = 0; i < 16; i++) {
    sum += analogRead(VBAT_PIN);
    delay(2);
  }
  float avg = (float)sum / 16.0;

  // Convert: Vout = (ADC / 1024) * VREF, then Vbat = Vout * ratio
  float voltage = (avg / 1024.0) * VREF * DIVIDER_RATIO;
  return voltage;
}

int batteryPercent(float voltage) {
  if (voltage >= LIPO4_TABLE[0].voltage) return 100;
  if (voltage <= LIPO4_TABLE[TABLE_SIZE - 1].voltage) return 0;

  // Linear interpolation between table points
  for (int i = 0; i < TABLE_SIZE - 1; i++) {
    if (voltage >= LIPO4_TABLE[i + 1].voltage) {
      float range_v = LIPO4_TABLE[i].voltage - LIPO4_TABLE[i + 1].voltage;
      float range_p = LIPO4_TABLE[i].percent - LIPO4_TABLE[i + 1].percent;
      float offset = voltage - LIPO4_TABLE[i + 1].voltage;
      return LIPO4_TABLE[i + 1].percent + (int)((offset / range_v) * range_p);
    }
  }
  return 0;
}

void setup() {
  Serial.begin(9600);
  delay(1000);

  // Use internal 1.1V reference for better ADC resolution
  analogReference(INTERNAL);

  // Discard first few readings after reference change
  for (int i = 0; i < 10; i++) {
    analogRead(VBAT_PIN);
    delay(5);
  }

  Serial.println();
  Serial.println(F("=== TEST 02: BATTERY VOLTAGE SENSING ==="));
  Serial.println(F("Divider: 54k/20k  Ratio: 3.7"));
  Serial.println(F("ADC ref: internal 1.1V"));
  Serial.println(F("Compare readings with multimeter on VBAT"));
  Serial.println(F("========================================"));
  Serial.println();
}

void loop() {
  uint32_t raw_sum = 0;
  for (int i = 0; i < 16; i++) {
    raw_sum += analogRead(VBAT_PIN);
    delay(2);
  }
  float raw_avg = (float)raw_sum / 16.0;

  float vbat = readBatteryVoltage();
  int pct = batteryPercent(vbat);

  Serial.print(F("ADC raw avg: "));
  Serial.print(raw_avg, 1);
  Serial.print(F("  VBAT: "));
  Serial.print(vbat, 3);
  Serial.print(F("V  Battery: "));
  Serial.print(pct);
  Serial.println(F("%"));

  // Helpful: show what the ADC pin voltage is (before divider ratio)
  float v_adc = (raw_avg / 1024.0) * VREF;
  Serial.print(F("  (ADC pin voltage: "));
  Serial.print(v_adc, 4);
  Serial.println(F("V)"));

  // Warn if readings look off
  if (vbat < 2.5 || vbat > 4.0) {
    Serial.println(F("  WARNING: voltage out of LiFePO4 range (2.5-3.65V)"));
    Serial.println(F("  Check divider wiring or adjust DIVIDER_RATIO"));
  }

  Serial.println();
  delay(2000);
}
