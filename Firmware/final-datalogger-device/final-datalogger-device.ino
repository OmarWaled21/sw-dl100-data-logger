/*
  DL100 - ESP32 + BME280 + DS3231 + GLCD + Keypad
  Fixed version: Header updates every second (WiFi + time/date + sleep icon)
*/

#include <U8g2lib.h>
#include <Wire.h>
#include <RTClib.h>
#include <WiFi.h>
#include <WebServer.h>
#include <Preferences.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BME280.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>


String baseUrl;  // عنوان السيرفر (هنا اللي المستخدم هيدخله في صفحة AP)

// بيانات الجهاز
String device_id;
bool registered = false;  // false = discover mode, true = normal mode
unsigned long lastCheckTime = 0;

#define BTN_UP 32
#define BTN_DOWN 33
#define BTN_LEFT 25
#define BTN_RIGHT 26
#define BTN_SEL 27

U8G2_ST7920_128X64_F_SW_SPI u8g2(U8G2_R0, 15, 2, 13, U8X8_PIN_NONE);
RTC_DS3231 rtc;
Adafruit_BME280 bme;
WebServer server(80);
Preferences preferences;


// ---------- Battery measurement (parallel pack) ----------
const int BAT_PIN = 34;        // ADC pin
const float R1_BAT = 2700.0;   // ohm (من BAT+ إلى ADC)
const float R2_BAT = 10000.0;  // ohm (من ADC إلى GND)
const int ADC_MAX = 4095;      // 12-bit ADC
const float ADC_REF = 3.3;     // مرجع نظري (قابل للمعايرة)

float batteryVoltage = 0.0;  // جهد البطارية المقاس
int batteryPercent = 0;      // نسبة الشحن المحسوبة

const unsigned long batteryUpdateInterval = 5000UL;  // كل 5 ثواني قراءة البطارية
unsigned long lastBatteryUpdate = 0;

float batteryCalibration = 1.0;  // عامل معايرة (ضعه 1.0 ثم اضبط حسب الملتيميتر)


// ----- مراقبة الاتصال بالواي فاي -----
const unsigned long WIFI_CHECK_INTERVAL = 5000UL;
unsigned long lastWiFiCheck = 0;
unsigned long wifiDisconnectedSince = 0;
const unsigned long WIFI_RECONNECT_TIMEOUT = 15000UL;  // 15 ثانية مهلة قبل التحول إلى Access Point


float temperature = 0.0;
float humidity = 0.0;

bool wifiConnected = false;
bool apMode = false;
bool rtcOK = false;
bool bmeOK = false;

String ssid = "";
String password = "";
String apSSIDList = "";
String serverIP = "";


String message = "";
unsigned long messageShownSince = 0;
const unsigned long messageDuration = 5000;
int wifiSignalStrength = 0;

int connectionAttempt = 1;
const int maxAttempts = 3;

TaskHandle_t wifiTaskHandle = NULL;
TaskHandle_t sensorTaskHandle = NULL;

unsigned long lastUpdate = 0;
unsigned long lastBlink = 0;
bool blinkWiFi = false;

const unsigned long updateInterval = 1000;  // كل 1 ثانية

// pages: 0 = main, 1 = wifi details, 2 = set time
int currentPage = 0;
const int totalPages = 3;

// sleep (logical, screen stays on)
bool sleepMode = false;
unsigned long sleepStart = 0;
const unsigned long sleepTriggerIdle = 60000UL;  // 1 minute
unsigned long bootMillis = 0;

// helper for keypad (active low)
inline bool buttonPressed(int pin) {
  return digitalRead(pin) == LOW;
}

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

