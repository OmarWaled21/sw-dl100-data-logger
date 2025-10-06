"use client";
import React, { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { WiThermometer, WiHumidity } from "react-icons/wi";
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

interface DeviceDetails {
  id: string;
  name: string;
  battery: number;
  temperature: number;
  humidity: number;
  minTemp: number;
  maxTemp: number;
  minHum: number;
  maxHum: number;
  interval: number;
  last_update: string;
  status: "active" | "offline" | "error";
}

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
  const [deviceName, setDeviceName] = useState("");     // لو محتاج الاسم في الـ child
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    ws.current = new WebSocket(`ws://127.0.0.1:8000/ws/device/${deviceId}/?token=${Cookies.get("token")}`);

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
          temperature: data.temperature,
          humidity: data.humidity,
          minTemp: data.min_temp,
          maxTemp: data.max_temp,
          minHum: data.min_hum,
          maxHum: data.max_hum,
          interval: data.interval_wifi,
          last_update: data.last_update,
          status: data.status,
        });
        setLoading(false);
      }

      if (data.type === "readings") {
        setReadings((prev) => {
          // نخلي أحدث 100 قراءة مثلاً
          const merged = [...data.readings.reverse(), ...prev].slice(0, 100);
          return merged;
        });
      }
    };

    ws.current.onclose = () => {
      console.log("Device WebSocket closed");
    };

    return () => ws.current?.close();
  }, [deviceId]);

  useEffect(() => {
    if (!device) return;

    const interval = setInterval(() => {
      setDevice((prev) => {
        if (!prev) return prev;
        const lastUpdate = new Date(prev.last_update).getTime();
        const now = Date.now();
        const offlineThreshold = (prev.interval ?? 0) * 1000 + 60000; // interval_wifi + 60 ثانية

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
    interval: number;
  }) => {
    try {
      await axios.put(`http://127.0.0.1:8000/device/${deviceId}/`, {
        name: data.name,
        min_temp: data.minTemp,
        max_temp: data.maxTemp,
        interval_local: data.interval,
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

  

  return (
    <div className="p-6">
      <div className="bg-white shadow-lg rounded-2xl p-6">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 py-6 px-8 flex justify-between items-center relative">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{device.name}</h1>
            <div className="flex items-center gap-4">
              <span className={`px-4 py-2 rounded-full font-semibold text-sm ${getStatusStyles()}`}>
                {device.status.toUpperCase()}
              </span>
              <span className="text-lg font-medium text-gray-700 flex items-center gap-2">
                {getBatteryIcon()}
                <span className="text-gray-900">{device.battery}% Battery</span>
              </span>
            </div>
          </div>

          {/* Settings Button */}
          {role && ["admin", "supervisor"].includes(role) && (
          <button
            onClick={() => setOpen(true)}
            className="absolute top-6 right-6 p-3 rounded-full bg-gray-100 hover:bg-gray-200 shadow cursor-pointer"
          >
            <FiSettings size={28} />
          </button>
        )}
        </div>

        {/* Main Content */}
        <div className="max-w-6xl mx-auto py-8 px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            <SensorCard
              title="Temperature"
              icon={<WiThermometer size={32} className="text-red-500" />}
              unit="°"
              value={device.temperature}
              min={device.minTemp}
              max={device.maxTemp}
              color={tempColor}
            />

            <SensorCard
              title="Humidity"
              icon={<WiHumidity size={32} className="text-blue-500" />}
              unit="%"
              value={device.humidity}
              min={device.minHum}
              max={device.maxHum}
              color={humColor}
            />
          </div>

          {/* Recent Readings Section */}
          <div className="w-full min-h-screen">
            <DeviceReadingData deviceId={device.id} readings={readings} deviceName={deviceName} />
          </div>
        </div>
      </div>

      {/* Modal */}
      <DeviceModal
        isOpen={open}
        onClose={() => setOpen(false)}
        deviceId= {device.id}
        name={device.name}
        minTemp={device.minTemp}
        maxTemp={device.maxTemp}
        minHum={device.minHum}
        maxHum={device.maxHum}
        interval={device.interval}
        onSave={handleSave}
      />
    </div>
  );
}
