/*
 * Beehive Monitor - ESP32-C3
 * Monitorovanie úľa s odosielaním dát na server
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <DHT.h>
#include <HX711.h>

// WiFi credentials
const char* ssid = "VASA_WIFI_SIET";
const char* password = "VASE_HESLO";

// Server endpoint
const char* serverUrl = "http://your-server.com/api/esp32/data";
const char* apiKey = "beehive-secret-key-2024";

// DHT22 senzor (teplota, vlhkosť)
#define DHT_PIN 4
#define DHT_TYPE DHT22
DHT dht(DHT_PIN, DHT_TYPE);

// HX711 (váha)
#define HX711_DOUT_PIN 5
#define HX711_SCK_PIN 6
HX711 scale;

// Nastavenia
#define HIVE_ID "HIVE-001"
#define MEASUREMENT_INTERVAL 300000  // 5 minút (300000 ms)
#define CALIBRATION_FACTOR -7050.0   // Kalibračný faktor pre váhu

unsigned long lastMeasurement = 0;

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("🐝 Beehive Monitor - ESP32-C3");
  
  // Inicializácia senzorov
  dht.begin();
  scale.begin(HX711_DOUT_PIN, HX711_SCK_PIN);
  scale.set_scale(CALIBRATION_FACTOR);
  scale.tare();  // Reset váhy
  
  Serial.println("✅ Senzory inicializované");
  
  // Pripojenie na WiFi
  connectWiFi();
}

void loop() {
  unsigned long currentMillis = millis();
  
  // Kontrola WiFi pripojenia
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("⚠️ WiFi odpojená, reconnect...");
    connectWiFi();
  }
  
  // Meranie každých 5 minút
  if (currentMillis - lastMeasurement >= MEASUREMENT_INTERVAL) {
    lastMeasurement = currentMillis;
    
    // Načítanie dát zo senzorov
    float temperature = dht.readTemperature();
    float humidity = dht.readHumidity();
    float weight = scale.get_units(10);  // Priemer z 10 meraní
    int battery = getBatteryLevel();
    
    // Validácia dát
    if (isnan(temperature) || isnan(humidity)) {
      Serial.println("❌ Chyba pri čítaní DHT22!");
      return;
    }
    
    // Výpis na sériový port
    Serial.println("\n📊 Nové meranie:");
    Serial.printf("  Teplota: %.1f°C\n", temperature);
    Serial.printf("  Vlhkosť: %.1f%%\n", humidity);
    Serial.printf("  Hmotnosť: %.2f kg\n", weight);
    Serial.printf("  Batéria: %d%%\n", battery);
    
    // Odoslanie na server
    sendDataToServer(temperature, humidity, weight, battery);
  }
  
  delay(1000);
}

void connectWiFi() {
  Serial.print("🔌 Pripájam sa na WiFi");
  WiFi.begin(ssid, password);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ WiFi pripojená!");
    Serial.print("   IP adresa: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n❌ WiFi pripojenie zlyhalo!");
  }
}

void sendDataToServer(float temp, float hum, float weight, int battery) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("❌ Nie je WiFi pripojenie!");
    return;
  }
  
  HTTPClient http;
  http.begin(serverUrl);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-API-Key", apiKey);
  
  // Vytvorenie JSON payloadu
  String payload = "{";
  payload += "\"temperature\":" + String(temp, 1) + ",";
  payload += "\"humidity\":" + String(hum, 1) + ",";
  payload += "\"weight\":" + String(weight, 2) + ",";
  payload += "\"battery\":" + String(battery) + ",";
  payload += "\"hiveId\":\"" + String(HIVE_ID) + "\"";
  payload += "}";
  
  Serial.println("📤 Odosielam dáta...");
  Serial.println("   Payload: " + payload);
  
  int httpCode = http.POST(payload);
  
  if (httpCode > 0) {
    String response = http.getString();
    Serial.printf("✅ Server odpoveď [%d]: %s\n", httpCode, response.c_str());
  } else {
    Serial.printf("❌ HTTP chyba: %s\n", http.errorToString(httpCode).c_str());
  }
  
  http.end();
}

int getBatteryLevel() {
  // Pre ESP32-C3 s batériou cez ADC
  // Upravte podľa vášho zapojenia
  int adcValue = analogRead(A0);
  int percentage = map(adcValue, 0, 4095, 0, 100);
  return constrain(percentage, 0, 100);
}
