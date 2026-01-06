// ============================================================
// BEEHIVE SENSOR NODE - ESP32-C3 SuperMini + AHT10 + HX711 + RFM95
// Sends JSON via LoRa with DEEP SLEEP for power conservation
// ============================================================

#include <Wire.h>
#include <Adafruit_AHTX0.h>
#include <SPI.h>
#include <RH_RF95.h>
#include "HX711.h"
#include "esp_sleep.h"
#include "driver/rtc_io.h"

// ===== I2C (AHT10) =====
#define SDA_PIN 8
#define SCL_PIN 9

// ===== HX711 (Load Cell) =====
#define HX_DOUT 3
#define HX_SCK  1

// ===== RFM95 (LoRa) =====
#define RFM95_CS   7
#define RFM95_RST  10
#define RFM95_INT  2   // DIO0
#define RFM95_FREQ 868.0

// ===== Battery Voltage (ADC) =====
#define BATTERY_PIN 0  // GPIO0 for battery voltage measurement
// Voltage divider: calibrated from actual measurement
// Measured: 4.13V actual, 4.19V reported → ratio adjusted
#define VOLTAGE_DIVIDER_RATIO 2.92  // Calibrated (was 2.96)
#define ADC_REFERENCE_VOLTAGE 3.3
#define ADC_RESOLUTION 4095.0

// ===== Config =====
#define SLEEP_DURATION_US 900000000  // 15 minutes in microseconds (deep sleep)
#define CALIBRATION_FACTOR 20.4883  // Calibrated from calibration_v2
#define DEFAULT_TARE_OFFSET 16805   // Empty rails (no tray)

// ===== Objects =====
Adafruit_AHTX0 aht;
RH_RF95 rf95(RFM95_CS, RFM95_INT);
HX711 scale;

// Store counter in RTC memory to persist across deep sleep
RTC_DATA_ATTR uint32_t counter = 0;
RTC_DATA_ATTR long zeroOffset = DEFAULT_TARE_OFFSET;  // Use calibrated offset

void setup() {
  Serial.begin(115200);
  delay(1000);  // Shorter delay for faster wake-up
  
  // Check wake-up reason
  esp_sleep_wakeup_cause_t wakeup_reason = esp_sleep_get_wakeup_cause();
  if (wakeup_reason == ESP_SLEEP_WAKEUP_TIMER) {
    Serial.println("\n=== WAKE FROM DEEP SLEEP ===");
  } else {
    Serial.println("\n=== BEEHIVE SENSOR NODE (DEEP SLEEP) ===");
  }

  // --- Configure Battery ADC ---
  analogReadResolution(12);  // 12-bit resolution (0-4095)
  analogSetAttenuation(ADC_11db);  // Full range 0-3.3V
  pinMode(BATTERY_PIN, INPUT);

  // --- I2C / AHT10 ---
  Wire.begin(SDA_PIN, SCL_PIN);
  if (!aht.begin()) {
    Serial.println("ERROR: AHT10 not found");
    // Don't hang - send error data and sleep
    sendErrorAndSleep();
    return;
  }
  Serial.println("AHT10 OK");

  // --- HX711 ---
  scale.begin(HX_DOUT, HX_SCK);
  Serial.print("HX711 init");
  unsigned long start = millis();
  while (!scale.is_ready() && millis() - start < 3000) {
    Serial.print(".");
    delay(100);
  }
  if (scale.is_ready()) {
    Serial.println(" OK");
    Serial.print("Using tare offset: ");
    Serial.println(zeroOffset);
  } else {
    Serial.println(" NOT READY");
  }

  // --- RFM95 ---
  pinMode(RFM95_RST, OUTPUT);
  digitalWrite(RFM95_RST, HIGH);
  delay(10);
  digitalWrite(RFM95_RST, LOW);
  delay(10);
  digitalWrite(RFM95_RST, HIGH);
  delay(10);

  if (!rf95.init()) {
    Serial.println("ERROR: RFM95 init failed");
    // Don't hang - try again after sleep
    goToDeepSleep();
    return;
  }
  rf95.setFrequency(RFM95_FREQ);
  rf95.setTxPower(14, false);
  Serial.println("RFM95 OK @ 868 MHz");
  Serial.println("===========================\n");
}

