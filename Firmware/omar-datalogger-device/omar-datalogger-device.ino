#include <WiFi.h>
#include <WebServer.h>
#include <DNSServer.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BME280.h>
#include <U8g2lib.h>
#include <RTClib.h>
#include <Preferences.h>
#include <Wire.h>
#include "esp_sleep.h"
#include "driver/rtc_io.h"

String ssid;
String password;

TaskHandle_t wifiTaskHandle;
TaskHandle_t localTaskHandle;

U8G2_ST7920_128X64_F_SW_SPI u8g2(U8G2_R0, 15, 2, 13, U8X8_PIN_NONE);
Adafruit_BME280 bme;
RTC_DS3231 rtc;
Preferences prefs;

// ================= إعدادات البطارية =================
const int BAT_PIN = 34;
const float R1_BAT = 2700.0;
const float R2_BAT = 10000.0;
const int ADC_MAX = 4095;
const float ADC_REF = 3.3;
float batteryCalibration = 1.0;  // عامل معايرة (ضعه 1.0 ثم اضبط حسب الملتيميتر)
float batteryVoltage = 0.0;  // جهد البطارية المقاس
int batteryPercent = 0;      // نسبة الشحن المحسوبة

// ================= إعدادات ال Keypad =================
#define BTN_UP 32
#define BTN_DOWN 33
#define BTN_LEFT 25
#define BTN_RIGHT 26
#define BTN_SEL 27

// ================= رسايل الي الشاشه =================
String message = "";
unsigned long messageShownSince = 0;
const unsigned long messageDuration = 5000;
static int currentPage = 0;
const int totalPages = 3;
unsigned long lastBlink = 0;
bool blinkWiFi = false;

// ================= اسم الجهاز =================
String name = "";

// ================= الحدود =================
float minTemp;
float maxTemp;
float minHum;
float maxHum;

// ================= الفترات =================
unsigned long intervalWifi = 20 * 60000UL;
unsigned long intervalLocal = 5 * 60000UL;
unsigned long intervalInterrupt = 60000UL;

// ⚠️ إضافة العدادات الجديدة
int wifiCounter = 0;
int localCounter = 0;
int wifiIntervalMinutes = 20;  // عدد الدقائق لاتصال WiFi
int localIntervalMinutes = 5;  // عدد الدقائق للحفظ المحلي

// ================= متغيرات للسليب =================
bool shouldSleep = true;
bool wifiRequested = false;
bool wifiTaskRunning = false;
bool deepSleepInProgress = false;
bool isSleeping = false;

// ================= بيانات الجهاز =================
String server_url;
String base_url;
String token;

// ================= بيانات هل الجهاز مستجل في السيرفر ولا لا =================
bool registered = false;  // false = discover mode, true = normal mode

// ================= Access Point configuration =================
WebServer server(80);
DNSServer dnsServer;
bool configMode = false;

// ================= RTC Memory للبيانات بين دورات السليب =================
RTC_DATA_ATTR unsigned long rtc_accumulatedLocalTime = 0;
RTC_DATA_ATTR unsigned long rtc_accumulatedWifiTime = 0;
RTC_DATA_ATTR bool rtc_wifiRequested = false;
RTC_DATA_ATTR bool rtc_alertCondition = false;

// ================= دالة السليب =================
void enterDeepSleep(uint64_t sleepTimeMs) {
  if (deepSleepInProgress) {
    Serial.println("⚠️ Deep Sleep قيد التقدم بالفعل");
    return;
  }
  deepSleepInProgress = true;

  Serial.printf("💤 دخول Deep Sleep لمدة %llu ثانية...\n", sleepTimeMs / 1000);

  // حفظ الحالة - الآن نحفظ الأوقات المتراكمة بدل المطلقة
  rtc_accumulatedLocalTime = localIntervalMinutes * 60000;
  rtc_accumulatedWifiTime = wifiIntervalMinutes * 60000;
  rtc_wifiRequested = wifiRequested;

  Serial.printf("💾 حفظ الحالة: Local=%lu, WiFi=%lu, Req=%d\n",
                localIntervalMinutes, wifiIntervalMinutes, wifiRequested);

  // تنظيف
  WiFi.disconnect(true);
  WiFi.mode(WIFI_OFF);

  delay(200);
  Serial.flush();
  delay(100);

  // التأكد من وقت السليب
  if (sleepTimeMs < 1000) {
    sleepTimeMs = 1000;  // minimum 1 second
  }

  esp_sleep_enable_timer_wakeup(sleepTimeMs * 1000ULL);

  Serial.println("💤 الذهاب إلى Deep Sleep الآن...");
  message = "Sleep mode";
  isSleeping = true;
  delay(200);
  esp_deep_sleep_start();
}

// ================= دوال مساعدة =================
// ================= بطارية =================
float readBatteryVoltage_raw() {
  int raw = analogRead(BAT_PIN);
  float v_adc = (raw / (float)ADC_MAX) * ADC_REF;    // فولت على مدخل ADC
  float vin = v_adc * ((R1_BAT + R2_BAT) / R2_BAT);  // فولت البطارية قبل المقسم
  vin *= batteryCalibration;                         // تطبيق عامل معايرة
  return vin;
}

float readBatteryVoltage() {
  const int samples = 6;
  float sum = 0;
  for (int i = 0; i < samples; ++i) {
    sum += readBatteryVoltage_raw();
    delay(5);
  }
  return sum / samples;
}

int batteryPercentage(float voltage) {
  const float Vmin = 3.0;
  const float Vmax = 4.19;
  float pct = (voltage - Vmin) / (Vmax - Vmin) * 100.0;
  if (pct < 0) pct = 0;
  if (pct > 100) pct = 100;
  return (int)(pct + 0.5);  // تقريب لأقرب عدد صحيح
}

void updateBatteryReading() {
  batteryVoltage = readBatteryVoltage();
  batteryPercent = batteryPercentage(batteryVoltage);

  Serial.printf("🔋 Battery: %.2fV (%d%%)\n", batteryVoltage, batteryPercent);
}
// ================= الكيباد و البازر و الكلوك =================
// helper for keypad (active low)
inline bool buttonPressed(int pin) {
  return digitalRead(pin) == LOW;
}

// =================  GLCD  =================
// ---------- Icons ----------
void drawTemperatureIcon(int x, int y) {
  u8g2.drawFrame(x, y, 7, 12);
  u8g2.drawBox(x + 2, y + 3, 3, 6);
  u8g2.drawDisc(x + 3, y + 11, 3);
}