void drawHeader() {
  u8g2.setFont(u8g2_font_6x10_tf);
  if (rtcOK) {
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
  if (sleepMode) drawSleepIcon(98, 14);

  // Battery icon + % (مكانها مختار بحيث لا تتعارض مع WiFi)
  drawBatteryIcon(72, 14, batteryPercent);
  u8g2.setFont(u8g2_font_6x10_tf);
  char batStr[8];
  snprintf(batStr, sizeof(batStr), "%d%%", batteryPercent);
  // ارسم النص يمين الأيقونة (قد تحتاج ضبط الإحداثي Y لو خط مختلف)
  u8g2.drawStr(79, 14, batStr);
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

// ---------- WiFi ----------
void startAPMode() {
  apMode = true;
  WiFi.mode(WIFI_AP_STA);  // نفعّل الـ AP وأيضًا STA للبحث عن الشبكات
  WiFi.softAP("DL100_Setup");

  // صفحة الإعداد
  server.on("/", []() {
    // 1️⃣ مسح الشبكات القريبة
    int n = WiFi.scanNetworks();
    String options = "";
    if (n == 0) {
      options = "<option disabled>لم يتم العثور على شبكات</option>";
    } else {
      for (int i = 0; i < n; ++i) {
        String ssid = WiFi.SSID(i);
        int rssi = WiFi.RSSI(i);
        int quality = map(rssi, -90, -30, 0, 100);
        options += "<option value='" + ssid + "'>" + ssid + " (" + String(quality) + "%)</option>";
      }
    }

    // 2️⃣ صفحة HTML
    String page = R"rawliteral(
      <html><head>
      <meta charset='UTF-8'>
      <title>إعداد Wi-Fi</title>
      </head><body style='font-family:Arial;'>
        <h2>🛠 إعداد اتصال Wi-Fi</h2>
        <form action='/save' method='post'>
          <label>اختر الشبكة:</label><br>
          <select name='ssid' required>
    )rawliteral" + options
                  + R"rawliteral(
          </select><br><br>
          <label>كلمة المرور:</label><br>
          <input type='password' name='pass'><br><br>
          <label>IP السيرفر:</label><br>
          <input type='text' name='server' placeholder='مثال: 192.168.1.50'><br><br>
          <input type='submit' value='حفظ & اتصال'>
        </form>
      </body></html>
    )rawliteral";

    server.send(200, "text/html", page);
  });

  // حفظ البيانات عند الإرسال
  server.on("/save", []() {
    String newSSID = server.arg("ssid");
    String newPASS = server.arg("pass");
    String newSERVER = server.arg("server");

    preferences.begin("wifi", false);
    preferences.putString("ssid", newSSID);
    preferences.putString("pass", newPASS);
    preferences.putString("server", newSERVER);
    preferences.end();

    server.send(200, "text/html", "<h3>✅ تم الحفظ! أعد التشغيل الآن.</h3>");
    delay(1500);
    ESP.restart();
  });

  server.begin();
  message = "AP Mode (Setup Wi-Fi)";
  messageShownSince = millis();
}

void sensorTask(void *parameter) {
  while (1) {
    unsigned long now = millis();
    if (now - lastUpdate >= 60000UL || lastUpdate == 0) {
      if (bmeOK) {
        temperature = bme.readTemperature();
        humidity = bme.readHumidity();
      }
      lastUpdate = now;

      Serial.println("[DEBUG] Token: " + getToken());
      // ✅ لو في اتصال Wi-Fi فعّال، ابعت القراءات للسيرفر
      if (WiFi.status() == WL_CONNECTED && getToken() != "") {
        int analogValue = analogRead(34); // غيّر البن لو مختلف
        float voltage = (analogValue / 4095.0) * 3.3 * 2; // *2 لو في مقسم جهد
        int batteryPercent = map(voltage * 100, 330, 420, 0, 100);
        batteryPercent = constrain(batteryPercent, 0, 100);

        Serial.println("[SENSOR] Sending reading...");
        sendReading(temperature, humidity, batteryPercent);
      } else {
        Serial.println("[SENSOR] WiFi not connected or token missing, skip sending");
      }
    }
    vTaskDelay(1000 / portTICK_PERIOD_MS);
  }
}

void connectToWiFiTask(void *parameter) {
  // read stored wifi/server settings
  preferences.begin("wifi", true);
  ssid = preferences.getString("ssid", "");
  password = preferences.getString("pass", "");
  serverIP = preferences.getString("server", "");
  preferences.end();

  Serial.printf("Saved SSID: '%s'  server: '%s'\n", ssid.c_str(), serverIP.c_str());

  if (ssid == "" || serverIP == "") {
    Serial.println("No SSID or server saved -> starting AP");
    startAPMode();
    vTaskDelete(NULL);
    return;
  }

  int attempt = 1;
  while (attempt <= maxAttempts) {
    WiFi.mode(WIFI_STA);
    WiFi.begin(ssid.c_str(), password.c_str());
    unsigned long startAttempt = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - startAttempt < 10000) {
      delay(250);
    }

    if (WiFi.status() == WL_CONNECTED) {
      wifiConnected = true;
      apMode = false;
      message = "Wi-Fi Connected";
      messageShownSince = millis();
      Serial.print("Connected. Local IP: ");
      Serial.println(WiFi.localIP());
      // now we can initialize baseUrl from stored serverIP and optionally update token
      initServerAddress(); // uses preferences.getString("server", "")
      // fetch token now that we are connected
      if (updateTokenFromServer()) {
        Serial.println("✅ Token fetched successfully after WiFi");
        registered = checkIfRegistered();
        if (registered) {
          Serial.println("✅ Device is registered. Starting normal mode...");
        } else {
          Serial.println("🔍 Device not registered. Entering discovery mode...");
        }
      } else Serial.println("⚠ Token fetch failed after WiFi");
      vTaskDelete(NULL);
      return;
    } else {
      Serial.printf("WiFi attempt %d failed\n", attempt);
      attempt++;
    }
  }

  Serial.println("All WiFi attempts failed -> start AP");
  startAPMode();
  vTaskDelete(NULL);
}