// Read battery voltage from ADC
float readBatteryVoltage() {
  // Take multiple readings and average for stability
  uint32_t sum = 0;
  const int samples = 10;
  
  for (int i = 0; i < samples; i++) {
    sum += analogRead(BATTERY_PIN);
    delay(5);
  }
  
  float avgReading = (float)sum / samples;
  
  // Convert ADC reading to voltage
  float voltage = (avgReading / ADC_RESOLUTION) * ADC_REFERENCE_VOLTAGE;
  
  // Apply voltage divider ratio to get actual battery voltage
  voltage *= VOLTAGE_DIVIDER_RATIO;
  
  return voltage;
}

// Calculate battery percentage (for typical LiPo: 3.0V=0%, 4.2V=100%)
int calculateBatteryPercent(float voltage) {
  const float minVoltage = 3.0;  // Empty LiPo
  const float maxVoltage = 4.2;  // Full LiPo
  
  if (voltage <= minVoltage) return 0;
  if (voltage >= maxVoltage) return 100;
  
  return (int)(((voltage - minVoltage) / (maxVoltage - minVoltage)) * 100);
}

// Put RFM95 into sleep mode before deep sleep
void rfm95Sleep() {
  // Put radio into sleep mode (0x00 = sleep mode)
  rf95.sleep();
}

// Enter deep sleep mode
void goToDeepSleep() {
  Serial.println("Entering deep sleep...");
  Serial.flush();  // Ensure all serial data is sent
  
  // Put RFM95 into sleep mode
  rfm95Sleep();
  
  // Power down HX711
  scale.power_down();
  
  // Configure wake-up timer
  esp_sleep_enable_timer_wakeup(SLEEP_DURATION_US);
  
  // Enter deep sleep
  esp_deep_sleep_start();
}

// Send error payload and sleep (for sensor failures)
void sendErrorAndSleep() {
  float battVoltage = readBatteryVoltage();
  int battPercent = calculateBatteryPercent(battVoltage);
  
  char payload[64];
  snprintf(payload, sizeof(payload),
           "{\"err\":1,\"bv\":%.2f,\"bp\":%d,\"n\":%lu}",
           battVoltage, battPercent, counter++);
  
  Serial.print("TX (error): ");
  Serial.println(payload);
  
  // Try to send if radio was initialized
  if (rf95.init()) {
    rf95.setFrequency(RFM95_FREQ);
    rf95.setTxPower(14, false);
    rf95.send((uint8_t*)payload, strlen(payload));
    rf95.waitPacketSent();
  }
  
  goToDeepSleep();
}

void loop() {
  // Read AHT10
  sensors_event_t humidity, temperature;
  aht.getEvent(&humidity, &temperature);
  float t = temperature.temperature;
  float h = humidity.relative_humidity;

  // Read HX711
  long raw = 0;
  float w = 0.0;
  bool hxOk = false;
  
  if (scale.is_ready()) {
    raw = scale.read_average(10);  // 10 samples for better accuracy (~1 second)
    // Subtract zero offset, then divide by calibration factor to get grams
    float grams = (float)(raw - zeroOffset) / CALIBRATION_FACTOR;
    // Convert to kg for dashboard/API
    w = grams / 1000.0;
    if (w < 0) w = 0;
    if (w > 200) w = 200;  // Max 200kg for a beehive
    hxOk = true;
    
    Serial.print("Raw: ");
    Serial.print(raw);
    Serial.print(" Offset: ");
    Serial.print(zeroOffset);
    Serial.print(" Weight: ");
    Serial.print(grams, 1);
    Serial.print("g (");
    Serial.print(w, 3);
    Serial.println("kg)");
  }

  // Read Battery Voltage
  float battVoltage = readBatteryVoltage();
  int battPercent = calculateBatteryPercent(battVoltage);

  // Build compact JSON payload
  // Format: {"t":21.5,"h":55.3,"w":45.12,"bv":3.85,"bp":71,"n":42}
  // t=temperature, h=humidity, w=weight, bv=battery voltage, bp=battery percent, n=counter
  char payload[96];
  snprintf(payload, sizeof(payload),
           "{\"t\":%.1f,\"h\":%.1f,\"w\":%.2f,\"bv\":%.2f,\"bp\":%d,\"n\":%lu}",
           t, h, w, battVoltage, battPercent, counter++);

  Serial.print("TX: ");
  Serial.println(payload);
  Serial.printf("Battery: %.2fV (%d%%)\n", battVoltage, battPercent);

  // Send via LoRa
  rf95.send((uint8_t*)payload, strlen(payload));
  rf95.waitPacketSent();

  // Enter deep sleep instead of delay
  goToDeepSleep();
  
  // This line will never be reached - after deep sleep, ESP32 restarts from setup()
}