void drawHumidityIcon(int x, int y) {
  u8g2.drawTriangle(x + 4, y, x, y + 8, x + 8, y + 8);
  u8g2.drawDisc(x + 4, y + 8, 4);
}

void drawWiFiStrengthIcon(int x, int y) {
  wl_status_t status = WiFi.status();
  bool connectedNow = (status == WL_CONNECTED);

  if (!connectedNow && !blinkWiFi) {
    u8g2.drawLine(x, y - 8, x + 8, y);
    u8g2.drawLine(x + 8, y - 8, x, y);
    return;
  }

  long rssi = WiFi.RSSI();
  if (rssi >= -67) {
    x += 3;
    u8g2.drawBox(x, y - 2, 2, 2);
    u8g2.drawBox(x + 3, y - 4, 2, 4);
    u8g2.drawBox(x + 6, y - 6, 2, 6);
    u8g2.drawBox(x + 9, y - 8, 2, 8);
  } else if (rssi >= -70) {
    u8g2.drawBox(x, y - 2, 2, 2);
    u8g2.drawBox(x + 3, y - 4, 2, 4);
    u8g2.drawBox(x + 6, y - 6, 2, 6);
  } else if (rssi >= -80) {
    u8g2.drawBox(x, y - 2, 2, 2);
    u8g2.drawBox(x + 3, y - 4, 2, 4);
  } else {
    u8g2.drawBox(x, y - 2, 2, 2);
  }
}

void drawSleepIcon(int x, int y) {
  u8g2.setFont(u8g2_font_6x10_tf);
  u8g2.drawStr(x + 8, y - 1, "Zz");
}

void drawBatteryIcon(int x, int y, int level) {
  y -= 10;

  // جسم البطارية (عمودي)
  u8g2.drawFrame(x, y, 6, 10);  // 6 عرض × 10 ارتفاع

  // الطرف (فوق)
  u8g2.drawBox(x + 1, y - 1, 4, 1);  // الطرف الصغير فوق البطارية

  // تعبئة الشحن من الأسفل للأعلى
  int fillHeight = map(level, 0, 100, 0, 10);
  u8g2.drawBox(x + 1, y + (10 - fillHeight), 4, fillHeight);
}

void drawHeader() {
  u8g2.setFont(u8g2_font_6x10_tf);
  if (rtc.begin()) {
    DateTime now = rtc.now();
    char timeStr[6];
    snprintf(timeStr, sizeof(timeStr), "%02d:%02d", now.hour(), now.minute());
    int timeWidth = u8g2.getStrWidth(timeStr);
    u8g2.drawStr((128 - timeWidth) / 2 - 10, 14, timeStr);

    char dateStr[6];
    snprintf(dateStr, sizeof(dateStr), "%02d/%02d", now.day(), now.month());
    u8g2.drawStr(3, 14, dateStr);
  } else {
    u8g2.drawStr((128 - 40) / 2, 14, "--:--");
    u8g2.drawStr(4, 14, "--/--");
  }

  drawWiFiStrengthIcon(110, 14);
  if (isSleeping) drawSleepIcon(98, 14);

  // Battery icon + % (مكانها مختار بحيث لا تتعارض مع WiFi)
  drawBatteryIcon(72, 14, batteryPercent);
  u8g2.setFont(u8g2_font_6x10_tf);
  char batStr[8];
  snprintf(batStr, sizeof(batStr), "%d%%", batteryPercent);
  // ارسم النص يمين الأيقونة (قد تحتاج ضبط الإحداثي Y لو خط مختلف)
  u8g2.drawStr(79, 14, batStr);
}

void updateHeader() {
  static unsigned long lastHeaderUpdate = 0;
  unsigned long now = millis();

  if (now - lastHeaderUpdate >= 1000) {  // يحدث كل ثانية
    lastHeaderUpdate = now;
    u8g2.setDrawColor(0);
    u8g2.drawBox(0, 0, 128, 16);
    u8g2.setDrawColor(1);
    drawHeader();
    u8g2.sendBuffer();
  }
}

// ---------- Splash ----------
void showSplashScreen() {
  u8g2.clearBuffer();
  u8g2.setFont(u8g2_font_8x13B_tf);
  int titleWidth = u8g2.getStrWidth("TOMATIKI");
  u8g2.setCursor((128 - titleWidth) / 2, 35);
  u8g2.print("TOMATIKI");

  u8g2.setFont(u8g2_font_6x13_tf);
  int labelWidth = u8g2.getStrWidth("Smart Data Logger");
  u8g2.setCursor((128 - labelWidth) / 2, 55);
  u8g2.print("Smart Data Logger");

  u8g2.sendBuffer();
  delay(2000);
}

