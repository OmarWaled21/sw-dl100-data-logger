#include <WiFi.h>
#include <WebServer.h>
#include <DNSServer.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <Update.h>
#include <mbedtls/sha256.h>
#include <ArduinoJson.h>
#include <Adafruit_Sensor.h>
// #include <Adafruit_BME280.h>
#include <U8g2lib.h>
#include <RTClib.h>
#include <Preferences.h>
#include <Wire.h>

// =========== تعريف الثوابت والمتغيرات العامة ===========

// تعريف أزرار التحكم
#define BTN_UP 32
#define BTN_DOWN 33
#define BTN_LEFT 25
#define BTN_RIGHT 26
#define BTN_SEL 27

// تعريف البازر
#define BUZZER_PIN 14

// تعريف الفترات الزمنية للمهام
#define BATTERY_UPDATE_INTERVAL 30000UL  // كل 30 ثانية
#define SENSOR_UPDATE_INTERVAL 60000UL  // كل دقيقة
#define DISPLAY_UPDATE_INTERVAL 1000UL  // كل 1 ثانية

// تعريف فترات السليب
#define SLEEP_TRIGGER_IDLE 30000UL      // بعد 30 ثانية خمول
#define SLEEP_DURATION 60000UL         // مدة السليب دقيقة (الاستيقاظ التلقائي)
#define LONG_PRESS_DURATION 2000UL      // ضغط مطول 2 ثانية

unsigned long  SAVE_UPDATE_INTERVAL = 5 * 60000UL;  // كل 5 دقائق
unsigned long  WIFI_UPDATE_INTERVAL = 20 * 60000UL;   // كل 20 دقيقة
int wifiIntervalMinutes = 20;  // عدد الدقائق لاتصال WiFi
int localIntervalMinutes = 5;  // عدد الدقائق للحفظ المحلي

// تعريف أجهزة الاستشعار والعرض
U8G2_ST7920_128X64_F_SW_SPI u8g2(U8G2_R0, 15, 2, 13, U8X8_PIN_NONE);
RTC_DS3231 rtc;
// Adafruit_BME280 bme;
WebServer server(80);
DNSServer dnsServer;
Preferences prefs;

// =========== متغيرات النظام ===========

// إعدادات الشبكة
String baseUrl, ssid, password;
bool wifiConnected = false;

// بيانات المستشعرات
float temperature = 0.0, humidity = 0.0, batteryVoltage = 0.0;
int batteryPercent = 0, wifiSignalStrength = 0;

float lastSavedTemp = -999, lastSavedHum = -999;

// حالة النظام
bool rtcOK = false, bmeOK = false, sleepMode = false, blinkWiFi = false;
volatile bool sleepLocked = false, instantSyncRequested = false, wifiNeedsRun = false;
int currentPage = 0;  // 0=رئيسي, 1=شبكة, 2=ضبط وقت
const int totalPages = 3;

// توقيت النظام
unsigned long lastSensorUpdate = 0, lastBlink = 0, lastBatteryUpdate = 0;
unsigned long lastWiFiUpdate = 0, lastSaveUpdate = 0, lastDisplayUpdate = 0;
unsigned long bootMillis = 0, sleepStart = 0, messageShownSince = 0;
unsigned long lastUserActivity = 0, selButtonPressTime = 0;
bool selButtonPressed = false;

// المهام
TaskHandle_t wifiTaskHandle = NULL, sensorTaskHandle = NULL, displayTaskHandle = NULL;

// الرسائل
String message = "";

// ================= معلومات عن الجهاز =================
String name = "";
const char *firmwareType = "HT";  // HT or T
const char *currentVersion = "1.0.0";

// ================= الحدود =================
float minTemp, maxTemp, minHum, maxHum;

// ================= بيانات هل الجهاز مستجل في السيرفر ولا لا =================
bool registered = false;  // false = discover mode, true = normal mode
bool savingNow = false;

// =========== دوال المساعدة ===========

/**
 * التحقق من ضغط الزر (منطق فعال منخفض)
 */
inline bool buttonPressed(int pin) {
  return digitalRead(pin) == LOW;
}

/**
 * تحديث وقت النشاط الأخير للمستخدم
 */
void updateUserActivity() {
  lastUserActivity = millis();
  if (sleepMode) {
    // استيقاظ من السليب
    sleepMode = false;
    bootMillis = millis();
    message = "Wake up";
    messageShownSince = millis();
    Serial.println("🌞 استيقاظ من السليب بواسطة المستخدم");
  }
}

/**
 * الكشف عن الضغط المطول على زر SELECT
 */
bool checkLongPress() {
  if (buttonPressed(BTN_SEL)) {
    if (!selButtonPressed) {
      // بداية الضغط
      selButtonPressed = true;
      selButtonPressTime = millis();
      updateUserActivity();
    } else {
      // استمرار الضغط - التحقق من المدة
      if (millis() - selButtonPressTime >= LONG_PRESS_DURATION) {
        selButtonPressed = false;
        return true;
      }
    }
  } else {
    selButtonPressed = false;
  }
  return false;
}

/**
 * مسح إعدادات الواي فاي والدخول إلى وضع الإعداد
 */
void enterSetupMode() {
  Serial.println("🔧 دخول وضع الإعداد - مسح الإعدادات السابقة");

  // مسح إعدادات الواي فاي
  prefs.begin("wifi", false);
  prefs.remove("ssid");
  prefs.remove("password");
  prefs.remove("server_url");
  prefs.end();

  // مسح التوكن
  prefs.begin("auth", false);
  prefs.remove("token");
  prefs.end();

  Serial.println("✅ تم مسح جميع الإعدادات السابقة");

  // إيقاف جميع المهام
  if (wifiTaskHandle != NULL) vTaskDelete(wifiTaskHandle);
  if (sensorTaskHandle != NULL) vTaskDelete(sensorTaskHandle);
  if (displayTaskHandle != NULL) vTaskDelete(displayTaskHandle);

  // إعادة تشغيل النظام لدخول وضع الإعداد
  ESP.restart();
}

/**
 * عرض رسالة تأكيد الدخول إلى وضع الإعداد
 */
