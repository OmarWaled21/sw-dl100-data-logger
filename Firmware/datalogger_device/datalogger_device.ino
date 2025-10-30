#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
// إعدادات الشبكة
#define WIFI_SSID "Mohsen"
#define WIFI_PASSWORD "wsos1234"

// إعداد السيرفر (تأكد إن IP ده هو IP السيرفر فعلاً في الشبكة)
#define SERVER_IP "192.168.1.5"
#define CHECK_URL "http://" SERVER_IP ":8000/registered/"
#define DISCOVER_URL "http://" SERVER_IP ":8000/discover/"
#define READING_URL "http://" SERVER_IP ":8000/"

String token = "e2e3eac0f201854b5c508e3ed219f9c6ca1bf9fe";

// بيانات الجهاز
String device_id;
bool registered = false;  // false = discover mode, true = normal mode
unsigned long lastCheckTime = 0;

// ==================================================
// الاتصال بالشبكة
// ==================================================
void connectWiFi() {
  Serial.printf("Connecting to WiFi: %s\n", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.printf("\n✅ Connected! IP: %s\n", WiFi.localIP().toString().c_str());
  device_id = WiFi.macAddress();
  Serial.println("Device ID: " + device_id);
}

// ==================================================
// التحقق هل الجهاز مسجل في السيرفر
// ==================================================
bool checkIfRegistered() {
  HTTPClient http;
  String url = CHECK_URL + device_id + "/";
  Serial.println("[CHECK] URL: " + url);

  http.begin(url);
  int httpResponseCode = http.GET();

  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.println("[CHECK] Response: " + response);

    StaticJsonDocument<128> doc;
    DeserializationError error = deserializeJson(doc, response);
    if (!error) {
      bool reg = doc["registered"];
      http.end();
      return reg;
    } else {
      Serial.println("[CHECK] JSON Parse Error");
    }
  } else {
    Serial.printf("[CHECK] Error: %d\n", httpResponseCode);
  }
  http.end();
  return false;
}

// ==================================================
// تسجيل الجهاز في وضع الاكتشاف
// ==================================================
void sendDiscovery() {
  HTTPClient http;
  http.begin(DISCOVER_URL);
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<128> doc;
  doc["device_id"] = device_id;

  String jsonBody;
  serializeJson(doc, jsonBody);

  Serial.println("[DISCOVERY] Sending: " + jsonBody);
  int httpResponseCode = http.POST(jsonBody);

  if (httpResponseCode > 0) {
    Serial.printf("[DISCOVERY] Response code: %d\n", httpResponseCode);
    Serial.println(http.getString());
  } else {
    Serial.printf("[DISCOVERY] Error: %d\n", httpResponseCode);
  }
  http.end();
}

// ==================================================
// إرسال القراءات (درجة الحرارة + الرطوبة + البطارية)
// ==================================================
void sendReading(float temp, float hum, int battery) {
  HTTPClient http;
  http.begin(READING_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", "Token " + token);

  StaticJsonDocument<256> doc;
  doc["device_id"] = device_id;
  doc["temperature"] = temp;
  doc["humidity"] = hum;
  doc["battery_level"] = battery;

  String jsonBody;
  serializeJson(doc, jsonBody);

  Serial.println("[READING] Sending: " + jsonBody);
  int httpResponseCode = http.POST(jsonBody);

  if (httpResponseCode > 0) {
    Serial.printf("[READING] Response: %d\n", httpResponseCode);
    Serial.println(http.getString());
  } else {
    Serial.printf("[READING] Error: %d\n", httpResponseCode);
  }

  http.end();
}

// ==================================================
// الإعداد المبدئي
// ==================================================
void setup() {
  Serial.begin(115200);
  connectWiFi();
  delay(1000);
  registered = checkIfRegistered();

  if (registered) {
    Serial.println("✅ Device is registered. Starting normal mode...");
  } else {
    Serial.println("🔍 Device not registered. Entering discovery mode...");
  }
}

// ==================================================
// الحلقة الرئيسية
// ==================================================
void loop() {
  unsigned long now = millis();
  static bool justRegistered = false;  // يتحقق لو الجهاز لسه متسجل دلوقتي

  if (!registered) {
    // وضع الاكتشاف
    sendDiscovery();

    // تحقق كل دقيقة إذا الجهاز اتسجل
    if (now - lastCheckTime > 10000) {
      bool newStatus = checkIfRegistered();
      if (newStatus && !registered) {
        // الجهاز لسه اتسجل دلوقتي
        registered = true;
        justRegistered = true;
        Serial.println("🎉 Device has been registered! Switching to normal mode...");
      }
      lastCheckTime = now;
    }
    delay(5000);  // نحاول كل 5 ثواني

  } else {
    // لو لسه متسجل حالًا، ابعت أول قراءة فورًا
    if (justRegistered) {
      float temp = random(20, 35);
      float hum = random(40, 60);
      int battery = random(70, 100);
      sendReading(temp, hum, battery);
      justRegistered = false;  // نرجعه false عشان ما يعيدش الإرسال
    }

    // الوضع الطبيعي (إرسال القراءات الدورية)
    float temp = random(20, 35);
    float hum = random(40, 60);
    int battery = random(70, 100);

    sendReading(temp, hum, battery);

    delay(5000);  // إرسال كل 5 ثانية
  }
}