// ---------- Time set page handler (blocking interative) ----------
bool handleTimeSetPage() {
  DateTime now = rtc.now();
  int editHour = now.hour();
  int editMin = now.minute();
  int editDay = now.day();
  int editMon = now.month();

  int field = 0;  // 0=hour,1=min,2=day,3=mon
  unsigned long lastDraw = 0;

  while (true) {
    // redraw ~ every 100ms
    if (millis() - lastDraw > 100) {
      u8g2.clearBuffer();
      u8g2.setFont(u8g2_font_6x12_tf);
      u8g2.drawStr(20, 10, "Set Time & Date");
      u8g2.drawHLine(0, 12, 128);

      u8g2.setFont(u8g2_font_6x10_tf);
      char buf[32];

      // Time display (highlight box around selected fields)
      sprintf(buf, "%02d:%02d", editHour, editMin);

      // رسم التظليل على الوقت
      if (field == 0) {
        // تظليل الساعات
        u8g2.drawBox(2, 18, 20, 12);
        u8g2.setDrawColor(0);
        u8g2.setCursor(4, 28);
        u8g2.printf("%02d", editHour);
        u8g2.setDrawColor(1);
        u8g2.setCursor(24, 28);
        u8g2.printf(":%02d", editMin);
      } else if (field == 1) {
        // تظليل الدقايق
        u8g2.setCursor(4, 28);
        u8g2.printf("%02d:", editHour);
        u8g2.drawBox(24, 18, 20, 12);
        u8g2.setDrawColor(0);
        u8g2.setCursor(26, 28);
        u8g2.printf("%02d", editMin);
        u8g2.setDrawColor(1);
      } else {
        // بدون تظليل
        u8g2.setCursor(4, 28);
        u8g2.printf("%02d:%02d", editHour, editMin);
      }

      // رسم التاريخ
      sprintf(buf, "%02d/%02d", editDay, editMon);
      if (field == 2) {
        // تظليل اليوم
        u8g2.drawBox(54, 18, 20, 12);
        u8g2.setDrawColor(0);
        u8g2.setCursor(56, 28);
        u8g2.printf("%02d", editDay);
        u8g2.setDrawColor(1);
        u8g2.setCursor(76, 28);
        u8g2.printf("/%02d", editMon);
      } else if (field == 3) {
        // تظليل الشهر
        u8g2.setCursor(56, 28);
        u8g2.printf("%02d/", editDay);
        u8g2.drawBox(76, 18, 20, 12);
        u8g2.setDrawColor(0);
        u8g2.setCursor(78, 28);
        u8g2.printf("%02d", editMon);
        u8g2.setDrawColor(1);
      } else {
        // بدون تظليل
        u8g2.setCursor(56, 28);
        u8g2.printf("%02d/%02d", editDay, editMon);
      }

      u8g2.setCursor(4, 48);
      u8g2.print("LEFT=Exit  SEL=Save");
      u8g2.sendBuffer();
      lastDraw = millis();
    }

    // button handling (with small debounces)
    if (buttonPressed(BTN_UP)) {
      if (field == 0) editHour = (editHour + 1) % 24;
      else if (field == 1) editMin = (editMin + 1) % 60;
      else if (field == 2) {
        editDay++;
        if (editDay > 31) editDay = 1;
      } else if (field == 3) {
        editMon++;
        if (editMon > 12) editMon = 1;
      }
      delay(150);
    }
    if (buttonPressed(BTN_DOWN)) {
      if (field == 0) editHour = (editHour + 23) % 24;
      else if (field == 1) editMin = (editMin + 59) % 60;
      else if (field == 2) {
        editDay--;
        if (editDay < 1) editDay = 31;
      } else if (field == 3) {
        editMon--;
        if (editMon < 1) editMon = 12;
      }
      delay(150);
    }
    if (buttonPressed(BTN_RIGHT)) {
      field = (field + 1) % 4;
      delay(150);
    }
    if (buttonPressed(BTN_LEFT)) {
      // exit without saving
      delay(150);
      return false;
    }
    if (buttonPressed(BTN_SEL)) {
      // Save to RTC - use year from current RTC if valid, otherwise 2025
      int year = (rtc.now().year() > 2000) ? rtc.now().year() : 2025;
      rtc.adjust(DateTime(year, editMon, editDay, editHour, editMin, 0));
      delay(200);
      return true;
    }

    // if user took too long, keep looping
    delay(20);
  }
}

// ---------- Pages ----------
void drawWiFiDetailsPage() {
  u8g2.clearBuffer();
  drawHeader();
  u8g2.drawHLine(0, 16, 128);
  u8g2.setFont(u8g2_font_6x10_tf);

  wl_status_t status = WiFi.status();
  bool connectedNow = (status == WL_CONNECTED);
  String ssidShown = connectedNow ? WiFi.SSID() : "";

  u8g2.drawStr(6, 30, ("SSID: " + (ssidShown.length() ? ssidShown : "--")).c_str());

  if (connectedNow) {
    u8g2.drawStr(6, 44, "Status: Connected");
    u8g2.drawStr(6, 58, ("IP: " + WiFi.localIP().toString()).c_str());
  } else {
    u8g2.drawStr(6, 44, "Status: Disconnected");
    u8g2.drawStr(6, 58, "IP: --.--.--.--");
  }

  u8g2.sendBuffer();
}

void drawMainPage() {
  u8g2.clearBuffer();
  drawHeader();
  u8g2.drawHLine(0, 16, 128);

  float t = bme.readTemperature();
  float h = bme.readHumidity();

  drawTemperatureIcon(10, 20);
  u8g2.setFont(u8g2_font_fub11_tf);
  char tmp[12];
  snprintf(tmp, sizeof(tmp), "%.1f", t);
  int tempW = u8g2.getStrWidth(tmp);
  u8g2.setCursor(28, 32);
  u8g2.print(tmp);
  u8g2.setFont(u8g2_font_6x10_tf);
  u8g2.setCursor(28 + tempW + 2, 32);
  u8g2.print("\260C");

  drawHumidityIcon(10, 39);
  snprintf(tmp, sizeof(tmp), "%.1f", h);
  u8g2.setFont(u8g2_font_fub11_tf);
  u8g2.setCursor(28, 51);
  u8g2.print(tmp);
  u8g2.setFont(u8g2_font_7x14_tf);
  u8g2.setCursor(28 + u8g2.getStrWidth(tmp) + 12, 51);
  u8g2.print("%");

  u8g2.sendBuffer();
}

// =================  read snsors  =================
void readSensors(float &temperature, float &humidity, float &batteryVoltage, int &batteryPercent) {
  temperature = bme.readTemperature();
  humidity = bme.readHumidity();
  batteryVoltage = readBatteryVoltage();
  batteryPercent = batteryPercentage(batteryVoltage);
}

// =================  Save Readings Localy  =================
void saveReadingLocally(float temp, float hum) {
  prefs.begin("devicePrefs", false);  // افتح كل مرة
  // قراءة الوقت الحالي
  DateTime now = rtc.now();
  char timestamp[20];
  sprintf(timestamp, "%04d-%02d-%02d %02d:%02d:%02d",
          now.year(), now.month(), now.day(),
          now.hour(), now.minute(), now.second());

  // قراءة القراءات السابقة
  String stored = prefs.getString("readings", "[]");
  DynamicJsonDocument doc(1024);

  // تحقق من صحة البيانات المخزنة أولاً
  if (stored != "[]") {
    DeserializationError error = deserializeJson(doc, stored);
    if (error) {
      Serial.println("❌ خطأ في قراءة البيانات المحفوظة، إعادة تهيئة المصفوفة");
      doc.clear();
      doc.to<JsonArray>();
    }
  } else {
    doc.to<JsonArray>();
  }

  JsonArray arr = doc.as<JsonArray>();

  // إضافة قراءة جديدة
  JsonObject r = arr.createNestedObject();
  r["t"] = temp;
  r["h"] = hum;
  r["time"] = String(timestamp);

  // حفظ المصفوفة مرة أخرى
  String output;
  serializeJson(doc, output);
  prefs.putString("readings", output);
  prefs.end();  // ← اقفل بعد الاستخدام

  // طباعة البيانات المحفوظة بشكل صحيح
  Serial.println("💾 البيانات المحفوظة هي: " + output);
  Serial.println("💾 تم حفظ قراءة محليًا: " + String(timestamp));
}