void showSetupConfirmation() {
  u8g2.clearBuffer();
  u8g2.setFont(u8g2_font_6x12_tf);
  u8g2.drawStr(10, 20, "Setup Mode?");
  u8g2.drawStr(10, 35, "Hold 2s to confirm");
  u8g2.drawStr(10, 50, "Release to cancel");
  u8g2.sendBuffer();

  unsigned long confirmationStart = millis();
  bool confirmed = false;

  while (millis() - confirmationStart < 3000) {
    if (checkLongPress()) {
      confirmed = true;
      break;
    }

    // إذا تم تحرير الزر، إلغاء العملية
    if (!buttonPressed(BTN_SEL)) {
      break;
    }

    vTaskDelay(50 / portTICK_PERIOD_MS);
  }

  if (confirmed) {
    enterSetupMode();
  } else {
    // عرض رسالة الإلغاء
    u8g2.clearBuffer();
    u8g2.setFont(u8g2_font_6x12_tf);
    u8g2.drawStr(20, 35, "Setup Cancelled");
    u8g2.sendBuffer();
    vTaskDelay(1000 / portTICK_PERIOD_MS);
  }
}

/**
 * إعداد الأزرار للاستيقاظ من Light Sleep
 */
void setupWakeupButtons() {
  // تفعيل الاستيقاظ بزرار SEL فقط
  esp_sleep_enable_ext0_wakeup((gpio_num_t)BTN_SEL, 0);  // فعال منخفض
}

/**
 * الدخول في وضع Light Sleep مع مؤقت
 */
void enterLightSleep() {
  sleepMode = true;
  Serial.println("💤 دخول وضع Light Sleep");
  drawHeader();
  u8g2.sendBuffer();

  Serial.flush();

  // تجهيز أزرار الاستيقاظ
  setupWakeupButtons();

  // ⭐ إضافة مؤقت الاستيقاظ الحقيقي (هاردوير)
  esp_sleep_enable_timer_wakeup(SLEEP_DURATION * 1000ULL);  
  // SLEEP_DURATION بالمللي → يتحول للـ ميكرو ثانية

  sleepStart = millis();

  Serial.printf("⏰ تايمر الاستيقاظ بعد: %d ثانية\n", SLEEP_DURATION / 1000);
  
  WiFi.disconnect(true);
  WiFi.mode(WIFI_OFF);

  // دخول Light Sleep الحقيقي
  esp_light_sleep_start();

  // معرفة مصدر الاستيقاظ
  esp_sleep_wakeup_cause_t wakeCause = esp_sleep_get_wakeup_cause();

  if (wakeCause == ESP_SLEEP_WAKEUP_EXT0) {
    Serial.println("👉 Wakeup by BTN_SEL → Request Instant Sync");
    instantSyncRequested = true;
  }

  // هنا يرجع التنفيذ بعد الاستيقاظ الحقيقي
  unsigned long slept = millis() - sleepStart;

  Serial.printf("🌞 استيقاظ من Light Sleep بعد %d ثانية\n", slept / 1000);
  vTaskDelay(1200 / portTICK_PERIOD_MS);   // ⚠ مهم جداً

  sleepMode = false;
  bootMillis = millis();
  lastUserActivity = millis();

  // استئناف المهمة
  if (sensorTaskHandle != NULL) vTaskResume(sensorTaskHandle);
  if (displayTaskHandle != NULL) vTaskResume(displayTaskHandle);
}

/**
 * إدارة وضع السليب والاستيقاظ
 */
void manageSleepMode() {
  unsigned long now = millis();

  // ممنوع النوم لو هناك مهمة مهمة شغالة
  if (sleepLocked) {
    // إعادة ضبط العداد عشان النوم ميبدأش
    lastUserActivity = millis();
    return;
  }

  // الدخول في السليب بعد فترة خمول
  if (!sleepMode && (now - lastUserActivity >= SLEEP_TRIGGER_IDLE)) {
    sleepMode = true;
    sleepStart = now;
    message = "Sleep mode";
    messageShownSince = now;
    Serial.println("💤 [System] - دخول وضع السليب بعد 30 ثانية من الخمول");

    // الدخول في Light Sleep
    enterLightSleep();
  }
}

/**
 * رسم أيقونة الحرارة
 */
void drawTemperatureIcon(int x, int y) {
  u8g2.drawFrame(x, y, 7, 12);
  u8g2.drawBox(x + 2, y + 3, 3, 6);
  u8g2.drawDisc(x + 3, y + 11, 3);
}

/**
 * رسم أيقونة الرطوبة
 */
void drawHumidityIcon(int x, int y) {
  u8g2.drawTriangle(x + 4, y, x, y + 8, x + 8, y + 8);
  u8g2.drawDisc(x + 4, y + 8, 4);
}

/**
 * رسم أيقونة قوة إشارة الواي فاي
 */
void drawWiFiStrengthIcon(int x, int y) {
  wl_status_t status = WiFi.status();
  bool connectedNow = (status == WL_CONNECTED);

  // رسم X إذا غير متصل وغير وامض
  if (!connectedNow && !blinkWiFi) {
    u8g2.drawLine(x, y - 8, x + 8, y);
    u8g2.drawLine(x + 8, y - 8, x, y);
    return;
  }

  // رسم أشرطة قوة الإشارة حسب شدة الـ RSSI
  long rssi = WiFi.RSSI();
  if (rssi >= -67) {  // إشارة ممتازة
    u8g2.drawBox(x, y - 2, 2, 2);
    u8g2.drawBox(x + 3, y - 4, 2, 4);
    u8g2.drawBox(x + 6, y - 6, 2, 6);
    u8g2.drawBox(x + 9, y - 8, 2, 8);
  } else if (rssi >= -70) {  // إشارة جيدة
    u8g2.drawBox(x, y - 2, 2, 2);
    u8g2.drawBox(x + 3, y - 4, 2, 4);
    u8g2.drawBox(x + 6, y - 6, 2, 6);
  } else if (rssi >= -80) {  // إشارة متوسطة
    u8g2.drawBox(x, y - 2, 2, 2);
    u8g2.drawBox(x + 3, y - 4, 2, 4);
  } else {  // إشارة ضعيفة
    u8g2.drawBox(x, y - 2, 2, 2);
  }
}

/**
 * رسم أيقونة النوم
 */
