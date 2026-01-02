// ============================================================
// BEEHIVE GATEWAY - ESP32-C3 SuperMini + RFM95 + WiFi
// Receives raw LoRa packets and POSTs to /api/sensor
// ============================================================

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <SPI.h>
#include <RH_RF95.h>

// ===== WiFi + Server Config =====
const char* WIFI_SSID = "T-A81MJA";
const char* WIFI_PASS = "t2lmlakb8kbv";
const char* SERVER_HOST = "ebeehive.vercel.app";
const char* HIVE_ID = "HIVE-017";
const char* ESP32_API_KEY = ""; // leave empty if server has no key configured

// ===== RFM95 (LoRa) - GATEWAY PINOUT =====
#define RFM95_CS   7
#define RFM95_RST  10
#define RFM95_INT  3   // DIO0 on GPIO3 for gateway!
#define RFM95_FREQ 868.0

RH_RF95 rf95(RFM95_CS, RFM95_INT);

// ===== Helpers =====
void connectWiFi() {
  if (WiFi.isConnected()) return;
  Serial.print("WiFi connecting to ");
  Serial.println(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    if (millis() - start > 20000) {
      Serial.println("\nWiFi timeout, restarting...");
      ESP.restart();
    }
  }
  Serial.print("\nWiFi connected, IP: ");
  Serial.println(WiFi.localIP());
}

// Parse payload: "T=21.50C H=55.3% W=45.123 R=18951234 X=1 #42"
bool parsePayload(const char* payload, float &temp, float &hum, float &weight, long &raw, bool &hxOk, long &cnt) {
  // Defaults
  temp = 0; hum = 0; weight = 0; raw = 0; hxOk = false; cnt = 0;

  const char* p;

  // T=
  p = strstr(payload, "T=");
  if (p) temp = atof(p + 2);

  // H=
  p = strstr(payload, "H=");
  if (p) hum = atof(p + 2);

  // W=
  p = strstr(payload, "W=");
  if (p) weight = atof(p + 2);

  // R=
  p = strstr(payload, "R=");
  if (p) raw = atol(p + 2);

  // X=
  p = strstr(payload, "X=");
  if (p) hxOk = (atoi(p + 2) != 0);

  // #
  p = strstr(payload, "#");
  if (p) cnt = atol(p + 1);

  // Basic validity check
  return (temp > -50 && temp < 100 && hum >= 0 && hum <= 100);
}

void postReading(float temp, float hum, float weight, long raw, bool hxOk, long cnt, int rssi) {
  if (WiFi.status() != WL_CONNECTED) connectWiFi();

  WiFiClientSecure client;
  client.setInsecure(); // Accept any cert (OK for testing)

  HTTPClient https;
  String url = String("https://") + SERVER_HOST + "/api/sensor?hiveId=" + HIVE_ID;

  Serial.print("POST to: ");
  Serial.println(url);

  if (!https.begin(client, url)) {
    Serial.println("HTTPS begin failed");
    return;
  }

  https.addHeader("Content-Type", "application/json");
  if (strlen(ESP32_API_KEY) > 0) {
    https.addHeader("x-api-key", ESP32_API_KEY);
  }

  // Build JSON
  // Clamp weight to valid range 0-500
  if (weight < 0) weight = 0;
  if (weight > 500) weight = 500;

  String json = "{";
  json += "\"temperature\":" + String(temp, 2) + ",";
  json += "\"humidity\":" + String(hum, 1) + ",";
  json += "\"weight\":" + String(weight, 3) + ",";
  json += "\"battery\":100,"; // no battery sensor on node currently
  json += "\"hiveId\":\"" + String(HIVE_ID) + "\",";
  json += "\"metadata\":{";
  json += "\"source\":\"LoRa\",";
  json += "\"gateway\":\"ESP32-C3\",";
  json += "\"rssi\":" + String(rssi) + ",";
  json += "\"raw_weight\":" + String(raw) + ",";
  json += "\"hx_ok\":" + String(hxOk ? "true" : "false") + ",";
  json += "\"counter\":" + String(cnt);
  json += "}}";

  Serial.println("JSON: " + json);

  int httpCode = https.POST(json);
  Serial.print("HTTP code: ");
  Serial.println(httpCode);

  if (httpCode > 0) {
    String resp = https.getString();
    Serial.println("Response: " + resp);
  } else {
    Serial.println("POST error: " + https.errorToString(httpCode));
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

  if (!rf95.init()) {
    Serial.println("ERROR: RFM95 init failed");
    while (1) delay(1000);
  }
  rf95.setFrequency(RFM95_FREQ);
  rf95.setTxPower(14, false);
  Serial.println("RFM95 OK @ 868 MHz");

  // --- WiFi ---
  connectWiFi();

  Serial.println("=========================\n");
  Serial.println("Listening for LoRa packets...");
}

void loop() {
  if (rf95.available()) {
    uint8_t buf[RH_RF95_MAX_MESSAGE_LEN];
    uint8_t len = sizeof(buf);

    if (rf95.recv(buf, &len)) {
      buf[len] = '\0'; // null-terminate
      int rssi = rf95.lastRssi();

      Serial.print("RX [RSSI ");
      Serial.print(rssi);
      Serial.print("]: ");
      Serial.println((char*)buf);

      // Parse and post
      float temp, hum, weight;
      long raw, cnt;
      bool hxOk;

      if (parsePayload((char*)buf, temp, hum, weight, raw, hxOk, cnt)) {
        postReading(temp, hum, weight, raw, hxOk, cnt, rssi);
      } else {
        Serial.println("Parse failed, skipping POST");
      }
    }
  }

  delay(10);
}