void initServerAddress() {
  preferences.begin("wifi", true);
  baseUrl = preferences.getString("server", "");
  preferences.end();

  if (baseUrl == "") {
    Serial.println("⚠ لا يوجد عنوان سيرفر محفوظ!");
    return;
  }

  // تأكد من وجود http://
  if (!baseUrl.startsWith("http://") && !baseUrl.startsWith("https://")) {
    baseUrl = "http://" + baseUrl;
  }

  // تأكد من وجود :8000
  if (baseUrl.indexOf(":8000") == -1) {
    if (baseUrl.endsWith("/")) baseUrl.remove(baseUrl.length() - 1);
    baseUrl += ":8000";
  }

  // تأكد من وجود / في الآخر
  if (!baseUrl.endsWith("/")) baseUrl += "/";

  Serial.println("🌐 BASE_URL = " + baseUrl);
}


// 🔐 جلب التوكين من السيرفر
bool updateTokenFromServer() {
  if (WiFi.status() != WL_CONNECTED) return false;

  HTTPClient http;
  String url = baseUrl + "auth/login/";
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
      preferences.begin("auth", false);
      String savedToken = preferences.getString("token", "");
      if (savedToken != newToken) {
        preferences.putString("token", newToken);
        Serial.println("🔑 Token updated!");
      } else {
        Serial.println("🔒 Token unchanged.");
      }
      preferences.end();
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
  preferences.begin("auth", true);
  String token = preferences.getString("token", "");
  preferences.end();
  return token;
}

// ⏱ التحقق من تحديث التوكين كل ساعة
unsigned long lastTokenCheck = 0;
const unsigned long TOKEN_CHECK_INTERVAL = 3600000;  // كل ساعة


// ==================================================
// التحقق هل الجهاز مسجل في السيرفر
// ==================================================
bool checkIfRegistered() {
  HTTPClient http;
  device_id = WiFi.macAddress();
  String url = baseUrl + "registered/" + device_id + "/";
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
  String url = baseUrl + "discover/";
  http.begin(url);
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
  String url = baseUrl;
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", "Token " + getToken());

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

  drawTemperatureIcon(10, 20);
  u8g2.setFont(u8g2_font_fub11_tf);
  char tmp[12];
  snprintf(tmp, sizeof(tmp), "%.1f", temperature);
  int tempW = u8g2.getStrWidth(tmp);
  u8g2.setCursor(28, 32);
  u8g2.print(tmp);
  u8g2.setFont(u8g2_font_6x10_tf);
  u8g2.setCursor(28 + tempW + 2, 32);
  u8g2.print("\260C");

  drawHumidityIcon(10, 39);
  snprintf(tmp, sizeof(tmp), "%.1f", humidity);
  u8g2.setFont(u8g2_font_fub11_tf);
  u8g2.setCursor(28, 51);
  u8g2.print(tmp);
  u8g2.setFont(u8g2_font_7x14_tf);
  u8g2.setCursor(28 + u8g2.getStrWidth(tmp) + 12, 51);
  u8g2.print("%");

  u8g2.sendBuffer();
}

// قراءة الجهد عند الـ ADC (بعد المقسم) وحسابه للبطارية
float readBatteryVoltage_raw() {
  int raw = analogRead(BAT_PIN);
  float v_adc = (raw / (float)ADC_MAX) * ADC_REF;    // فولت على مدخل ADC
  float vin = v_adc * ((R1_BAT + R2_BAT) / R2_BAT);  // فولت البطارية قبل المقسم
  vin *= batteryCalibration;                         // تطبيق عامل معايرة إن لزم
  return vin;
}

// متوسط عينات لتقليل الضجيج
float readBatteryVoltage() {
  const int samples = 6;
  float sum = 0;
  for (int i = 0; i < samples; ++i) {
    sum += readBatteryVoltage_raw();
    delay(5);
  }
  return sum / samples;
}