void drawSleepIcon(int x, int y) {
  u8g2.setFont(u8g2_font_6x10_tf);
  u8g2.drawStr(x + 8, y - 1, "Zz");
}

/**
 * رسم أيقونة البطارية مع النسبة
 */
void drawBatteryIcon(int x, int y, int level) {
  y -= 10;
  u8g2.drawFrame(x, y, 6, 10);       // جسم البطارية
  u8g2.drawBox(x + 1, y - 1, 4, 1);  // الطرف العلوي

  // تعبئة البطارية من الأسفل للأعلى
  int fillHeight = map(level, 0, 100, 0, 10);
  u8g2.drawBox(x + 1, y + (10 - fillHeight), 4, fillHeight);
}

/**
 * رسم الهيدر العلوي (وقت, تاريخ, بطارية, واي فاي)
 */
void drawHeader() {
  u8g2.setFont(u8g2_font_6x10_tf);

  // عرض الوقت والتاريخ
  if (rtcOK) {
    DateTime now = rtc.now();
    char timeStr[6], dateStr[6];
    snprintf(timeStr, sizeof(timeStr), "%02d:%02d", now.hour(), now.minute());
    snprintf(dateStr, sizeof(dateStr), "%02d/%02d", now.day(), now.month());

    int timeWidth = u8g2.getStrWidth(timeStr);
    u8g2.drawStr((128 - timeWidth) / 2 - 10, 14, timeStr);
    u8g2.drawStr(3, 14, dateStr);
  } else {
    Serial.println("RTC NOT INITIAILIZED");
    u8g2.drawStr((128 - 40) / 2, 14, "--:--");
    u8g2.drawStr(4, 14, "--/--");
  }

  // عرض أيقونات النظام
  drawWiFiStrengthIcon(110, 14);
  if (sleepMode) drawSleepIcon(98, 14);

  // عرض البطارية
  drawBatteryIcon(72, 14, batteryPercent);
  char batStr[8];
  snprintf(batStr, sizeof(batStr), "%d%%", batteryPercent);
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

// =========== دوال واجهة المستخدم ===========

/**
 * عرض شاشة البداية
 */
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
  vTaskDelay(2000 / portTICK_PERIOD_MS);
}

/**
 * رسم الصفحة الرئيسية
 */
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

/**
 * رسم صفحة تفاصيل الشبكة
 */
void drawWiFiDetailsPage() {
  u8g2.clearBuffer();
  drawHeader();
  u8g2.drawHLine(0, 16, 128);
  u8g2.setFont(u8g2_font_6x10_tf);

  wl_status_t status = WiFi.status();
  bool connectedNow = (status == WL_CONNECTED);
  String ssidShown = connectedNow ? WiFi.SSID() : "--";

  u8g2.drawStr(6, 30, ("SSID: " + ssidShown).c_str());

  if (connectedNow) {
    u8g2.drawStr(6, 44, "Status: Connected");
    u8g2.drawStr(6, 58, ("IP: " + WiFi.localIP().toString()).c_str());
  } else {
    u8g2.drawStr(6, 44, "Status: Disconnected");
    u8g2.drawStr(6, 58, "IP: --.--.--.--");
  }

  u8g2.sendBuffer();
}

/**
 * معالج صفحة ضبط الوقت (تفاعلي)
 */
bool handleTimeSetPage() {
  DateTime now = rtc.now();
  int editHour = now.hour(), editMin = now.minute();
  int editDay = now.day(), editMon = now.month();
  int field = 0;  // 0=ساعة, 1=دقيقة, 2=يوم, 3=شهر
  unsigned long lastDraw = 0;

  while (true) {
    // إعادة الرسم كل 100 مللي
    if (millis() - lastDraw > 100) {
      u8g2.clearBuffer();
      u8g2.setFont(u8g2_font_6x12_tf);
      u8g2.drawStr(20, 10, "Set Time & Date");
      u8g2.drawHLine(0, 12, 128);

      u8g2.setFont(u8g2_font_6x10_tf);

      // عرض الوقت مع التظليل
      if (field == 0) {
        u8g2.drawBox(2, 18, 20, 12);
        u8g2.setDrawColor(0);
        u8g2.setCursor(4, 28);
        u8g2.printf("%02d", editHour);
        u8g2.setDrawColor(1);
        u8g2.setCursor(24, 28);
        u8g2.printf(":%02d", editMin);
      } else if (field == 1) {
        u8g2.setCursor(4, 28);
        u8g2.printf("%02d:", editHour);
        u8g2.drawBox(24, 18, 20, 12);
        u8g2.setDrawColor(0);
        u8g2.setCursor(26, 28);
        u8g2.printf("%02d", editMin);
        u8g2.setDrawColor(1);
      } else {
        u8g2.setCursor(4, 28);
        u8g2.printf("%02d:%02d", editHour, editMin);
      }

      // عرض التاريخ مع التظليل
      if (field == 2) {
        u8g2.drawBox(54, 18, 20, 12);
        u8g2.setDrawColor(0);
        u8g2.setCursor(56, 28);
        u8g2.printf("%02d", editDay);
        u8g2.setDrawColor(1);
        u8g2.setCursor(76, 28);
        u8g2.printf("/%02d", editMon);
      } else if (field == 3) {
        u8g2.setCursor(56, 28);
        u8g2.printf("%02d/", editDay);
        u8g2.drawBox(76, 18, 20, 12);
        u8g2.setDrawColor(0);
        u8g2.setCursor(78, 28);
        u8g2.printf("%02d", editMon);
        u8g2.setDrawColor(1);
      } else {
        u8g2.setCursor(56, 28);
        u8g2.printf("%02d/%02d", editDay, editMon);
      }

      u8g2.setCursor(4, 48);
      u8g2.print("LEFT=Exit  SEL=Save");
      u8g2.sendBuffer();
      lastDraw = millis();
    }

    // معالجة الأزرار
    if (buttonPressed(BTN_UP)) {
      updateUserActivity();
      if (field == 0) editHour = (editHour + 1) % 24;
      else if (field == 1) editMin = (editMin + 1) % 60;
      else if (field == 2) editDay = (editDay % 31) + 1;
      else if (field == 3) editMon = (editMon % 12) + 1;
      vTaskDelay(150 / portTICK_PERIOD_MS);
    }

    if (buttonPressed(BTN_DOWN)) {
      updateUserActivity();
      if (field == 0) editHour = (editHour + 23) % 24;
      else if (field == 1) editMin = (editMin + 59) % 60;
      else if (field == 2) editDay = (editDay + 30) % 31 + 1;
      else if (field == 3) editMon = (editMon + 11) % 12 + 1;
      vTaskDelay(150 / portTICK_PERIOD_MS);
    }

    if (buttonPressed(BTN_RIGHT)) {
      updateUserActivity();
      field = (field + 1) % 4;
      vTaskDelay(150 / portTICK_PERIOD_MS);
    }

    if (buttonPressed(BTN_LEFT)) {
      updateUserActivity();
      vTaskDelay(150 / portTICK_PERIOD_MS);
      return false;  // خروج بدون حفظ
    }

    if (buttonPressed(BTN_SEL)) {
      updateUserActivity();
      int year = (rtc.now().year() > 2000) ? rtc.now().year() : 2025;
      rtc.adjust(DateTime(year, editMon, editDay, editHour, editMin, 0));
      vTaskDelay(200 / portTICK_PERIOD_MS);
      return true;  // حفظ وخروج
    }

    vTaskDelay(20 / portTICK_PERIOD_MS);
  }
}

