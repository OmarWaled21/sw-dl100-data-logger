"use client";
import React, { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { WiThermometer, WiHumidity } from "react-icons/wi";
import { useTranslation } from "react-i18next";
import {
  FaBatteryFull,
  FaBatteryThreeQuarters,
  FaBatteryHalf,
  FaBatteryQuarter,
  FaBatteryEmpty,
} from "react-icons/fa";
import { FiSettings } from "react-icons/fi";
import axios from "axios";
import Cookies from "js-cookie";
import SensorCard from "@/components/device_details/sensor_card";
import DeviceModal from "@/components/device_details/device_modal";
import DeviceReadingData from "@/components/device_details/device_readings_card";
import { DeviceDetails } from "@/types/device";
import LayoutWithNavbar from "@/components/ui/layout_with_navbar";
import { useIP } from "@/lib/IPContext";

interface Reading {
  temperature: number;
  humidity: number;
  timestamp: string;
}

export default function DeviceDetailsPage() {
  const params = useParams();
  const deviceId = params.id;
  const [device, setDevice] = useState<DeviceDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const role = Cookies.get("role"); // جايب الدور من الكوكيز
  
  const [readings, setReadings] = useState<Reading[]>([]); // هنا array للـ readings
  const ws = useRef<WebSocket | null>(null);
  const { t } = useTranslation();

  const { ipHost, ipLoading } = useIP();

  useEffect(() => {
    if (ipLoading) return;
    ws.current = new WebSocket(`wss://${ipHost}/ws/device/${deviceId}/?token=${Cookies.get("token")}`);

    ws.current.onopen = () => {
      console.log("Connected to device WebSocket");
    };
    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'details')  {
        setDevice({
          id: data.device_id,
          name: data.name,
          battery: data.battery_level,
          has_temperature_sensor: data.has_temperature_sensor,
          has_humidity_sensor: data.has_humidity_sensor,
          temperature_type: data.temperature_type,
          temperature: data.temperature,
          humidity: data.humidity,
          minTemp: data.min_temp,
          maxTemp: data.max_temp,
          minHum: data.min_hum,
          maxHum: data.max_hum,
          interval_wifi: data.interval_wifi,
          interval_local: data.interval_local,
          last_update: data.last_update,
          status: data.status,
        });
        setLoading(false);
      }

      if (data.type === "readings") {
        const incomingReadings: Reading[] = [];

        if (Array.isArray(data.readings)) {
          incomingReadings.push(...data.readings);
        }

        if (incomingReadings.length > 0) {
          const latest = incomingReadings[0];

          // تحديث readings
          setReadings((prev) =>
            [...incomingReadings.reverse(), ...prev]
              .slice(0, 100)
              .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          );

          // ✅ تحديث القيم في gauge
          setDevice((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              temperature: latest.temperature ?? prev.temperature,
              humidity: latest.humidity ?? prev.humidity,
              last_update: data.last_update ?? prev.last_update,
            };
          });
        }
      }

    };

    ws.current.onclose = () => {
      console.log("Device WebSocket closed");
    };

    return () => ws.current?.close();
  }, [deviceId, ipLoading, ipHost]);

  useEffect(() => {
    if (!device) return;

    const interval = setInterval(() => {
      setDevice((prev) => {
        if (!prev) return prev;
        const lastUpdate = new Date(prev.last_update).getTime();
        const now = Date.now();
        const offlineThreshold = (prev.interval_wifi ?? 0) * 60 * 1000 + 10 * 60 * 1000;// interval_wifi + 10 minute

        const newStatus =
          now - lastUpdate > offlineThreshold ? "offline" : prev.status === "offline" ? "active" : prev.status;

        if (newStatus !== prev.status) {
          return { ...prev, status: newStatus };
        }
        return prev;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [device]);

  if (loading)
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-600 text-lg">Loading device information...</div>
      </div>
    );

  if (!device)
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-red-500 text-lg">Device not found</div>
      </div>
    );

  // Status checks
  const isOffline = device.status === "offline";
  const isError = device.status === "error";

  // Temperature color
  const tempColor = isOffline
    ? "#9CA3AF"
    : isError
    ? "#EF4444"
    : device.temperature < device.minTemp || device.temperature > device.maxTemp
    ? "#EF4444"
    : "#10B981";

  // Humidity color
  const humColor = isOffline
    ? "#9CA3AF"
    : isError
    ? "#EF4444"
    : device.humidity < device.minHum || device.humidity > device.maxHum
    ? "#EF4444"
    : "#10B981";

  // Battery icon
  const getBatteryIcon = () => {
    if (isOffline) return <FaBatteryHalf className="inline text-gray-400" />;
    if (isError) return <FaBatteryHalf className="inline text-red-500" />;

    const b = device.battery;
    if (b > 75) return <FaBatteryFull className="inline text-green-500" />;
    if (b > 50) return <FaBatteryThreeQuarters className="inline text-green-400" />;
    if (b > 25) return <FaBatteryHalf className="inline text-yellow-500" />;
    if (b > 10) return <FaBatteryQuarter className="inline text-orange-500" />;
    return <FaBatteryEmpty className="inline text-red-500" />;
  };

  const getStatusStyles = () => {
    switch (device.status) {
      case "active":
        return "bg-green-100 text-green-800 border border-green-200";
      case "offline":
        return "bg-gray-100 text-gray-800 border border-gray-200";
      case "error":
        return "bg-red-100 text-red-800 border border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border border-gray-200";
    }
  };

  const handleSave = async (data: {
    name: string;
    minTemp: number;
    maxTemp: number;
    interval_wifi: number;
    interval_local: number;
  }) => {
    try {
      if(ipLoading) return;
      await axios.put(`https://${ipHost}/device/${deviceId}/`, {
        name: data.name,
        min_temp: data.minTemp,
        max_temp: data.maxTemp,
        interval_wifi: data.interval_wifi,
        interval_local: data.interval_local,
      }, {
        headers: {
          Authorization: `Token ${Cookies.get("token")}`,
        }
      });
      setOpen(false);
    } catch (err) {
      console.error("Error updating device:", err);
    }
  };

  // تحديد تخطيط الـ sensors بناءً على العدد
  const getSensorLayout = () => {
    const sensors = [];
    
    if (device.has_temperature_sensor) {
      sensors.push(
        <div key="temperature" className="animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <SensorCard
            title={device.temperature_type === "air" ? t("temperature") : t("temperature(liquid)")}
            icon={
              <WiThermometer
                size={32}
                className={device.temperature_type === "air" ? "text-orange-500" : "text-blue-500"}
              />
            }
            unit="°C"
            value={device.temperature}
            min={device.minTemp}
            max={device.maxTemp}
            color={tempColor}
          />
        </div>
      );
    }
    
    if (device.has_humidity_sensor) {
      sensors.push(
        <div key="humidity" className="animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <SensorCard
            title={t("humidity")}
            icon={<WiHumidity size={32} className="text-cyan-500" />}
            unit="%"
            value={Number(device.humidity.toFixed(2))}
            min={device.minHum}
            max={device.maxHum}
            color={humColor}
          />
        </div>
      );
    }

    // تحديد الـ grid layout بناءً على عدد الـ sensors
    let gridClass = "";
    if (sensors.length === 1) {
      gridClass = "grid-cols-1 justify-center";
    } else if (sensors.length === 2) {
      gridClass = "grid-cols-1 md:grid-cols-2 gap-8";
    } else if (sensors.length >= 3) {
      gridClass = "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6";
    }

    return (
      <div className={`grid ${gridClass} mb-12`}>
        {sensors}
      </div>
    );
  };

  return (
    <LayoutWithNavbar>
      <div className="p-6">
        <div className="bg-white shadow-lg rounded-2xl p-6 animate-fade-in">
          {/* Header */}
          <div className="bg-white border-b border-gray-200 py-6 px-8 flex justify-between items-center relative">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2 animate-slide-in-left">{device.name}</h1>
              <div className="flex items-center gap-4 animate-slide-in-left" style={{ animationDelay: '0.1s' }}>
                <span className={`px-4 py-2 rounded-full font-semibold text-sm ${getStatusStyles()} transition-all duration-300`}>
                  {t(device.status)}
                </span>
                <span className="text-lg font-medium text-gray-700 flex items-center gap-2 transition-all duration-300">
                  {getBatteryIcon()}
                  <span className="text-gray-900">{device.battery}% {t("Battery")}</span>
                </span>
              </div>
            </div>

            {/* Settings Button */}
            {role && ["admin", "supervisor"].includes(role) && (
              <button
                onClick={() => setOpen(true)}
                className="absolute top-6 end-6 p-3 rounded-full bg-gray-100 hover:bg-gray-200 shadow cursor-pointer transition-all duration-300 hover:scale-110 animate-pulse-slow"
              >
                <FiSettings size={28} />
              </button>
            )}
          </div>

          {/* Main Content */}
          <div className="max-w-6xl mx-auto py-8 px-8">
            {/* Sensors Grid - Dynamic Layout */}
            {getSensorLayout()}

            {/* حالة لو مفيش ولا sensor */}
            {!device.has_temperature_sensor && !device.has_humidity_sensor && (
              <div className="col-span-2 text-center text-gray-500 text-lg py-12 border border-dashed rounded-xl animate-fade-in">
                {t("No sensors detected for this device.")}
              </div>
            )}

            {/* Recent Readings Section */}
            <div className="w-full min-h-screen animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
              <DeviceReadingData deviceId={device.id} readings={readings} deviceName={device.name} hasTemperatureSensor={device.has_temperature_sensor} hasHumiditySensor={device.has_humidity_sensor} />
            </div>
          </div>
        </div>

        {/* Modal */}
        <DeviceModal
          isOpen={open}
          onClose={() => setOpen(false)}
          deviceId={device.id}
          name={device.name}
          hasTemperatureSensor={device.has_temperature_sensor}
          hasHumiditySensor={device.has_humidity_sensor}
          temperatureType={device.temperature_type}
          minTemp={device.minTemp}
          maxTemp={device.maxTemp}
          minHum={device.minHum}
          maxHum={device.maxHum}
          interval_wifi={device.interval_wifi}
          interval_local={device.interval_local}
          onSave={handleSave}
        />
      </div>

      {/* إضافة الـ CSS للـ animations */}
      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes fade-in-up {
          from { 
            opacity: 0;
            transform: translateY(20px);
          }
          to { 
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes slide-in-left {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes pulse-slow {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        .animate-fade-in {
          animation: fade-in 0.6s ease-out;
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.6s ease-out;
        }
        .animate-slide-in-left {
          animation: slide-in-left 0.5s ease-out;
        }
        .animate-pulse-slow {
          animation: pulse-slow 2s infinite;
        }
      `}</style>
    </LayoutWithNavbar>
  );
}