"use client";
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";

interface DeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  deviceId: string;
  name: string;
  hasTemperatureSensor: boolean;
  hasHumiditySensor: boolean;
  temperatureType: string;
  minTemp: number;
  maxTemp: number;
  minHum: number;
  maxHum: number;
  interval_wifi: number;
  interval_local: number; 
  onSave: (data: {
    name: string;
    minTemp: number;
    maxTemp: number;
    minHum: number;
    maxHum: number;
    interval_wifi: number;
    interval_local: number;
  }) => void;
}

export default function DeviceModal({
  isOpen,
  onClose,
  deviceId,
  name,
  hasTemperatureSensor,
  hasHumiditySensor,
  temperatureType,
  minTemp,
  maxTemp,
  minHum,
  maxHum,
  interval_wifi,
  interval_local,
  onSave,
}: DeviceModalProps) {
  const [formName, setFormName] = useState(name);
  const [formMinTemp, setFormMinTemp] = useState(minTemp);
  const [formMaxTemp, setFormMaxTemp] = useState(maxTemp);
  const [formMinHum, setFormMinHum] = useState(minHum);
  const [formMaxHum, setFormMaxHum] = useState(maxHum);
  const [formIntervalWifi, setFormIntervalWifi] = useState(interval_wifi);
  const [formIntervalLocal, setFormIntervalLocal] = useState(interval_local);

  const { t } = useTranslation();

  const handleSave = () => {
    onSave({
      name: formName,
      minTemp: formMinTemp,
      maxTemp: formMaxTemp,
      minHum: formMinHum,
      maxHum: formMaxHum,
      interval_wifi: formIntervalWifi,
      interval_local: formIntervalLocal,
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          aria-modal="true"
          role="dialog"
        >
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
            onClick={onClose}
          />

          {/* Modal content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            transition={{ 
              duration: 0.4, 
              ease: [0.25, 0.1, 0.25, 1],
              scale: { duration: 0.3 }
            }}
            className="relative bg-gradient-to-br from-white to-gray-50 rounded-3xl shadow-2xl w-full max-w-lg z-10 border border-gray-100/80"
          >
            {/* Header */}
            <div className="px-8 py-6 border-b border-gray-200/60 bg-white/80 rounded-t-3xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                    {t("Edit")} {name}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                    <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-md text-xs font-medium">
                      ID: {deviceId}
                    </span>
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2.5 hover:bg-red-50 rounded-xl transition-all duration-200 group cursor-pointer"
                >
                  <svg className="w-5 h-5 text-gray-400 group-hover:text-red-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Form */}
            <div className="px-8 py-6 space-y-6 max-h-[60vh] overflow-y-auto">
              {/* Device Name */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-800">
                  {t("Device Name")}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    dir="ltr"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-4 py-3.5 bg-white border-2 border-gray-200 rounded-2xl focus:ring-3 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300 placeholder-gray-400"
                    placeholder="Enter device name"
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Temperature Range */}
              {hasTemperatureSensor && (
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-gray-800">
                    🌡️ {t("Temperature Range")}  {temperatureType === "air" ? "" : t("fridge")}(°C)
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    {/* Minimum */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-gray-600">{t("Minimum")}</label>
                      <input
                        type="number"
                        dir="ltr"
                        value={formMinTemp}
                        onChange={(e) => {
                          let value = Number(e.target.value);
                          if (temperatureType === "air") {
                            if (value < 0) value = 0;
                            if (value > 100) value = 100;
                          } else {
                            if (value < -55) value = -55;
                            if (value > 120) value = 120;
                          }
                          setFormMinTemp(value);
                        }}
                        className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-2xl focus:ring-3 focus:ring-red-500/20 focus:border-red-500 transition-all duration-300"
                        placeholder="Min"
                      />
                    </div>

                    {/* Maximum */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-gray-600">{t("Maximum")}</label>
                      <input
                        type="number"
                        dir="ltr"
                        value={formMaxTemp}
                        onChange={(e) => {
                          let value = Number(e.target.value);
                          if (temperatureType === "air") {
                            if (value < 0) value = 0;
                            if (value > 100) value = 100;
                          } else {
                            if (value < -55) value = -55;
                            if (value > 120) value = 120;
                          }
                          setFormMaxTemp(value);
                        }}
                        className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-2xl focus:ring-3 focus:ring-red-500/20 focus:border-red-500 transition-all duration-300"
                        placeholder="Max"
                      />
                    </div>
                  </div>

                  {/* Optional note below the fields */}
                  <p className="text-xs text-gray-500">
                    {temperatureType === "air"
                      ? `${t("Allowed range")}: 0°C ${t("to")} 100°C`
                      : `${t("Allowed range")}: -55°C ${t("to")} 120°C`}
                  </p>
                </div>
              )}

              {/* Humidity Range */}
              {hasHumiditySensor && (
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-gray-800">
                    💧 {t("Humidity Range")} (%)
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-gray-600">{t("Minimum")}</label>
                      <input
                        type="number"
                        value={formMinHum}
                        onChange={(e) => setFormMinHum(Number(e.target.value))}
                        className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-2xl focus:ring-3 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300"
                        placeholder="Min"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-gray-600">{t("Maximum")}</label>
                      <input
                        type="number"
                        dir="ltr"
                        value={formMaxHum}
                        onChange={(e) => setFormMaxHum(Number(e.target.value))}
                        className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-2xl focus:ring-3 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300"
                        placeholder="Max"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Update Intervals */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-800">
                  ⏱️ {t("Update Interval WiFi")} ({t("minutes")})
                </label>
                <div className="relative">
                  <input
                    type="number"
                    dir="ltr"
                    value={formIntervalWifi}
                    onChange={(e) => setFormIntervalWifi(Number(e.target.value))}
                    className="w-full px-4 py-3.5 bg-white border-2 border-gray-200 rounded-2xl focus:ring-3 focus:ring-green-500/20 focus:border-green-500 transition-all duration-300"
                    placeholder="Interval in minutes"
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-800">
                  ⏱️ {t("Update Interval Local")} ({t("minutes")})
                </label>
                <div className="relative">
                  <input
                    type="number"
                    dir="ltr"
                    value={formIntervalLocal}
                    onChange={(e) => setFormIntervalLocal(Number(e.target.value))}
                    className="w-full px-4 py-3.5 bg-white border-2 border-gray-200 rounded-2xl focus:ring-3 focus:ring-green-500/20 focus:border-green-500 transition-all duration-300"
                    placeholder="Interval in minutes"
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-8 py-6 border-t border-gray-200/60 bg-gradient-to-r from-gray-50 to-white/50 rounded-b-3xl">
              <div className="flex justify-end gap-4">
                <button
                  onClick={onClose}
                  className="px-8 py-3.5 text-gray-700 font-semibold rounded-2xl border-2 border-gray-300 hover:border-gray-400 hover:bg-gray-50 transition-all duration-300 active:scale-95 cursor-pointer"
                >
                  {t("Cancel")}
                </button>
                <button
                  onClick={handleSave}
                  className="px-8 py-3.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-2xl hover:from-blue-700 hover:to-blue-800 focus:ring-4 focus:ring-blue-500/30 shadow-lg hover:shadow-xl transition-all duration-300 active:scale-95 cursor-pointer"
                >
                  {t("Save Changes")} 
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}