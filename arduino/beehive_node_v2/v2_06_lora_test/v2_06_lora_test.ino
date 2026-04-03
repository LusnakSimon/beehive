// ============================================================
// TEST 06: RFM95 LORA RADIO TEST
// Arduino Pro Mini 3.3V/8MHz + RFM95 868MHz
//
// PURPOSE: Verify RFM95 init, config, and TX
//          RFM95 is powered DIRECTLY from VBAT (not via MOSFET)
// SETUP:   RFM95 wired to hardware SPI + control pins
//          CS→D10, RST→D9, DIO0→D2
//          SCK→D13, MISO→D12, MOSI→D11
//
// Run the existing gateway to verify packets are received
// ============================================================

#include <SPI.h>
#include <RH_RF95.h>

#define RFM95_CS   10
#define RFM95_RST  9
#define RFM95_INT  2   // DIO0 → INT0
#define RFM95_FREQ 868.0

RH_RF95 rf95(RFM95_CS, RFM95_INT);

uint32_t counter = 0;

void setup() {
  Serial.begin(9600);
  delay(1000);

  Serial.println();
  Serial.println(F("=== TEST 06: RFM95 LORA RADIO ==="));
  Serial.println(F("CS=D10 RST=D9 DIO0=D2 @ 868MHz"));
  Serial.println(F("================================="));
  Serial.println();

  // Hardware reset
  pinMode(RFM95_RST, OUTPUT);
  digitalWrite(RFM95_RST, HIGH);
  delay(10);
  digitalWrite(RFM95_RST, LOW);
  delay(10);
  digitalWrite(RFM95_RST, HIGH);
  delay(10);

  // Init
  Serial.print(F("RFM95 init... "));
  if (!rf95.init()) {
    Serial.println(F("FAIL"));
    Serial.println(F("  Check wiring:"));
    Serial.println(F("    CS→D10, RST→D9, DIO0→D2"));
    Serial.println(F("    SCK→D13, MISO→D12, MOSI→D11"));
    Serial.println(F("    VCC→3.3V (direct, NOT via MOSFET)"));
    Serial.println(F("    GND→GND"));
    Serial.println(F("    Antenna connected!"));
    while (1);
  }
  Serial.println(F("OK"));

  // Set frequency
  if (!rf95.setFrequency(RFM95_FREQ)) {
    Serial.println(F("Frequency set FAIL"));
    while (1);
  }
  Serial.print(F("Frequency: "));
  Serial.print(RFM95_FREQ, 1);
  Serial.println(F(" MHz"));

  // Set TX power (14 dBm, PA_BOOST)
  rf95.setTxPower(14, false);
  Serial.println(F("TX power: 14 dBm"));

  Serial.println();
  Serial.println(F("Sending test packets every 5 seconds..."));
  Serial.println(F("Check gateway serial output for reception"));
  Serial.println();
}

void loop() {
  // Build test payload (similar format to v1 node)
  char payload[64];
  snprintf(payload, sizeof(payload),
           "{\"test\":true,\"n\":%lu,\"msg\":\"hello\"}", counter++);

  Serial.print(F("TX #"));
  Serial.print(counter - 1);
  Serial.print(F(": "));
  Serial.print(payload);
  Serial.print(F(" ("));
  Serial.print(strlen(payload));
  Serial.print(F(" bytes)... "));

  // Send
  unsigned long txStart = millis();
  rf95.send((uint8_t*)payload, strlen(payload));
  rf95.waitPacketSent();
  unsigned long txTime = millis() - txStart;

  Serial.print(F("done ("));
  Serial.print(txTime);
  Serial.println(F("ms)"));

  // Listen briefly for any response (optional)
  Serial.print(F("  Listening 2s... "));
  unsigned long listenStart = millis();
  while (millis() - listenStart < 2000) {
    if (rf95.available()) {
      uint8_t buf[64];
      uint8_t len = sizeof(buf);
      if (rf95.recv(buf, &len)) {
        buf[len] = 0;
        Serial.print(F("RX: "));
        Serial.print((char*)buf);
        Serial.print(F(" RSSI="));
        Serial.println(rf95.lastRssi());
      }
    }
  }
  Serial.println(F("done"));
  Serial.println();

  delay(3000);
}