// تحويل جهد البطارية لنسبة (3.0V -> 0% , 4.2V -> 100%)
int batteryPercentageFromVoltage(float voltage) {
  const float Vmin = 3.0;
  const float Vmax = 4.19;
  float pct = (voltage - Vmin) / (Vmax - Vmin) * 100.0;
  if (pct < 0) pct = 0;
  if (pct > 100) pct = 100;
  return (int)(pct + 0.5);
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



// ---------- Setup ----------
void setup() {
  Serial.begin(115200);

  // battery ADC setup
  analogSetPinAttenuation(BAT_PIN, ADC_11db);  // تمديد مدى القياس لـ ~3.9V
  // لا حاجة لـ pinMode على بن ADC


  pinMode(BTN_UP, INPUT_PULLUP);
  pinMode(BTN_DOWN, INPUT_PULLUP);
  pinMode(BTN_LEFT, INPUT_PULLUP);
  pinMode(BTN_RIGHT, INPUT_PULLUP);
  pinMode(BTN_SEL, INPUT_PULLUP);

  Wire.begin();
  u8g2.begin();

  rtcOK = rtc.begin();
  bmeOK = bme.begin(0x76);

  showSplashScreen();
  bootMillis = millis();

  xTaskCreatePinnedToCore(connectToWiFiTask, "WiFiTask", 4096, NULL, 1, &wifiTaskHandle, 0);
  xTaskCreatePinnedToCore(sensorTask, "SensorTask", 2048, NULL, 1, &sensorTaskHandle, 1);
}

void stopWiFiForSleep() {
  server.stop();
  WiFi.disconnect(true);
  WiFi.mode(WIFI_OFF);
  wifiConnected = false;
}

void startWiFiAfterWake() {
  delay(200);
  xTaskCreatePinnedToCore(connectToWiFiTask, "WiFiTask", 4096, NULL, 1, &wifiTaskHandle, 0);
}

// ---------- Loop ----------
void loop() {
  unsigned long now = millis();
  static bool justRegistered = false;

  // تحديث حالة الواي فاي
  if (now - lastWiFiCheck >= WIFI_CHECK_INTERVAL) {
    lastWiFiCheck = now;
    wifiConnected = (WiFi.status() == WL_CONNECTED);
    wifiSignalStrength = wifiConnected ? WiFi.RSSI() : 0;
  }

  // تحديث التوكين كل ساعة
  if (millis() - lastTokenCheck >= TOKEN_CHECK_INTERVAL) {
    lastTokenCheck = millis();
    updateTokenFromServer();
  }


  server.handleClient();

  // فحص الاتصال بالواي فاي
  if (millis() - lastWiFiCheck > WIFI_CHECK_INTERVAL) {
    lastWiFiCheck = millis();

    if (!apMode) {  // فقط لما نكون في وضع الاتصال العادي
      if (WiFi.status() != WL_CONNECTED) {
        if (wifiDisconnectedSince == 0) wifiDisconnectedSince = millis();

        if (millis() - wifiDisconnectedSince > WIFI_RECONNECT_TIMEOUT) {
          Serial.println("⚠ الاتصال مفقود.. التحول إلى Access Point");
          WiFi.disconnect(true);
          startAPMode();
        }
      } else {
        wifiDisconnectedSince = 0;  // رجع الاتصال، نعيد العداد
      }
    }
  }

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
  }

  // Blinking Wi-Fi icon
  if (now - lastBlink >= 500) {
    blinkWiFi = !blinkWiFi;
    lastBlink = now;
  }

  // Auto sleep
  if (!sleepMode && (now - bootMillis >= sleepTriggerIdle)) {
    sleepMode = true;
    sleepStart = now;
    if (sensorTaskHandle != NULL) vTaskSuspend(sensorTaskHandle);
    stopWiFiForSleep();
    message = "Sleep mode";
    messageShownSince = now;
  }

  // التحقق من الدخول في وضع السليب
  // الدخول في وضع السليب بعد دقيقة من التشغيل أو آخر نشاط
  if (!sleepMode && (now - bootMillis >= sleepTriggerIdle)) {
    sleepMode = true;
    sleepStart = now;

    // إيقاف المهام الغير ضرورية
    if (sensorTaskHandle != NULL) {
      vTaskSuspend(sensorTaskHandle);
    }
    stopWiFiForSleep();

    // إظهار رسالة السليب
    message = "Sleep mode";
    messageShownSince = now;
  }

  // الخروج التلقائي من السليب بعد دقيقة واحدة
  const unsigned long sleepDuration = 60000UL;  // مدة السليب (1 دقيقة)
  if (sleepMode && (now - sleepStart >= sleepDuration)) {
    sleepMode = false;
    bootMillis = millis();  // إعادة العد من البداية

    // استئناف الحساس والـ WiFi
    if (sensorTaskHandle != NULL) {
      vTaskResume(sensorTaskHandle);
    }
    startWiFiAfterWake();

    // إظهار رسالة استيقاظ
    message = "Wake up";
    messageShownSince = millis();
  }





  // ---- Battery periodic update ----
  if (millis() - lastBatteryUpdate >= batteryUpdateInterval) {
    lastBatteryUpdate = millis();
    batteryVoltage = readBatteryVoltage();
    batteryPercent = batteryPercentageFromVoltage(batteryVoltage);

    // للمساعدة في المعايرة أثناء التطوير: اطبع على Serial
    Serial.print("BAT V = ");
    Serial.print(batteryVoltage, 3);
    Serial.print(" V  | % = ");
    Serial.println(batteryPercent);
  }

  // ---- Battery reading update ----
  //unsigned long now = millis();
  if (now - lastBatteryUpdate >= batteryUpdateInterval) {
    lastBatteryUpdate = now;

    // قراءة الـ ADC
    int adcRaw = analogRead(BAT_PIN);

    // تحويلها لفولت على مدخل ADC
    float vAdc = (adcRaw * ADC_REF) / ADC_MAX;

    // حساب فولت البطارية الحقيقي (بعد المقسم)
    batteryVoltage = vAdc * ((R1_BAT + R2_BAT) / R2_BAT) * batteryCalibration;

    // تحويل الفولت إلى نسبة مئوية (من 3.0V = 0% إلى 4.2V = 100%)
    if (batteryVoltage >= 4.2) batteryPercent = 100;
    else if (batteryVoltage <= 3.0) batteryPercent = 0;
    else batteryPercent = (int)(((batteryVoltage - 3.0) / (4.2 - 3.0)) * 100.0);

    // تصحيح القيم لو خرجت عن المدى
    if (batteryPercent > 100) batteryPercent = 100;
    if (batteryPercent < 0) batteryPercent = 0;
  }


  // Buttons
  if (buttonPressed(BTN_RIGHT)) {
    currentPage = (currentPage + 1) % totalPages;
    delay(200);
  }

  else if (buttonPressed(BTN_LEFT)) {
    if (sleepMode) {
      if (currentPage == 0) {
        // 😴 إذا الجهاز نايم والصفحة الرئيسية → صحّيه
        sleepMode = false;
        if (sensorTaskHandle != NULL) {
          vTaskResume(sensorTaskHandle);
        }
        startWiFiAfterWake();
        message = "Wake up";
        messageShownSince = millis();
        bootMillis = millis();  // أعد تشغيل مؤقت الخمول
        delay(300);
      } else {
        // 😌 لو الجهاز نايم بس في صفحة تانية → رجوع عادي بدون إلغاء السليب
        currentPage--;
        if (currentPage < 0) currentPage = totalPages - 1;
        delay(200);
      }
    } else {
      // 🔆 الجهاز مش نايم → رجوع عادي
      currentPage--;
      if (currentPage < 0) currentPage = totalPages - 1;
      delay(200);
    }
  }
  // تحديث الهيدر كل ثانية
  static unsigned long lastHeaderUpdate = 0;
  if (now - lastHeaderUpdate >= 1000) {
    lastHeaderUpdate = now;
    u8g2.setDrawColor(0);
    u8g2.drawBox(0, 0, 128, 16);
    u8g2.setDrawColor(1);
    drawHeader();
    u8g2.sendBuffer();
  }

  // عرض الصفحات حسب الرقم الحالي
  if (currentPage == 0 && !sleepMode) {
    unsigned long currentMillis = millis();
    if (currentMillis - lastUpdate >= updateInterval) {
      lastUpdate = currentMillis;
      temperature = bme.readTemperature();
      humidity = bme.readHumidity();
    }
    drawMainPage();  // عرض الصفحة الرئيسية دائمًا
  } else if (currentPage == 1) {
    drawWiFiDetailsPage();  // صفحة تفاصيل الواي فاي
  } else if (currentPage == 2) {
    bool saved = handleTimeSetPage();
    currentPage = 0;
    bootMillis = millis();
    sleepMode = false;
  }

  // تحديث الصفحة الحالية حتى في وضع السليب (لإعادة رسم المحتوى عند التنقل)
  if (sleepMode) {
    if (currentPage == 0) {
      drawMainPage();  // رسم الصفحة الرئيسية بالقيم القديمة
    } else if (currentPage == 1) {
      drawWiFiDetailsPage();  // رسم صفحة الواي فاي
    } else if (currentPage == 2) {
      // مش بنرسم صفحة الوقت هنا لأنها بتتحدث ذاتياً
    }
    delay(100);
  }
}