// ============================================================
// BEEHIVE GATEWAY - ESP32-C3 SuperMini + RFM95 + WiFi
// Receives JSON via LoRa and POSTs to /api/sensor
// ============================================================

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <SPI.h>
#include <RH_RF95.h>


// ===== CONFIG - EDIT THESE =====
const char* WIFI_SSID     = "T-A81MJA";
const char* WIFI_PASS     = "t2lmlakb8kbv";
const char* SERVER_HOST   = "ebeehive.vercel.app";
const char* HIVE_ID       = "HIVE-099";
const char* API_KEY       = "09493c5e9d61082e98a902a89bd32a8f";  // Get from hive settings in app

// Encryption disabled (node uses WDT for sleep, conflicts with Crypto library)

// ===== RFM95 (LoRa) Pins =====
// Updated for new wiring: MISO-5, MOSI-6, NSS-10, SCK-20, RESET-21
// DIO0/INT unchanged at 3 (update if needed)
#define RFM95_SCK  20  // New: Custom SCK
#define RFM95_MISO 5   // New: Custom MISO
#define RFM95_MOSI 6   // New: Custom MOSI
#define RFM95_CS   10  // New: NSS/CS (was 7)
#define RFM95_RST  21  // New: RESET (was 10)
#define RFM95_INT  3   // DIO0 - GPIO3 for gateway
#define RFM95_FREQ 868.0

RH_RF95 rf95(RFM95_CS, RFM95_INT);

// ===== WiFi =====
void connectWiFi() {
  if (WiFi.isConnected()) return;
  
  Serial.print("WiFi: ");
  Serial.println(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    if (millis() - start > 20000) {
      Serial.println("\nTimeout! Restarting...");
      ESP.restart();
    }
  }
  Serial.print("\nIP: ");
  Serial.println(WiFi.localIP());
}

// ===== POST to server =====
void postReading(const char* nodeJson, int rssi) {
  if (WiFi.status() != WL_CONNECTED) connectWiFi();

  WiFiClientSecure client;
  client.setInsecure(); // Skip cert verification

  HTTPClient https;
  String url = String("https://") + SERVER_HOST + "/api/sensor";

  if (!https.begin(client, url)) {
    Serial.println("HTTPS begin failed");
    return;
  }

  https.addHeader("Content-Type", "application/json");
  if (strlen(API_KEY) > 0) {
    https.addHeader("x-api-key", API_KEY);
  }

  // Parse node JSON to extract values
  // Expected: {"t":21.5,"h":55.3,"w":45.12,"bv":3.85,"bp":71,"n":42}
  float t = 0, h = 0, w = 0, bv = 0;
  int bp = 0;
  long n = 0;
  
  // Parse temperature, humidity, weight
  sscanf(nodeJson, "{\"t\":%f,\"h\":%f,\"w\":%f", &t, &h, &w);
  
  // Parse battery voltage (bv) and battery percent (bp)
  char* bvPtr = strstr(nodeJson, "\"bv\":");
  if (bvPtr) {
    sscanf(bvPtr, "\"bv\":%f", &bv);
  }
  
  char* bpPtr = strstr(nodeJson, "\"bp\":");
  if (bpPtr) {
    sscanf(bpPtr, "\"bp\":%d", &bp);
  }
  
  // Parse counter (n)
  char* nPtr = strstr(nodeJson, "\"n\":");
  if (nPtr) {
    sscanf(nPtr, "\"n\":%ld", &n);
  }

  // Build full JSON for API
  char json[320];
  snprintf(json, sizeof(json),
    "{"
    "\"hiveId\":\"%s\","
    "\"temperature\":%.2f,"
    "\"humidity\":%.1f,"
    "\"weight\":%.2f,"
    "\"battery\":%d,"
    "\"metadata\":{"
      "\"source\":\"LoRa\","
      "\"rssi\":%d,"
      "\"counter\":%ld,"
      "\"batteryVoltage\":%.2f"
    "}"
    "}",
    HIVE_ID, t, h, w, bp, rssi, n, bv
  );

  Serial.print("POST: ");
  Serial.println(json);

  int code = https.POST(json);
  Serial.print("HTTP ");
  Serial.println(code);

  if (code > 0) {
    Serial.println(https.getString());
  }

  https.end();
}

void setup() {
  Serial.begin(115200);
  delay(2000);
  Serial.println("\n=== BEEHIVE GATEWAY ===");

  // --- RFM95 ---
  pinMode(RFM95_RST, OUTPUT);
  digitalWrite(RFM95_RST, HIGH);
  delay(10);
  digitalWrite(RFM95_RST, LOW);
  delay(10);
  digitalWrite(RFM95_RST, HIGH);
  delay(10);

  // New: Initialize SPI with custom pins before rf95.init()
  SPI.begin(RFM95_SCK, RFM95_MISO, RFM95_MOSI, RFM95_CS);

  if (!rf95.init()) {
    Serial.println("ERROR: RFM95 init failed");
    while (1) delay(1000);
  }
  rf95.setFrequency(RFM95_FREQ);
  rf95.setTxPower(14, false);

  Serial.println("RFM95 OK @ 868 MHz");

  // --- WiFi ---
  connectWiFi();

  Serial.println("Listening...\n");
}

void loop() {
  if (rf95.available()) {
    uint8_t buf[RH_RF95_MAX_MESSAGE_LEN];
    uint8_t len = sizeof(buf);

    if (rf95.recv(buf, &len)) {
      buf[len] = '\0';
      int rssi = rf95.lastRssi();

      Serial.print("RX [");
      Serial.print(rssi);
      Serial.print(" dBm]: ");
      Serial.println((char*)buf);

      // Validate it looks like JSON
      if (buf[0] == '{') {
        postReading((char*)buf, rssi);
      } else {
        Serial.println("Not JSON, skipping");
      }
    }
  }
  delay(10);
}