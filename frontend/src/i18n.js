"use client";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

i18n
  .use(LanguageDetector) // <--- detector يقرأ اللغة من cookie/localStorage
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        translation: {
          "Data Logger": "Data Logger",
          "Dashboard": "Dashboard",
          "Logs": "Logs",
          "Settings": "Settings",
          "Logout": "Logout",
          "device_overview": "Device Overview",
          "total_devices": "Total Devices",
          "active": "Active",
          "error": "Error",
          "offline": "Offline",
          "devices": "Devices",
          "temperature": "Temperature",
          "humidity": "Humidity",
        },
      },
      ar: {
        translation: {
          "Data Logger": "مسجل البيانات",
          "Dashboard": "لوحة التحكم",
          "Logs": "السجلات",
          "Settings": "الإعدادات",
          "Logout": "تسجيل الخروج",
          "device_overview": "نظرة عامة على الجهاز",
          "total_devices": "إجمالي الأجهزة",
          "active": "نشط",
          "error": "خطاء",
          "offline": "غير متصل",
          "devices": "الأجهزة",
          "temperature": "درجة الحرارة",
          "humidity": "الرطوبة",
        },
      },
    },
    fallbackLng: "en",
    detection: {
      order: ["cookie", "localStorage", "navigator"], // أولاً قراءة Cookie
      caches: ["cookie"], // حفظ اللغة في Cookie تلقائيًا
      cookieMinutes: 525600, // سنة كاملة
      cookieDomain: window.location.hostname,
    },
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