// =================  Server  =================
// 🔐 جلب التوكين من السيرفر
bool updateTokenFromServer() {
  if (WiFi.status() != WL_CONNECTED) return false;

  HTTPClient http;
  String url = base_url + "auth/login/";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  String body = "{\"username\": \"admin\", \"password\": \"admin1234\"}";
  int code = http.POST(body);

  if (code == 200) {
    String payload = http.getString();
    DynamicJsonDocument doc(512);
    DeserializationError error = deserializeJson(doc, payload);

    if (!error) {
      String newToken = doc["token"];
      prefs.begin("auth", false);
      String savedToken = prefs.getString("token", "");
      if (savedToken != newToken) {
        prefs.putString("token", newToken);
        Serial.println("🔑 Token updated!");
      } else {
        Serial.println("🔒 Token unchanged.");
      }
      prefs.end();
      http.end();
      return true;
    } else {
      Serial.println("⚠ JSON parse error!");
    }
  } else {
    Serial.printf("⚠ Token HTTP Error: %d\n", code);
  }

  http.end();
  return false;
}

// 📖 قراءة التوكين من الذاكرة
String getToken() {
  prefs.begin("auth", true);
  String token = prefs.getString("token", "");
  prefs.end();
  return token;
}

// ================= دالة للتأكد من وجود الجهاز في السيرفر =================
bool checkIfRegistered() {
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;

  String device_id = WiFi.macAddress();
  String url = base_url + "registered/" + device_id + "/";
  Serial.println("[CHECK] URL: " + url);

  http.begin(client, url);
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

// ================= دالة للدخول في وضع الاستكشاف للسيرفر =================
void sendDiscovery() {
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;

  String device_id = WiFi.macAddress();
  String url = base_url + "discover/";
  http.begin(client, url);
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

// ================= دالة لجلب البيانات من السيرفر =================
void fetchSettingsFromServer() {
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;

  String device_id = WiFi.macAddress();
  String url = base_url + "home/" + device_id + "/";

  Serial.println("🌍 GET " + url);

  if (http.begin(client, url)) {
    http.addHeader("Content-Type", "application/json");
    http.addHeader("Authorization", "Token " + getToken());

    int httpCode = http.GET();
    Serial.printf("📡 HTTP Status: %d\n", httpCode);

    if (httpCode == HTTP_CODE_OK) {
      String payload = http.getString();
      Serial.println("📦 Response Received:");
      Serial.println(payload);

      DynamicJsonDocument doc(1024);
      DeserializationError error = deserializeJson(doc, payload);

      if (!error) {
        // ✅ قراءة القيم من الجذر مباشرة
        String current_time = doc["current_time"] | "";
        String newName = doc["name"] | "";
        float newMinTemp = doc["min_temp"] | NAN;
        float newMaxTemp = doc["max_temp"] | NAN;
        float newMinHum = doc["min_hum"] | NAN;
        float newMaxHum = doc["max_hum"] | NAN;

        // ⚠️ قراءة الفترات بالدقائق من الـ backend
        int newWifiIntervalMinutes = doc["interval_wifi"] | 5;    // قيمة افتراضية 5 دقائق
        int newLocalIntervalMinutes = doc["interval_local"] | 5;  // قيمة افتراضية 5 دقائق

        // ⚠️ إصلاح: قراءة القيم السابقة من المتغيرات الحالية وليس من prefs
        String prevName = name;
        float prevMinTemp = minTemp;
        float prevMaxTemp = maxTemp;
        float prevMinHum = minHum;
        float prevMaxHum = maxHum;
        int prevWifiInterval = wifiIntervalMinutes;
        int prevLocalInterval = localIntervalMinutes;

        bool settingsChanged = false;

        prefs.begin("devicePrefs", false);
        // ✅ حفظ القيم الجديدة فقط لو تغيّرت
        if (prevName == "" || newName != prevName) {
          name = newName;
          prefs.putString("name", newName);
          settingsChanged = true;
          Serial.printf("🔄 تغيير الاسم إلى: %s\n", name.c_str());
        }

        if (isnan(prevMinTemp) || newMinTemp != prevMinTemp) {
          minTemp = newMinTemp;
          prefs.putFloat("minTemp", newMinTemp);
          settingsChanged = true;
          Serial.printf("🔄 تغيير الحد الأدنى لدرجة الحرارة إلى: %.1f\n", minTemp);
        }

        if (isnan(prevMaxTemp) || newMaxTemp != prevMaxTemp) {
          maxTemp = newMaxTemp;
          prefs.putFloat("maxTemp", newMaxTemp);
          settingsChanged = true;
          Serial.printf("🔄 تغيير الحد الأقصى لدرجة الحرارة إلى: %.1f\n", maxTemp);
        }

        if (isnan(prevMinHum) || newMinHum != prevMinHum) {
          minHum = newMinHum;
          prefs.putFloat("minHum", newMinHum);
          settingsChanged = true;
          Serial.printf("🔄 تغيير الحد الأدنى للرطوبة إلى: %.1f\n", minHum);
        }

        if (isnan(prevMaxHum) || newMaxHum != prevMaxHum) {
          maxHum = newMaxHum;
          prefs.putFloat("maxHum", newMaxHum);
          settingsChanged = true;
          Serial.printf("🔄 تغيير الحد الأقصى للرطوبة إلى: %.1f\n", maxHum);
        }


        // ⚠️ إصلاح: تحديث متغيرات الفترات مباشرة
        if (prevWifiInterval != newWifiIntervalMinutes) {
          wifiIntervalMinutes = newWifiIntervalMinutes;
          intervalWifi = wifiIntervalMinutes * 60000UL;
          prefs.putInt("wifiInterval", newWifiIntervalMinutes);
          wifiCounter = 0;
          prefs.putInt("wifiCounter", 0);
          settingsChanged = true;
          Serial.printf("🔄 تغيير فترة WiFi إلى %d دقائق\n", wifiIntervalMinutes);
        }

        if (prevLocalInterval != newLocalIntervalMinutes) {
          localIntervalMinutes = newLocalIntervalMinutes;
          intervalLocal = localIntervalMinutes * 60000UL;
          prefs.putInt("localInterval", newLocalIntervalMinutes);
          localCounter = 0;
          prefs.putInt("localCounter", 0);
          settingsChanged = true;
          Serial.printf("🔄 تغيير فترة Local إلى %d دقائق\n", localIntervalMinutes);
        }
        prefs.end();

        if (settingsChanged) {
          Serial.println("✅ تم تحديث الإعدادات من السيرفر");
        } else {
          Serial.println("ℹ️ لا توجد تغييرات في الإعدادات");
        }

        Serial.print("📟 اسم الجهاز: ");
        Serial.println(name);
        Serial.printf("✅ الحدود: %.1f~%.1f°C | %.1f~%.1f%%\n", minTemp, maxTemp, minHum, maxHum);
        Serial.printf("⏱️ الفترات: WiFi كل %d دقائق | Local كل %d دقائق\n", wifiIntervalMinutes, localIntervalMinutes);

        // ✅ تحديث الساعة من current_time
        if (current_time.length() > 0) {
          int y, M, d, h, m, s;
          if (sscanf(current_time.c_str(), "%d-%d-%d %d:%d:%d", &y, &M, &d, &h, &m, &s) == 6) {
            rtc.adjust(DateTime(y, M, d, h, m, s));
            Serial.printf("🕒 تم تحديث RTC إلى %s\n", current_time.c_str());
          } else {
            Serial.println("⚠️ خطأ في صيغة current_time");
          }
        }
      } else {
        Serial.print("❌ JSON Error: ");
        Serial.println(error.c_str());
      }
    } else {
      Serial.printf("❌ GET Error: %d\n", httpCode);
    }

    http.end();
  } else {
    Serial.println("❌ فشل في إنشاء الاتصال بـ HTTP");
  }
}

// =================  Save Readings Localy  =================
void sendStoredReadings(float currentTemp, float currentHum) {
  prefs.begin("devicePrefs", false);  // افتح قبل القراءة

  String stored = prefs.getString("readings", "[]");
  prefs.end();
  size_t count = 0;
  Serial.println("🔍 فحص البيانات المحفوظة: " + stored);
  // تحقق أولاً إذا كانت البيانات فارغة أو غير صالحة
  if (stored == "[]" || stored.length() <= 2) {
    Serial.println("⚠️ لا توجد قراءات محلية — سيتم استخدام القراءة الحالية فقط");
    // ... كود إضافة القراءة الحالية
  } else {
    // حاول فك ترميز JSON
    DynamicJsonDocument doc(2048);
    DeserializationError err = deserializeJson(doc, stored);

    if (err) {
      Serial.println("❌ خطأ في فك ترميز البيانات المحلية: " + String(err.c_str()));
      Serial.println("📦 البيانات المخزنة: " + stored);
      // استخدم القراءة الحالية فقط في حالة الخطأ
      Serial.println("⚠️ سيتم استخدام القراءة الحالية فقط بسبب خطأ الترميز");
      // ... كود إضافة القراءة الحالية
    } else if (!doc.is<JsonArray>() || doc.size() == 0) {
      Serial.println("⚠️ البيانات المحلية ليست مصفوفة أو فارغة");
      // ... كود إضافة القراءة الحالية
    } else {
      // البيانات صالحة، تابع المعالجة العادية
      JsonArray storedArr = doc.as<JsonArray>();
      DynamicJsonDocument newDoc(2048);
      JsonArray arr = newDoc.createNestedArray("readings");

      for (JsonObject r : storedArr) {
        JsonObject newR = arr.createNestedObject();
        newR["t"] = r["t"];
        newR["h"] = r["h"];
        newR["time"] = r["time"];
      }
      count = storedArr.size();
      Serial.printf("📦 سيتم إرسال %d قراءات محفوظة\n", count);

      newDoc["device_id"] = WiFi.macAddress();
      newDoc["battery_level"] = batteryPercentage(readBatteryVoltage());

      String jsonBody;
      serializeJson(newDoc, jsonBody);

      WiFiClientSecure client;
      client.setInsecure();
      HTTPClient http;
      http.begin(client, base_url);
      http.addHeader("Content-Type", "application/json");
      http.addHeader("Authorization", "Token " + getToken());
      int httpCode = http.POST(jsonBody);

      if (httpCode > 0) {
        Serial.printf("✅ تم إرسال %d قراءات. HTTP Code=%d\n", count, httpCode);
        if (count > 0) {
          prefs.begin("devicePrefs", false);
          prefs.putString("readings", "[]");
          prefs.end();
          Serial.println("🧹 تم مسح القراءات المحلية بعد الإرسال الناجح");
        }
      } else {
        Serial.printf("❌ فشل إرسال القراءات. HTTP Code=%d\n", httpCode);
      }
      http.end();
      return;  // انهي الدالة هنا لأننا أرسلنا البيانات
    }
  }

  // هذا الجزء ينفذ فقط إذا لم تكن هناك بيانات محلية صالحة
  DynamicJsonDocument doc(1024);
  JsonArray arr = doc.createNestedArray("readings");

  JsonObject newR = arr.createNestedObject();
  newR["t"] = currentTemp;
  newR["h"] = currentHum;

  DateTime now = rtc.now();
  char timeStr[25];
  sprintf(timeStr, "%04d-%02d-%02d %02d:%02d:%02d",
          now.year(), now.month(), now.day(), now.hour(), now.minute(), now.second());
  newR["time"] = timeStr;

  doc["device_id"] = WiFi.macAddress();
  doc["battery_level"] = batteryPercentage(readBatteryVoltage());

  String jsonBody;
  serializeJson(doc, jsonBody);

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  http.begin(client, base_url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", "Token " + getToken());
  int httpCode = http.POST(jsonBody);

  if (httpCode > 0) {
    Serial.printf("✅ تم إرسال القراءة الحالية فقط. HTTP Code=%d\n", httpCode);
  } else {
    Serial.printf("❌ فشل إرسال القراءة الحالية. HTTP Code=%d\n", httpCode);
  }
  http.end();
}

// ================= Send Log =================
void sendLog(String error_type, String message) {
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;

  String url = base_url + "logs/create/";  // ضع endpoint مناسب
  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", "Token " + getToken());

  StaticJsonDocument<256> doc;
  doc["device_id"] = WiFi.macAddress();
  doc["log_type"] = "device";
  doc["error_type"] = error_type;
  doc["message"] = message;

  String jsonBody;
  serializeJson(doc, jsonBody);

  Serial.println("⚠️[LOG] Sending: " + jsonBody);
  int httpResponseCode = http.POST(jsonBody);

  if (httpResponseCode > 0) {
    Serial.printf("✅[LOG] Response: %d\n", httpResponseCode);
    Serial.println(http.getString());
  } else {
    Serial.printf("❌[LOG] Error: %d\n", httpResponseCode);
  }

  http.end();
}

// ============= صفحة HTML للتكوين =============
String htmlPage(String networks = "") {
  return String(
    "<!DOCTYPE html><html><head><title>Device Setup</title>"
    "<style>"
    "body{font-family:Arial;text-align:center;margin-top:40px;}"
    "form{display:inline-block;text-align:left;}"
    "label{display:block;margin-top:10px;}"
    "input,select{display:block;padding:8px;margin:6px auto;width:80%;max-width:300px;border:1px solid #ccc;border-radius:6px;}"
    "button{padding:10px 20px;margin-top:20px;border:none;border-radius:6px;background:#0078D7;color:white;cursor:pointer;}"
    "button:hover{background:#005fa3;}"
    "#manual_ssid{display:none;}"  // نبدأ بإخفاء الحقل
    "</style>"

    "<script>"
    // عند اختيار 'Manual Entry' يظهر input لكتابة SSID
    "function toggleSSIDInput(sel){"
    "var manual=document.getElementById('manual_ssid');"
    "if(sel.value==='manual'){manual.style.display='block'; manual.required=true;}else{manual.style.display='none'; manual.required=false;}"
    "}"

    // فلترة إدخال الـ IP بحيث يقبل أرقام فقط ويضيف '.' بعد كل 3 أرقام
    "function formatIP(input){"
    "let val=input.value.replace(/[^0-9]/g,'');"
    "let result='';"
    "for(let i=0;i<val.length && i<12;i++){"
    "if(i>0 && i%3==0 && result.split('.').length<4) result+='.';"
    "result+=val[i];"
    "}"
    "input.value=result;"
    "}"
    "</script>"

    "</head><body>"
    "<h2>⚙️ Device WiFi Setup</h2>"
    "<form action='/save' method='post'>"

    "<label>WiFi Network:</label>"
    "<select name='ssid' onchange='toggleSSIDInput(this)'>"
    + networks + "<option value='manual'>🔹 Manual Entry</option>"
                 "</select>"

                 "<input id='manual_ssid' name='manual_ssid' type='text' placeholder='Enter SSID manually'>"

                 "<label>Password:</label>"
                 "<input name='password' type='password'>"

                 "<label>Server IP:</label>"
                 "<input name='server' type='text' maxlength='15' oninput='formatIP(this)' placeholder='192.168.001.001'>"

                 "<button type='submit'>Save</button>"
                 "</form></body></html>");
}

// ============= عرض الشبكات المحيطة =============
String getNetworksHTML() {
  int n = WiFi.scanNetworks();
  String options = "";
  for (int i = 0; i < n; i++) {
    options += "<option value='" + WiFi.SSID(i) + "'>" + WiFi.SSID(i) + " (" + String(WiFi.RSSI(i)) + " dBm)</option>";
  }
  return options;
}

String cleanIP(String ip) {
  ip.trim();

  // إزالة أي أحرف غير أرقام أو نقاط
  String filtered = "";
  for (int i = 0; i < ip.length(); i++) {
    char c = ip[i];
    if ((c >= '0' && c <= '9') || c == '.') filtered += c;
  }

  // تقسيم الـ IP إلى 4 أجزاء
  String parts[4];
  int lastDot = -1;
  int partCount = 0;

  for (int i = 0; i < filtered.length(); i++) {
    if (filtered[i] == '.' || i == filtered.length() - 1) {
      int end = (filtered[i] == '.') ? i : i + 1;
      if (partCount < 4) {
        parts[partCount] = filtered.substring(lastDot + 1, end);
        parts[partCount].trim();

        // إزالة الأصفار البادئة
        while (parts[partCount].length() > 1 && parts[partCount].startsWith("0")) {
          parts[partCount].remove(0, 1);
        }

        // التأكد إن كل جزء رقم بين 0 و255
        int num = parts[partCount].toInt();
        if (num < 0 || num > 255) parts[partCount] = "0";

        partCount++;
      }
      lastDot = i;
    }
  }

  // لو عدد الأجزاء أقل من 4 نكمل بصفر
  while (partCount < 4) {
    parts[partCount++] = "0";
  }

  // دمج الأجزاء في IP صحيح
  String result = parts[0] + "." + parts[1] + "." + parts[2] + "." + parts[3];
  return result;
}

// =================== دالة إعداد الـ Access Point لأول مرة ===================
void startConfigAP() {
  Serial.println("🟢 وضع الإعداد (Access Point Mode)");

  WiFi.mode(WIFI_AP);
  WiFi.softAP("ESP_Config", "12345678");

  IPAddress IP = WiFi.softAPIP();
  Serial.print("📶 Connect to 'ESP_Config' and open http://");
  Serial.println(IP);

  // ابدأ خادم DNS علشان يحول أي موقع إلى IP الـ ESP
  dnsServer.start(53, "*", WiFi.softAPIP());

  String htmlForm = htmlPage(getNetworksHTML());

  server.on("/", HTTP_GET, [htmlForm]() {
    server.send(200, "text/html", htmlForm);
  });

  server.on("/save", HTTP_POST, []() {
    String newSSID = server.arg("ssid");
    String manualSSID = server.arg("manual_ssid");
    String newPass = server.arg("password");
    String newIP = cleanIP(server.arg("server"));
    base_url = "https://" + newIP + "/";

    // 👇 استخدم الإدخال اليدوي لو اختار "Manual Entry"
    if (newSSID == "manual" && manualSSID != "") {
      newSSID = manualSSID;
    }

    if (newSSID != "" && base_url != "") {
      prefs.begin("devicePrefs", false);
      prefs.putString("ssid", newSSID);
      prefs.putString("password", newPass);
      prefs.putString("server_url", base_url);
      prefs.end();

      Serial.println("🔒 Saved WiFi & Server settings successfully.");
      Serial.println("WiFi SSID: " + newSSID);
      Serial.println("Server IP: " + base_url);

      server.send(200, "text/html", "<h3>✅ Saved! Restarting...</h3>");
      delay(1500);
      ESP.restart();
    } else {
      server.send(400, "text/html", "<h3>❌ Please fill all fields!</h3>");
    }
  });

  server.begin();
  Serial.println("🌐 Web server started for config");

  while (true) {
    dnsServer.processNextRequest();
    server.handleClient();
    delay(10);
  }
}

// ================= WiFi Task =================
void wifiTask(void *parameter) {
  for (;;) {
    // انتظار الإشعار من المهام الأخرى
    ulTaskNotifyTake(pdTRUE, portMAX_DELAY);

    if (wifiTaskRunning) {
      Serial.println("⚠️ WiFiTask مشغولة حاليًا، تجاهل wakeup");
      continue;
    }

    wifiTaskRunning = true;

    Serial.println("🌐 WiFiTask بدأ");
    message = "Wake up";

    // منع الدخول في السليب أثناء عمل الـ WiFi
    shouldSleep = false;
    isSleeping = false;
    updateHeader();

    WiFi.mode(WIFI_STA);
    WiFi.begin(ssid.c_str(), password.c_str());

    unsigned long start = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - start < 10000) {
      Serial.print(".");
      vTaskDelay(500 / portTICK_PERIOD_MS);
    }

    if (WiFi.status() == WL_CONNECTED) {
      Serial.println("\n✅ WiFi متصل SSid: " + ssid);
      Serial.println("\n✅ Server url: " + server_url);
      updateTokenFromServer();

      registered = checkIfRegistered();
      if (!registered) {
        Serial.println("🔍 Device not registered. Entering discovery mode...");
        sendDiscovery();
      } else {
        Serial.println("✅ Device is registered. Starting normal mode...");

        fetchSettingsFromServer();

        // إرسال القرايات الحالية
        float t, h, v;
        int p;
        readSensors(t, h, v, p);
        sendStoredReadings(t, h);  // إرسال كل القرايات المحفوظة دفعة واحدة

        // تسجيل الاخطاء الي السيرفر
        if (t < minTemp) {
          sendLog("Temperature", "Temperature is Lower than Minimum Temperature (" + String(minTemp) + ")");
        }
        if (t > maxTemp) {
          sendLog("Temperature", "Temperature is More than Maximum Temperature (" + String(maxTemp) + ")");
        }
        if (h < minHum) {
          sendLog("Humidity", "Humidity is Lower than Minimum Humidity (" + String(minHum) + ")");
        }
        if (h > maxHum) {
          sendLog("Humidity", "Humidity is More than Maximum Humidity (" + String(maxHum) + ")");
        }
        if (p < 20) {
          sendLog("Battery", "Battery is Less than 20. Need to charge it");
        }
      }

    } else {
      Serial.println("❌ فشل الاتصال بالواي فاي");
      WiFi.disconnect(true);
      WiFi.mode(WIFI_OFF);
      vTaskDelay(5000 / portTICK_PERIOD_MS);  // ينتظر 5 ثواني قبل ما يكمل
    }

    WiFi.disconnect(true);
    WiFi.mode(WIFI_OFF);
    vTaskDelay(5000 / portTICK_PERIOD_MS);  // ينتظر 5 ثواني قبل ما يكمل

    // ⚠️ إصلاح: تصفير العداد هنا بعد انتهاء مهمة WiFi
    wifiCounter = 0;
    localCounter = 0;

    // حفظ العداد في الذاكرة
    prefs.begin("devicePrefs", false);
    prefs.putInt("wifiCounter", wifiCounter);
    prefs.putInt("localCounter", localCounter);
    prefs.end();

    Serial.printf("🔄 تم تصفير عداد WiFi إلى %d\n", wifiCounter);
    Serial.printf("🔄 تم تصفير عداد Local إلى %d\n", localCounter);

    // السماح بالدخول في السليب مرة أخرى
    shouldSleep = true;
    isSleeping = true;
    wifiRequested = false;
    wifiTaskRunning = false;
    updateHeader();

    Serial.println("🌙 WiFiTask انتهى\n");

    // ⚠️ ناقص هذا السطر ⚠️
    enterDeepSleep(intervalInterrupt);  // إضافة هذا السطر
  }
}

// ================= Local Task =================
void localTask(void *parameter) {
  Wire.begin(21, 22);

  if (!bme.begin(0x76)) {
    Serial.println("❌ فشل في تهيئة BME280!");
    delay(2000);
    ESP.restart();
  }

  if (!rtc.begin()) {
    Serial.println("❌ فشل في تهيئة RTC!");
  }

  analogSetPinAttenuation(BAT_PIN, ADC_11db);

  if (rtc.lostPower()) {
    rtc.adjust(DateTime(F(__DATE__), F(__TIME__)));
    Serial.println("⏰ تم ضبط الوقت على وقت الكومبايل.");
  }

  for (;;) {
    message = "Wake up";
    DateTime now = rtc.now();
    updateBatteryReading();
    drawMainPage();

    float t, h, v;
    int p;
    readSensors(t, h, v, p);

    Serial.printf("[%02d:%02d:%02d] 🌡️ %.2f°C | 💧 %.2f%% | 🔋 %.2fV (%d%%)\n",
                  now.hour(), now.minute(), now.second(), t, h, v, p);

    // التحقق من الحدود
    bool alert = (t < minTemp) || (t > maxTemp) || (h < minHum) || (h > maxHum) || (p < 20);
    if (alert && !wifiRequested && !wifiTaskRunning) {
      Serial.println("🚨 القيم خارج الحدود! يصحي WiFiTask...");
      wifiRequested = true;
      xTaskNotifyGive(wifiTaskHandle);
      vTaskDelay(5000 / portTICK_PERIOD_MS);
      continue;
    }

    // ⚠️ زيادة العدادات
    wifiCounter++;
    localCounter++;

    Serial.printf("🔢 زيادة العدادات: WiFi=%d/%d, Local=%d/%d\n",
                  wifiCounter, wifiIntervalMinutes, localCounter, localIntervalMinutes);

    // 💾 تخزين محلي كل X دقائق
    if (localCounter >= localIntervalMinutes) {
      Serial.println("💾 وقت الحفظ المحلي - حفظ البيانات...");
      saveReadingLocally(t, h);
      localCounter = 0;

      // حفظ العداد في الذاكرة
      prefs.begin("devicePrefs", false);
      prefs.putInt("localCounter", localCounter);
      prefs.end();
    }

    // 🌐 تحديث WiFi دوري كل Y دقائق
    if (wifiCounter >= wifiIntervalMinutes && !wifiRequested && !wifiTaskRunning) {
      Serial.println("🔁 وقت تحديث WiFi الدوري — يصحي WiFiTask...");
      wifiRequested = true;
      xTaskNotifyGive(wifiTaskHandle);
      wifiCounter = 0;

      // حفظ العداد في الذاكرة
      prefs.begin("devicePrefs", false);
      prefs.putInt("wifiCounter", wifiCounter);
      prefs.end();

      vTaskDelay(5000 / portTICK_PERIOD_MS);
      continue;
    }

    // حفظ العدادات في الذاكرة
    prefs.begin("devicePrefs", false);
    prefs.putInt("wifiCounter", wifiCounter);
    prefs.putInt("localCounter", localCounter);
    prefs.end();

    // إذا لم يكن هناك حاجة لـ WiFi، ندخل Deep Sleep
    if (!wifiRequested && !wifiTaskRunning) {
      Serial.printf("💤 دخول Deep Sleep لمدة %lu ثانية...\n", intervalInterrupt / 1000);
      enterDeepSleep(intervalInterrupt);
    } else {
      // إذا كان هناك طلب WiFi، انتظر فترة قصيرة
      Serial.println("⏳ في انتظار اكتمال مهمة WiFi...");
      vTaskDelay(5000 / portTICK_PERIOD_MS);
    }
  }
}

// ================= Setup =================
void setup() {
  Serial.begin(115200);
  delay(2000);

  Serial.println("\n\n🔷 بدء نظام المراقبة مع Deep Sleep 🔷");
  isSleeping = false;
  updateHeader();

  // تحقق من سبب الاستيقاظ
  esp_sleep_wakeup_cause_t wakeup_reason = esp_sleep_get_wakeup_cause();

  if (wakeup_reason == ESP_SLEEP_WAKEUP_TIMER) {
    Serial.println("⏰ استيقاظ من Deep Sleep (Timer)");
  } else if (wakeup_reason == ESP_SLEEP_WAKEUP_UNDEFINED) {
    Serial.println("🚀 بدء تشغيل جديد أو إعادة ضبط");
  } else {
    Serial.printf("🔔 استيقاظ بسبب: %d\n", wakeup_reason);
  }

  // ⚠️ إضافة تهيئة الشاشة هنا
  u8g2.begin();
  
  // glcd open splash
  showSplashScreen();

  // battery ADC setup
  analogSetPinAttenuation(BAT_PIN, ADC_11db);  // تمديد مدى القياس لـ ~3.9V

  // keypad initialization
  pinMode(BTN_UP, INPUT_PULLUP);
  pinMode(BTN_DOWN, INPUT_PULLUP);
  pinMode(BTN_LEFT, INPUT_PULLUP);
  pinMode(BTN_RIGHT, INPUT_PULLUP);
  pinMode(BTN_SEL, INPUT_PULLUP);

  prefs.begin("devicePrefs", false);
  ssid = prefs.getString("ssid", "");
  password = prefs.getString("password", "");
  server_url = prefs.getString("server_url", "");

  // ⚠️ تحميل الإعدادات - استخدم قيم افتراضية صحيحة
  name = prefs.getString("name", "Device");

  // ⚠️ القيم الافتراضية كانت غلط - استخدم NAN بدل القيم الثابتة
  minTemp = prefs.getFloat("minTemp", NAN);
  maxTemp = prefs.getFloat("maxTemp", NAN);
  minHum = prefs.getFloat("minHum", NAN);
  maxHum = prefs.getFloat("maxHum", NAN);

  // ⚠️ تحميل الفترات من الذاكرة مباشرة
  wifiIntervalMinutes = prefs.getInt("wifiInterval", 5);
  localIntervalMinutes = prefs.getInt("localInterval", 5);

  // ⚠️ تحميل العدادات من الذاكرة
  wifiCounter = prefs.getInt("wifiCounter", 0);
  localCounter = prefs.getInt("localCounter", 0);
  prefs.end();

  // ⚠️ إعادة حساب الـ intervals من القيم المحملة
  intervalWifi = wifiIntervalMinutes * 60000UL;
  intervalLocal = localIntervalMinutes * 60000UL;

  base_url = server_url;

  // ⚠️ إضافة تحقق من صحة القيم
  if (isnan(minTemp) || isnan(maxTemp)) {
    Serial.println("⚠️ الحدود غير مضبوطة - استخدام قيم افتراضية آمنة");
    minTemp = 10.0;
    maxTemp = 35.0;
  }

  if (isnan(minHum) || isnan(maxHum)) {
    minHum = 30.0;
    maxHum = 80.0;
  }

  // ⚠️ التأكد من أن الفترات قيم صحيحة
  if (wifiIntervalMinutes <= 0) wifiIntervalMinutes = 5;
  if (localIntervalMinutes <= 0) localIntervalMinutes = 5;

  Serial.printf("⚙️ الإعدادات: Temp %.1f-%.1f°C, Hum %.1f-%.1f%%\n", minTemp, maxTemp, minHum, maxHum);
  Serial.printf("⏱️ الفترات: WiFi كل %d دقائق (عداد: %d/%d), Local كل %d دقائق (عداد: %d/%d)\n",
                wifiIntervalMinutes, wifiCounter, wifiIntervalMinutes,
                localIntervalMinutes, localCounter, localIntervalMinutes);

  if (ssid == "" || server_url == "") {
    startConfigAP();
  }

  esp_sleep_pd_config(ESP_PD_DOMAIN_RTC_PERIPH, ESP_PD_OPTION_ON);


  // إنشاء المهام
  xTaskCreatePinnedToCore(wifiTask, "WiFiTask", 8192, NULL, 1, &wifiTaskHandle, 0);
  xTaskCreatePinnedToCore(localTask, "LocalTask", 8192, NULL, 2, &localTaskHandle, 1);

  Serial.println("🚀 النظام بدأ (مع Deep Sleep محسّن)");

  if (wakeup_reason != ESP_SLEEP_WAKEUP_TIMER) {
    Serial.println("⏩ تشغيل WiFiTask عند الإقلاع لأول مرة...");
    wifiRequested = true;
    xTaskNotifyGive(wifiTaskHandle);
  }
}

void loop() {
  // الـ loop الرئيسي يمكن أن يكون فارغًا
  vTaskDelay(10000 / portTICK_PERIOD_MS);
  unsigned long now = millis();

  // ====================== تحديث الرسائل المؤقتة ======================
  if (message != "" && millis() - messageShownSince > messageDuration) {
    message = "";
  }

  // Blinking Wi-Fi icon
  if (now - lastBlink >= 500) {
    blinkWiFi = !blinkWiFi;
    lastBlink = now;
  }

  // keypad pressed
  if (buttonPressed(BTN_RIGHT)) {
    currentPage = (currentPage + 1) % totalPages;
    delay(200);
  } else if (buttonPressed(BTN_LEFT)) {
    currentPage = (currentPage - 1 + totalPages) % totalPages;
    delay(200);
  } else if (buttonPressed(BTN_SEL)) {
    if (currentPage == 2) {
      bool saved = handleTimeSetPage();
      if (saved) {
        message = "Time updated";
        messageShownSince = millis();
      }
      currentPage = 0;
    }
  }

  // ====================== 6. تحديث واجهة العرض ======================
  switch (currentPage) {
    case 0:
      drawMainPage();
      break;
    case 1:
      drawWiFiDetailsPage();
      break;
    case 2:
      // صفحة ضبط الوقت يتم تشغيلها بزر SEL
      u8g2.clearBuffer();
      u8g2.setFont(u8g2_font_6x12_tf);
      u8g2.drawStr(10, 32, "Press SEL to set time");
      u8g2.sendBuffer();
      break;
  }
}