// =========== دوال إدارة الطاقة ===========
/**
 * قراءة جهد البطارية من ADC
 */
float readBatteryVoltage() {
  const int BAT_PIN = 34;
  const float R1_BAT = 2700.0, R2_BAT = 10000.0;
  const int ADC_MAX = 4095;
  const float ADC_REF = 3.3;
  const float batteryCalibration = 1.0;

  // متوسط 6 عينات لتقليل الضجيج
  const int samples = 6;
  float sum = 0;

  for (int i = 0; i < samples; ++i) {
    int raw = analogRead(BAT_PIN);
    float v_adc = (raw / (float)ADC_MAX) * ADC_REF;
    float vin = v_adc * ((R1_BAT + R2_BAT) / R2_BAT) * batteryCalibration;
    sum += vin;
    vTaskDelay(5 / portTICK_PERIOD_MS);
  }

  return sum / samples;
}

/**
 * حساب نسبة شحن البطارية من الجهد
 */
int batteryPercentageFromVoltage(float voltage) {
  const float Vmin = 3.0, Vmax = 4.19;
  float pct = (voltage - Vmin) / (Vmax - Vmin) * 100.0;
  pct = (pct < 0) ? 0 : (pct > 100) ? 100
                                    : pct;
  return (int)(pct + 0.5);
}

/**
 * تحديث قراءة البطارية
 */
void updateBatteryReadings() {
  batteryVoltage = readBatteryVoltage();
  batteryPercent = batteryPercentageFromVoltage(batteryVoltage);

  // طباعة للتصحيح (يمكن إزالته لاحقاً)
  Serial.printf("BAT: %.3fV, %d%%\n", batteryVoltage, batteryPercent);
}

// ================= الانذار buzzer ===================
void initBuzzer() {
  pinMode(BUZZER_PIN, OUTPUT);    // تجهيز البن كـ Output
  digitalWrite(BUZZER_PIN, LOW);  // التأكد إنه مطفي في البداية
}

// ================= تشغيل صفارة لمدة =================
void buzzerBeep(int duration_ms = 200) {
  digitalWrite(BUZZER_PIN, HIGH);  // يشتغل الصوت
  delay(duration_ms);              // يفضل شغال المدة المطلوبة
  digitalWrite(BUZZER_PIN, LOW);   // يقفل الصوت
}

// ================= تنبيه احترافي مزدوج =================
void buzzerAlert() {
  buzzerBeep(150);
  delay(100);
  buzzerBeep(150);
}

// =================  read snsors  =================
void readSensors(float &temperature, float &humidity, float &batteryVoltage, int &batteryPercent) {
  temperature = random(200, 301) / 10.0;
  humidity = random(400, 701) / 10.0;
  batteryVoltage = readBatteryVoltage();
  // batteryPercent = random(400, 901) / 10.0;
  // temperature = bme.readTemperature();
  // humidity = bme.readHumidity();
  // batteryVoltage = readBatteryVoltage();
  batteryPercent = batteryPercentageFromVoltage(batteryVoltage);
}

// =================  Save Readings Localy  =================
void saveReadingLocally(float temp, float hum) {
  // 🔥 منع الحفظ المتكرر لنفس القراءة
  if (temp == lastSavedTemp && hum == lastSavedHum) {
    Serial.println("⚠️ نفس القراءة محفوظة سابقاً → تخطي الحفظ");
    return;
  }

  lastSavedTemp = temp;
  lastSavedHum = hum;
  savingNow = true;

  prefs.begin("devicePrefs", false);  // افتح كل مرة

  DateTime now = rtc.now();
  char timestamp[20];
  sprintf(timestamp, "%04d-%02d-%02d %02d:%02d:%02d",
          now.year(), now.month(), now.day(),
          now.hour(), now.minute(), now.second());

  String stored = prefs.getString("readings", "[]");
  DynamicJsonDocument doc(4096);

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

  JsonObject r = arr.createNestedObject();
  r["t"] = temp;
  r["h"] = hum;
  r["time"] = String(timestamp);

  String output;
  serializeJson(doc, output);
  prefs.putString("readings", output);
  prefs.end();

  Serial.println("💾 البيانات المحفوظة هي: " + output);
  Serial.println("💾 تم حفظ قراءة محليًا: " + String(timestamp));

  savingNow = false;
}

// =================  Server  =================
//  لجلب التحديثات ووالمقارنات
// Compute SHA256 of a file in SPIFFS/LittleFS
String calculateSHA256(Stream &stream) {
  mbedtls_sha256_context ctx;
  mbedtls_sha256_init(&ctx);
  mbedtls_sha256_starts(&ctx, 0);  // 0 = SHA-256

  uint8_t buf[512];
  size_t len = 0;
  while ((len = stream.readBytes((char *)buf, sizeof(buf))) > 0) {
    mbedtls_sha256_update(&ctx, buf, len);
  }

  uint8_t hash[32];
  mbedtls_sha256_finish(&ctx, hash);
  mbedtls_sha256_free(&ctx);

  String hashStr;
  for (int i = 0; i < 32; i++) {
    if (hash[i] < 16) hashStr += "0";
    hashStr += String(hash[i], HEX);
  }
  hashStr.toLowerCase();
  return hashStr;
}

