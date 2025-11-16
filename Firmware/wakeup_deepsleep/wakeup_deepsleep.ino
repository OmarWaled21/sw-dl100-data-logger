#include <esp_sleep.h>

#define WAKE_BUTTON 33   // الزر متوصل على GPIO 33

void setup() {
  Serial.begin(115200);
  delay(1000);

  // إعداد البن كزر فعال منخفض
  pinMode(WAKE_BUTTON, INPUT_PULLUP);

  // عرض سبب الاستيقاظ
  esp_sleep_wakeup_cause_t wakeupReason = esp_sleep_get_wakeup_cause();
  Serial.print("Wakeup reason: ");
  Serial.println((int)wakeupReason);

  Serial.println("Device is awake!");
  Serial.println("Going to sleep in 5 seconds...");
  delay(5000);

  // ⚡ إعداد الاستيقاظ عند الضغط على الزر (إشارة LOW)
  esp_sleep_enable_ext0_wakeup((gpio_num_t)WAKE_BUTTON, 0);

  Serial.println("Now entering deep sleep...");
  delay(200);

  esp_deep_sleep_start();
}

void loop() {
  // مش هنستخدم loop لأن الجهاز هينام
}
