"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import Cookies from "js-cookie";
import DeviceCard from "@/components/device_card";

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

  const { t, i18n } = useTranslation();

  const router = useRouter();

  const fetchData = () => {
    fetch("http://127.0.0.1:8000/", {
      headers: { Authorization: `Token ${Cookies.get("token")}` },
    })
      .then((res) => {
        return res.json();
      })
      .then((data) => {
        // نعمل mapping للحالة
        const mappedDevices = data.results.devices.map((d: any) => ({
          ...d,
          status: mapStatus(d.status),
        }));
        setDevices(mappedDevices);

        const serverDate = new Date(data.results.current_time);
        const localDate = new Date();
        setServerOffset(serverDate.getTime() - localDate.getTime());

        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
    setLocalTime(new Date());

    const localTimer = setInterval(() => {
      setLocalTime(new Date());
    }, 1000);

    const pollTimer = setInterval(() => {
      fetchData();
    }, 5000); // كل 5 ثواني نجيب آخر البيانات

    return () => {
      clearInterval(localTimer);
      clearInterval(pollTimer);
    };
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

  // حساب الأرقام
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