bool downloadFirmware(String url) {
  WiFiClient client;
  HTTPClient http;

  Serial.printf("Downloading firmware from: %s\n", url.c_str());
  if (!http.begin(client, url)) {
    Serial.println("HTTP begin failed!");
    return false;
  }
  http.addHeader("Authorization", "Token " + getToken());

  int httpCode = http.GET();
  if (httpCode != 200) {
    Serial.printf("HTTP GET failed: %d\n", httpCode);
    http.end();
    return false;
  }

  int contentLength = http.getSize();
  if (contentLength <= 0) {
    Serial.println("Content length invalid");
    http.end();
    return false;
  }

  bool canBegin = Update.begin(contentLength);
  if (!canBegin) {
    Serial.println("Not enough space for OTA");
    http.end();
    return false;
  }

  WiFiClient *stream = http.getStreamPtr();
  size_t written = Update.writeStream(*stream);

  if (written == contentLength) {
    Serial.println("Written : " + String(written) + " successfully");
  } else {
    Serial.println("Written only : " + String(written) + "/" + String(contentLength));
    http.end();
    return false;
  }

  if (Update.end()) {
    Serial.println("OTA done!");
    if (Update.isFinished()) {
      Serial.println("Update successfully finished. Rebooting...");
      http.end();
      return true;
    } else {
      Serial.println("Update not finished?");
      http.end();
      return false;
    }
  } else {
    Serial.println("Error Occurred. Error #: " + String(Update.getError()));
    http.end();
    return false;
  }
}

void checkForUpdate() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi not connected");
    return;
  }

  WiFiClient client;
  HTTPClient http;

  String url = String(baseUrl) + "updates/firmware/check/?type=" + firmwareType + "&version=" + currentVersion;
  http.begin(client, url);

  int httpCode = http.GET();
  if (httpCode != 200) {
    Serial.printf("Check update failed: %d\n", httpCode);
    http.end();
    return;
  }

  String payload = http.getString();
  http.end();

  StaticJsonDocument<512> doc;
  auto err = deserializeJson(doc, payload);
  if (err) {
    Serial.println("JSON parse failed!");
    return;
  }

  bool updateAvailable = doc["update"];
  if (!updateAvailable) {
    Serial.println("Firmware up to date: " + String(currentVersion));
    return;
  }

  String fwUrl = doc["url"];
  String fwChecksum = doc["checksum"];
  String fwVersion = doc["version"];

  Serial.println("New firmware available: v" + fwVersion);
  Serial.println("URL: " + fwUrl);
  Serial.println("Expected checksum: " + fwChecksum);

  if (downloadFirmware(fwUrl)) {
    Serial.println("OTA finished, rebooting...");
    ESP.restart();
  } else {
    Serial.println("OTA failed!");
  }
}

