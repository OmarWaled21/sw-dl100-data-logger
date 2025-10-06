"use client";
import { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import Cookies from "js-cookie";
import DeviceCard from "@/components/home/device_card";
import axios from "axios";

interface Device {
  device_id: string;
  name: string;
  status: "active" | "offline" | "error";
  temperature: number;
  humidity: number;
  min_temp: number;
  max_temp: number;
  min_hum: number;
  max_hum: number;
  battery_level: number;
}

// تحويل حالة السيرفر إلى حالة مفهومة للـ DeviceCard
const mapStatus = (status: string): "active" | "offline" | "error" => {
  switch (status.toLowerCase()) {
    case "working":
    case "active":
      return "active";
    case "offline":
      return "offline";
    case "error":
    case "sd_card_error":
    case "rtc_error":
    case "temp_sensor_error":
    case "hum_sensor_error":
      return "error";
    default:
      return "error"; // أي حالة مجهولة نعتبرها خطأ
  }
};

export default function HomePage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [serverOffset, setServerOffset] = useState<number>(0);
  const [localTime, setLocalTime] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  const wsRef = useRef<WebSocket | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    const token = Cookies.get("token");
    if (!token) return;

    // فتح WebSocket مرة واحدة فقط
    const ws = new WebSocket(`ws://127.0.0.1:8000/ws/home/?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => console.log("WebSocket connected");
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.device) {
          // تحديث جهاز واحد فقط
          setDevices(prev =>
            prev.map(d => d.device_id === data.device.device_id ? { ...d, ...data.device } : d)
          );
        } else if (data.results) {
          // البيانات كاملة أول مرة
          const mappedDevices = data.results.devices.map((d: any) => ({
            ...d,
            status: mapStatus(d.status),
          }));
          setDevices(mappedDevices);
          setServerOffset(data.results.time_difference * 60 * 1000);
          setLoading(false);
        }
      } catch (err) {
        console.error("Error parsing WS message:", err);
      }
    };

    ws.onerror = (event) => console.error("WebSocket error event:", event);

    ws.onclose = (event) => console.log(`WebSocket closed. Code: ${event.code}, Reason: ${event.reason}`);

    return () => ws.close();
  }, []);

  useEffect(() => {
    const token = Cookies.get("token");
    if (!token) return;

    const fetchServerTime = async () => {
      try {
        const res = await axios.get("http://127.0.0.1:8000/", {
          headers: {
            Authorization: `Token ${token}`,
          },
        });
        const serverTime = new Date(res.data.results.current_time);
        const offset = res.data.results.time_difference * 60 * 1000;
        setServerOffset(offset);
        setLocalTime(new Date(serverTime.getTime() + offset));
      } catch (err) {
        console.error("Error fetching server time:", err);
      }
    };

    // fetch أول مرة فورًا
    fetchServerTime();

    // fetch كل ساعة
    const interval = setInterval(fetchServerTime, 60 * 60 * 1000); // 1 ساعة
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setLocalTime(new Date());
    const localTimer = setInterval(() => setLocalTime(new Date()), 1000);

    return () => clearInterval(localTimer);
  }, []);

  if (!localTime) return null;

  const displayTime = new Date(localTime.getTime() + serverOffset);

  const formattedTime = (date: Date) => {
    const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
    const day = date.getDate();
    const month = date.toLocaleDateString("en-US", { month: "short" });
    const year = date.getFullYear();
    const time = date.toLocaleTimeString("en-US", { hour12: true });
    return `${dayName} - ${day} ${month} ${year}, ${time}`;
  };

  const totalDevices = devices.length;
  const activeDevices = devices.filter((d) => d.status === "active").length;
  const offlineDevices = devices.filter((d) => d.status === "offline").length;
  const errorDevices = devices.filter((d) => d.status === "error").length;

  return (
    <div className="p-6">
      <div className="bg-white shadow-lg rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-4 mb-6 gap-2">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">{t("device_overview")}</h1>
          <p className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-800">{formattedTime(displayTime)}</p>
        </div>

        {loading ? (
          <p>Loading...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <div className="bg-gray-800 text-white p-4 rounded-xl shadow-sm text-center">
              <h2 className="text-lg font-semibold">{t("total_devices")}</h2>
              <p className="text-2xl font-bold mt-2">{totalDevices}</p>
            </div>
            <div className="border-2 border-green-800 text-green-800 p-4 rounded-xl shadow-sm text-center">
              <h2 className="text-lg font-semibold">{t("active")}</h2>
              <p className="text-2xl font-bold mt-2">{activeDevices}</p>
            </div>
            <div className="border-2 border-red-800 text-red-800 p-4 rounded-xl shadow-sm text-center">
              <h2 className="text-lg font-semibold">{t("error")}</h2>
              <p className="text-2xl font-bold mt-2">{errorDevices}</p>
            </div>
            <div className="border-2 border-gray-800 text-gray-800 p-4 rounded-xl shadow-sm text-center">
              <h2 className="text-lg font-semibold">{t("offline")}</h2>
              <p className="text-2xl font-bold mt-2">{offlineDevices}</p>
            </div>
          </div>
        )}

        <div className="mb-4">
          <h2 className="text-xl font-bold">{t("devices")}</h2>
          <div className="h-1 w-20 bg-gray-800 rounded mt-1"></div>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {devices.map((device) => (
            <DeviceCard
              key={device.device_id}
              name={device.name}
              battery={device.battery_level}
              temperature={device.temperature}
              humidity={device.humidity}
              status={device.status}
              minTemp={device.min_temp}
              maxTemp={device.max_temp}
              minHum={device.min_hum}
              maxHum={device.max_hum}
              id={device.device_id}
            />
          ))}
        </div>
      </div>
    </div>
  );
}