// 🔐 جلب التوكين من السيرفر
bool updateTokenFromServer() {
  if (WiFi.status() != WL_CONNECTED) return false;

  WiFiClient client;
  HTTPClient http;
  Serial.println("[base url]" + baseUrl);
  String url = baseUrl + "auth/login/";
  http.begin(client, url);
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
  WiFiClient client;
  HTTPClient http;

  String device_id = WiFi.macAddress();
  String url = baseUrl + "registered/" + device_id + "/";
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
  WiFiClient client;
  HTTPClient http;

  String device_id = WiFi.macAddress();
  String url = baseUrl + "discover/";
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
  WiFiClient client;
  HTTPClient http;

  String device_id = WiFi.macAddress();
  String url = baseUrl + "home/" + device_id + "/";

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

      DynamicJsonDocument doc(4096);
      DeserializationError error = deserializeJson(doc, payload);

      if (!error) {
        // ✅ قراءة القيم من الجذر مباشرة
        String current_time = doc["current_time"] | "";
        String newName = doc["name"] | "";
        float newMinTemp = doc["min_temp"] | NAN;
        float newMaxTemp = doc["max_temp"] | NAN;
        float newMinHum = doc["min_hum"] | NAN;
        float newMaxHum = doc["max_hum"] | NAN;

        // ⚠ قراءة الفترات بالدقائق من الـ backend
        int newWifiIntervalMinutes = doc["interval_wifi"] | 20;   // قيمة افتراضية 20 دقائق
        int newLocalIntervalMinutes = doc["interval_local"] | 5;  // قيمة افتراضية 5 دقائق

        // ⚠ إصلاح: قراءة القيم السابقة من المتغيرات الحالية وليس من prefs
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


        // ⚠ إصلاح: تحديث متغيرات الفترات مباشرة
        if (prevWifiInterval != newWifiIntervalMinutes) {
          wifiIntervalMinutes = newWifiIntervalMinutes;
          WIFI_UPDATE_INTERVAL = wifiIntervalMinutes * 60000UL;
          prefs.putInt("wifiInterval", newWifiIntervalMinutes);
          settingsChanged = true;
          Serial.printf("🔄 تغيير فترة WiFi إلى %d دقائق\n", wifiIntervalMinutes);
        }

        if (prevLocalInterval != newLocalIntervalMinutes) {
          localIntervalMinutes = newLocalIntervalMinutes;
          SAVE_UPDATE_INTERVAL = localIntervalMinutes * 60000UL;
          prefs.putInt("localInterval", newLocalIntervalMinutes);
          settingsChanged = true;
          Serial.printf("🔄 تغيير فترة Local إلى %d دقائق\n", localIntervalMinutes);
        }
        prefs.end();

        if (settingsChanged) {
          Serial.println("✅ تم تحديث الإعدادات من السيرفر");
        } else {
          Serial.println("ℹ لا توجد تغييرات في الإعدادات");
        }

        Serial.print("📟 اسم الجهاز: ");
        Serial.println(name);
        Serial.printf("✅ الحدود: %.1f~%.1f°C | %.1f~%.1f%%\n", minTemp, maxTemp, minHum, maxHum);
        Serial.printf("⏱ الفترات: WiFi كل %d دقائق | Local كل %d دقائق\n", wifiIntervalMinutes, localIntervalMinutes);

        // ✅ تحديث الساعة من current_time
        if (current_time.length() > 0) {
          int y, M, d, h, m, s;
          if (sscanf(current_time.c_str(), "%d-%d-%d %d:%d:%d", &y, &M, &d, &h, &m, &s) == 6) {
            rtc.adjust(DateTime(y, M, d, h, m, s));
            Serial.printf("🕒 تم تحديث RTC إلى %s\n", current_time.c_str());
            updateHeader();
          } else {
            Serial.println("⚠ خطأ في صيغة current_time");
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
    Serial.println("⚠ لا توجد قراءات محلية — سيتم استخدام القراءة الحالية فقط");
    // ... كود إضافة القراءة الحالية
  } else {
    // حاول فك ترميز JSON
    DynamicJsonDocument doc(4096);
    DeserializationError err = deserializeJson(doc, stored);

    if (err) {
      Serial.println("❌ خطأ في فك ترميز البيانات المحلية: " + String(err.c_str()));
      Serial.println("📦 البيانات المخزنة: " + stored);
      // استخدم القراءة الحالية فقط في حالة الخطأ
      Serial.println("⚠ سيتم استخدام القراءة الحالية فقط بسبب خطأ الترميز");
      // ... كود إضافة القراءة الحالية
    } else if (!doc.is<JsonArray>() || doc.size() == 0) {
      Serial.println("⚠ البيانات المحلية ليست مصفوفة أو فارغة");
      // ... كود إضافة القراءة الحالية
    } else {
      // البيانات صالحة، تابع المعالجة العادية
      JsonArray storedArr = doc.as<JsonArray>();
      DynamicJsonDocument newDoc(4096);
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
      newDoc["battery_level"] = batteryPercentageFromVoltage(readBatteryVoltage());
      // newDoc["battery_level"] = batteryPercent = random(400, 901) / 10.0;

      String jsonBody;
      serializeJson(newDoc, jsonBody);

      WiFiClient client;
      HTTPClient http;
      http.begin(client, baseUrl);
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
  doc["battery_level"] = batteryPercentageFromVoltage(readBatteryVoltage());

  String jsonBody;
  serializeJson(doc, jsonBody);

  WiFiClient client;
  HTTPClient http;
  http.begin(client, baseUrl);
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
  WiFiClient client;
  HTTPClient http;

  String url = baseUrl + "logs/create/";  // ضع endpoint مناسب
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

  Serial.println("⚠[LOG] Sending: " + jsonBody);
  int httpResponseCode = http.POST(jsonBody);

  if (httpResponseCode > 0) {
    Serial.printf("✅[LOG] Response: %d\n", httpResponseCode);
    Serial.println(http.getString());
  } else {
    Serial.printf("❌[LOG] Error: %d\n", httpResponseCode);
  }

  http.end();
}
/**
 * بدء وضع نقطة الوصول للإعداد
 */

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
    "<h2>⚙ Device WiFi Setup</h2>"
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
    baseUrl = "http://" + newIP + ":8000/";

    // 👇 استخدم الإدخال اليدوي لو اختار "Manual Entry"
    if (newSSID == "manual" && manualSSID != "") {
      newSSID = manualSSID;
    }

    if (newSSID != "" && baseUrl != "") {
      prefs.begin("wifi", false);
      prefs.putString("ssid", newSSID);
      prefs.putString("password", newPass);
      prefs.putString("server_url", baseUrl);
      prefs.end();

      Serial.println("🔒 Saved WiFi & Server settings successfully.");
      Serial.println("WiFi SSID: " + newSSID);
      Serial.println("Server IP: " + baseUrl);

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

// =========== دوال إدارة النظام ===========
/**
 * مهمة الاتصال بالواي فاي
 */
void WiFiTask(void *parameter) {
  while (1) {

    // 💤 استنى نوتيفيكيشن من أي تاسك (display / sensor)
    ulTaskNotifyTake(pdTRUE, portMAX_DELAY);
    Serial.println("🚀 WiFiTask starting now...");

    wifiNeedsRun = false;
    sleepLocked = true;

    // ✅ نوقف المهام التانية بس في فترة الـ connect
    while (savingNow) {
        vTaskDelay(10 / portTICK_PERIOD_MS);
    }
    vTaskSuspend(sensorTaskHandle);
    vTaskSuspend(displayTaskHandle);

    Serial.println("⏳ WiFiTask waiting 1500ms stabilization...");
    vTaskDelay(1500 / portTICK_PERIOD_MS);

    if (ssid == "" || baseUrl == "") {
      Serial.println("⚠️ no config, skipping WiFi");
      vTaskResume(sensorTaskHandle);
      vTaskResume(displayTaskHandle);
      sleepLocked = false;
      wifiNeedsRun = false;
      continue;
    }

    WiFi.mode(WIFI_STA);
    WiFi.begin(ssid.c_str(), password.c_str());

    Serial.printf("📡 [WiFi Task] - محاولة الاتصال بالشبكة '%s'\n", ssid.c_str());

    unsigned long startAttempt = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - startAttempt < 10000) {
      vTaskDelay(200 / portTICK_PERIOD_MS);
    }

    // ✅ بعد ما عرفنا النتيجة لازم نرجّع المهام فوراً
    vTaskResume(sensorTaskHandle);
    vTaskResume(displayTaskHandle);
    sleepLocked = false;

    if (WiFi.status() != WL_CONNECTED) {
      wifiConnected = false;
      Serial.println("❌ WiFi failed.");
      lastWiFiUpdate = millis();
      wifiNeedsRun = false;
      continue;   // نرجع نستنّى نوتيفيكيشن جديد
    }

    // 🎯 من هنا وطالع: الواي فاي متصل
    wifiConnected = true;
    Serial.println("✅ WiFi connected.");

    // نخلي الـ HTTP شغال والمهام التانية شغالة عادي
    updateTokenFromServer();
    registered = checkIfRegistered();
    if (!registered) {
      Serial.println("🔍 Device not registered. Entering discovery mode...");
      sendDiscovery();
    } else {
      Serial.println("✅ Device is registered. Starting normal mode...");

      fetchSettingsFromServer();

      float t, h, v;
      int p;
      readSensors(t, h, v, p);
      sendStoredReadings(t, h);

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
      // if (p < 20) {
      //   sendLog("Battery", "Battery is Less than 20. Need to charge it");
      // }
    }

    // ✅ تحديث التايمر ومسح الفلاج
    wifiNeedsRun = false;
    lastWiFiUpdate = millis();
  }
}

// =========== دوال إدارة المستشعرات ===========

/**
 * مهمة قراءة المستشعرات
 */
void sensorTask(void *parameter) {
  while (1) {
    // لو جاء نوتيفيكيشن → نفّذ فوراً (Instant)
    if (ulTaskNotifyTake(pdTRUE, 0) > 0 && instantSyncRequested) {

        sleepLocked = true;

        float t, h, v;
        int p;

        // if (bmeOK) {
            readSensors(t, h, v, p);
            temperature = t;
            humidity = h;
            batteryVoltage = v;
            batteryPercent = p;
            Serial.printf("⚡ [Instant Sensor] %.2f°C | %.2f%%\n", t, h);

            saveReadingLocally(t, h);

            // التحقق من الحدود
            bool alert = (t < minTemp) || (t > maxTemp) || (h < minHum) || (h > maxHum);
            if (alert && !wifiNeedsRun) {
              Serial.println("🚨 القيم خارج الحدود! يصحي WiFiTask...");
              wifiNeedsRun = true;
            }
        // }
        sleepLocked = false;
    }
    
    if (!sleepMode) {
      unsigned long now = millis();
      float t, h, v;
      int p;

      // تحديث قراءات المستشعرات كل دقيقة
      if (now - lastSensorUpdate >= SENSOR_UPDATE_INTERVAL || lastSensorUpdate == 0) {
        sleepLocked = true;
        Serial.println("🌡️ [Sensor Task] - قراءة بيانات المستشعرات");
        
        // if (bmeOK) {
          readSensors(t, h, v, p);
          temperature = t;
          humidity = h;
          batteryVoltage = v;
          batteryPercent = p;
          Serial.printf("🌡️ [Sensor Task] - 🌡 %.2f°C | 💧 %.2f%% | 🔋 %.2fV (%d%%)\n",
                        t, h, v, p);

          // التحقق من الحدود
          bool alert = (t < minTemp) || (t > maxTemp) || (h < minHum) || (h > maxHum);
          if (alert && !wifiNeedsRun) {
            Serial.println("🚨 القيم خارج الحدود! يصحي WiFiTask...");
            wifiNeedsRun = true;
          }

          if (wifiNeedsRun) {
            // امنع التشغيل قبل انتهاء ال sensorTask تماماً
            // ندي وقت 200–500ms كحد أدنى لضمان إنه خلص
            vTaskDelay(300 / portTICK_PERIOD_MS);

            xTaskNotifyGive(wifiTaskHandle);
          }

          // حفظ القراءات كل 5 دقائق
          if (now - lastSaveUpdate >= SAVE_UPDATE_INTERVAL || lastSaveUpdate == 0) {
            Serial.println("💾 وقت الحفظ المحلي - حفظ البيانات...");
            saveReadingLocally(t, h);
            lastSaveUpdate = now;   // restart counter
          }
        // } else {
        //   Serial.println("⚠️ [Sensor Task] - خطأ في قراءة المستشعر BME280");
        // }

        // تشغيل ال WiFi كل 20 دقيقة
        if (now - lastWiFiUpdate >= WIFI_UPDATE_INTERVAL || lastWiFiUpdate == 0) {
          Serial.println("🔁 وقت تحديث WiFi الدوري — يصحي WiFiTask...");
          if (wifiTaskHandle != NULL) {
            wifiNeedsRun = true;
          } else {
            Serial.println("⚠️ wifiTaskHandle = NULL (التاسك مش موجود)");
          }
          lastWiFiUpdate = now;   // restart counter
        }

        lastSensorUpdate = now;

        sleepLocked = false;
      }
    } else {
      // في وضع السليب - تقليل استهلاك الطاقة
      Serial.println("💤 [Sensor Task] - المهمة متوقفة في وضع السليب");
      vTaskDelay(5000 / portTICK_PERIOD_MS);  // تأخير أطول في السليب
    }
    vTaskDelay(1000 / portTICK_PERIOD_MS);
  }
}

// =========== المهام الرئيسية ===========
/**
 * مهمة العرض (واجهة المستخدم)
 */
void displayTask(void *parameter) {
  unsigned long lastHeaderUpdate = 0;
  unsigned long lastStatusPrint = 0;

  while (1) {
    if (!sleepMode) {
      if (instantSyncRequested) {
        Serial.println("⚡ Instant Sync Mode → start sensor & WiFi now");
        instantSyncRequested = false;   // clear flag

        // تشغيل sensorTask فورًا (قراءة + حفظ)
        xTaskNotifyGive(sensorTaskHandle);
        wifiNeedsRun = true;
      }

      if (wifiNeedsRun) {
        // امنع التشغيل قبل انتهاء ال sensorTask تماماً
        // ندي وقت 200–500ms كحد أدنى لضمان إنه خلص
        vTaskDelay(300 / portTICK_PERIOD_MS);

        xTaskNotifyGive(wifiTaskHandle);
      }

      unsigned long now = millis();

      // طباعة حالة النظام كل 30 ثانية (للتتبع فقط)
      if (now - lastStatusPrint >= 30000) {
        Serial.println("📱 [Display Task] - النظام يعمل بشكل طبيعي - في وضع الصحيان");
        lastStatusPrint = now;
      }

      // وميض أيقونة الواي فاي
      if (now - lastBlink >= 500) {
        blinkWiFi = !blinkWiFi;
        lastBlink = now;
      }

      // تحديث البطارية
      if (now - lastBatteryUpdate >= BATTERY_UPDATE_INTERVAL) {
        lastBatteryUpdate = now;
        updateBatteryReadings();
      }

      // تحديث الهيدر كل ثانية
      if (now - lastHeaderUpdate >= 1000) {
        lastHeaderUpdate = now;
        u8g2.setDrawColor(0);
        u8g2.drawBox(0, 0, 128, 16);
        u8g2.setDrawColor(1);
        drawHeader();
        u8g2.sendBuffer();
      }

      // عرض الصفحة الحالية
      switch (currentPage) {
        case 0:  // الصفحة الرئيسية
          drawMainPage();
          break;
        case 1:  // صفحة الشبكة
          drawWiFiDetailsPage();
          break;
        case 2:  // صفحة ضبط الوقت
          if (handleTimeSetPage()) {
            currentPage = 0;
            bootMillis = millis();
            sleepMode = false;
          }
          break;
      }

      // معالجة الأزرار
      if (buttonPressed(BTN_RIGHT)) {
        updateUserActivity();
        currentPage = (currentPage + 1) % totalPages;
        Serial.println("➡️ [Button] - زر اليمين: التنقل للصفحة التالية");
        vTaskDelay(200 / portTICK_PERIOD_MS);
      } else if (buttonPressed(BTN_LEFT)) {
        updateUserActivity();
        currentPage = (currentPage - 1 + totalPages) % totalPages;
        Serial.println("⬅️ [Button] - زر اليسار: التنقل للصفحة السابقة");
        vTaskDelay(200 / portTICK_PERIOD_MS);
      }

      // التحقق من الضغط المطول على زر SELECT
      if (checkLongPress()) {
        Serial.println("🔧 [Button] - ضغط مطول على SEL: عرض تأكيد الإعداد");
        showSetupConfirmation();
      }

      // إدارة وضع السليب
      manageSleepMode();
    } else {
      // في وضع السليب - تقليل استهلاك الطاقة
      if (millis() - lastStatusPrint >= 30000) {
        unsigned long remainingTime = SLEEP_DURATION - (millis() - sleepStart);
        Serial.printf("💤 [System] - النظام في وضع السليب - الاستيقاظ بعد: %d ثانية\n", remainingTime / 1000);
        lastStatusPrint = millis();
      }
      
      vTaskDelay(5000 / portTICK_PERIOD_MS);  // تأخير أطول في السليب
    }

    vTaskDelay(50 / portTICK_PERIOD_MS);
  }
}

// =========== الإعداد والتشغيل ===========

void setup() {
  Serial.begin(115200);

  // تهيئة العشوائية باستخدام قراءة من ADC (تغييرها يجعل الأرقام مختلفة كل تشغيل)
  randomSeed(analogRead(0));

  // قراءة الإعدادات
  prefs.begin("wifi", true);
  ssid     = prefs.getString("ssid", "");
  password = prefs.getString("password", "");
  baseUrl  = prefs.getString("server_url", "");
  prefs.end();

  prefs.begin("devicePrefs", false);
  // ⚠ تحميل الإعدادات - استخدم قيم افتراضية صحيحة
  name = prefs.getString("name", "Device");

  // ⚠ القيم الافتراضية كانت غلط - استخدم NAN بدل القيم الثابتة
  minTemp = prefs.getFloat("minTemp", NAN);
  maxTemp = prefs.getFloat("maxTemp", NAN);
  minHum = prefs.getFloat("minHum", NAN);
  maxHum = prefs.getFloat("maxHum", NAN);

  // ⚠ تحميل الفترات من الذاكرة مباشرة
  wifiIntervalMinutes = prefs.getInt("wifiInterval", 20);
  localIntervalMinutes = prefs.getInt("localInterval", 5);

  prefs.end();
  
  Serial.println("🚀 [System] - بدء تشغيل TOMATIKI Data Logger");
  Serial.println("⏰ [System] - المهام الزمنية:");
  Serial.println("   - 📊 مهمة المستشعرات: كل دقيقة");
  Serial.println("   - 📡 مهمة الواي فاي: كل دقيقتين"); 
  Serial.println("   - 🔋 مهمة البطارية: كل 5 ثواني");
  Serial.println("   - 💤 السليب: بعد 30 ثانية خمول");
  Serial.println("   - ⏰ الاستيقاظ التلقائي: بعد دقيقتين من السليب");

  // إعداد البطارية
  analogSetPinAttenuation(34, ADC_11db);

  // إعداد الأزرار
  pinMode(BTN_UP, INPUT_PULLUP);
  pinMode(BTN_DOWN, INPUT_PULLUP);
  pinMode(BTN_LEFT, INPUT_PULLUP);
  pinMode(BTN_RIGHT, INPUT_PULLUP);
  pinMode(BTN_SEL, INPUT_PULLUP);

  // إعداد الأجهزة
  Wire.begin();
  u8g2.begin();
  rtcOK = rtc.begin();
  // bmeOK = bme.begin(0x76);

  // عرض شاشة البداية
  showSplashScreen();
  bootMillis = millis();
  lastUserActivity = millis();


  // ❗ لو مفيش إعدادات → ادخل مباشرة AP Mode
  if (ssid == "" || baseUrl == "") {
    Serial.println("⚠️ لا توجد إعدادات → الدخول لوضع الإعداد");

    WiFi.disconnect(true);   // ← ضروري
    WiFi.mode(WIFI_OFF);     // ← أهم سطر
    delay(500);              // ← لازم يهدأ

    startConfigAP();
  }

  // ⚠ إضافة تحقق من صحة القيم
  if (isnan(minTemp) || isnan(maxTemp)) {
    Serial.println("⚠ الحدود غير مضبوطة - استخدام قيم افتراضية آمنة");
    minTemp = 10.0;
    maxTemp = 35.0;
  }

  if (isnan(minHum) || isnan(maxHum)) {
    minHum = 30.0;
    maxHum = 80.0;
  }

  // ⚠ التأكد من أن الفترات قيم صحيحة
  if (wifiIntervalMinutes <= 0) wifiIntervalMinutes = 20;
  if (localIntervalMinutes <= 0) localIntervalMinutes = 5;

  // إنشاء المهام
  xTaskCreatePinnedToCore(WiFiTask, "WiFiTask", 4096, NULL, 1, &wifiTaskHandle, 0);
  xTaskCreatePinnedToCore(sensorTask, "SensorTask", 8192, NULL, 1, &sensorTaskHandle, 1);
  xTaskCreatePinnedToCore(displayTask, "DisplayTask", 4096, NULL, 2, &displayTaskHandle, 1);

  Serial.println("✅ [System] - تم تهيئة النظام بنجاح وبدء المهام");
}

void loop() {
  // النظام يعمل بالمهام - لا حاجة لأي شيء هنا
  vTaskDelay(1000 / portTICK_PERIOD_MS);
}