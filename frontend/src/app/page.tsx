"use client";
import { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import Cookies from "js-cookie";
import DeviceCard from "@/components/home/device_card";
import axios from "axios";
import { Device } from "@/types/device";
import LayoutWithNavbar from "@/components/ui/layout_with_navbar";

// تحويل حالة السيرفر إلى حالة مفهومة للـ DeviceCard
const mapStatus = (status: string): "active" | "offline" | "error" => {
  switch (status.toLowerCase()) {
    case "working":
    case "active":
      return "active";
    case "offline":
      return "offline";
    case "error":
    case "temp_sensor_error":
    case "hum_sensor_error":
    case "battery_error":
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

  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [allDevices, setAllDevices] = useState<Device[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const { t } = useTranslation();
  const role = Cookies.get("role");

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
          setAllDevices((prev) => {
            const updated = prev.map((d) =>
              d.device_id === data.device.device_id ? { ...d, ...data.device } : d
            );
            if (selectedDept) {
              setDevices(updated.filter((d: any) => d.department === selectedDept));
            } else {
              setDevices(updated);
            }
            return updated;
          });
        } else if (data.results) {
          // البيانات كاملة أول مرة
          const mappedDevices = data.results.devices.map((d: any) => ({
            ...d,
            status: mapStatus(d.status),
          }));
          setAllDevices(mappedDevices);
          setDevices(mappedDevices); // أول مرة نعرض الكل
          setServerOffset(data.results.time_difference * 60 * 1000);
          setLoading(false);
        }
      } catch (err) {
        console.error("Error parsing WS message:", err);
      }
    };

    ws.onclose = (event) => console.log(`WebSocket closed. Code: ${event.code}, Reason: ${event.reason}`);

    return () => ws.close();
  }, []);

  useEffect(() => {
    const token = Cookies.get("token");
    if (!token) return;

    axios
      .get("http://127.0.0.1:8000/departments/", {
        headers: { Authorization: `Token ${token}` },
      })
      .then((res) => {
        setDepartments(res.data); // تأكد من شكل الـ API
      })
      .catch((err) => console.error("Error fetching departments:", err));
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setAllDevices(prevAll => {
        const updated = prevAll.map(device => {
          const lastUpdate = new Date(device.last_update).getTime();
          const now = Date.now();
          // اغلاق الاغلبة بعد 10 دقايق بعد اخر تحديث
          const offlineThreshold = (device.interval_wifi ?? 0) * 60 * 1000 + 10 * 60 * 1000;

          const status =
            now - lastUpdate > offlineThreshold
              ? "offline"
              : mapStatus(device.status);

          return { ...device, status };
        });

        // نحدث الأجهزة المعروضة بناءً على القسم المختار
        setDevices(selectedDept
          ? updated.filter(d => d.department_id === Number(selectedDept))
          : updated
        );

        return updated;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [selectedDept]);

  useEffect(() => {
    const token = Cookies.get("token");
    if (!token) return;

    let retryCount = 0; 
    const maxRetries = 5;
    const retryInterval = 5000; // 5 ثواني

    const fetchServerTime = async () => {
      try {
        const res = await axios.get("http://127.0.0.1:8000/", {
          headers: {
            Authorization: `Token ${token}`,
          },
        });

        const { current_time, time_difference } = res.data.results || {};
        const serverTime = new Date(res.data.results.current_time);
        const offset = res.data.results.time_difference * 60 * 1000;
              
        // تحقق إن التاريخ صالح
        if (isNaN(serverTime.getTime()) || isNaN(offset)) {
          throw new Error("Invalid Date from server");
        }

        setServerOffset(offset);
        setLocalTime(new Date(serverTime.getTime() + offset));
        retryCount = 0; 

      } catch (err) {
        console.error(`Error fetching server time (attempt ${retryCount + 1}):`, err);

        if (retryCount < maxRetries) {
          retryCount++;
          console.log(`Retrying in ${retryInterval / 1000}s...`);
          setTimeout(fetchServerTime, retryInterval);
        } else {
          console.error("Max retries reached. Stopping attempts to fetch server time.");
        }
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

  const visibleDepartments = role === "admin"
  ? departments
  : departments.filter(d =>
      allDevices.some(dev => dev.department_id === d.id)
    );

  const totalDevices = devices.length;
  const activeDevices = devices.filter((d) => d.status === "active").length;
  const offlineDevices = devices.filter((d) => d.status === "offline").length;
  const errorDevices = devices.filter((d) => d.status === "error").length;

  return (
    <LayoutWithNavbar>
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="bg-white shadow-xl rounded-2xl p-6 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-4 mb-6 gap-2">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">{t("device_overview")}</h1>
              <p className="text-gray-500 mt-1">{t("monitor_and_manage_all_devices")}</p>
            </div>
            <div className="bg-blue-50 px-4 py-3 rounded-lg border border-blue-100">
              <p className="text-lg font-semibold text-blue-800">{formattedTime(displayTime)}</p>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              <div className="bg-gradient-to-r from-gray-800 to-gray-700 text-white p-5 rounded-xl shadow-md text-center transition-transform hover:scale-105">
                <div className="bg-gray-700 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold">{t("total_devices")}</h2>
                <p className="text-3xl font-bold mt-2">{totalDevices}</p>
              </div>
              <div className="bg-gradient-to-r from-green-50 to-green-100 border border-green-200 text-green-800 p-5 rounded-xl shadow-md text-center transition-transform hover:scale-105">
                <div className="bg-green-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold">{t("active")}</h2>
                <p className="text-3xl font-bold mt-2">{activeDevices}</p>
              </div>
              <div className="bg-gradient-to-r from-red-50 to-red-100 border border-red-200 text-red-800 p-5 rounded-xl shadow-md text-center transition-transform hover:scale-105">
                <div className="bg-red-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold">{t("error")}</h2>
                <p className="text-3xl font-bold mt-2">{errorDevices}</p>
              </div>
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200 text-gray-800 p-5 rounded-xl shadow-md text-center transition-transform hover:scale-105">
                <div className="bg-gray-200 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold">{t("offline")}</h2>
                <p className="text-3xl font-bold mt-2">{offlineDevices}</p>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white shadow-xl rounded-2xl p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-4 mb-6">
            <div className="mb-4 sm:mb-0">
              <h2 className="text-2xl font-bold text-gray-800">{t("devices")}</h2>
              <div className="h-1 w-20 bg-blue-500 rounded mt-1"></div>
            </div>
            {role === "admin" && (
            <div className="flex items-center gap-3">
              <label className="font-semibold text-gray-700">{t("department")}:</label>
              <select
                value={selectedDept || ""}
                onChange={(e) => {
                  const deptId = e.target.value || null;
                  setSelectedDept(deptId);
                  const filteredDevices = deptId
                    ? allDevices.filter(d => d.department_id === Number(deptId))
                    : allDevices;
                  setDevices(filteredDevices);
                }}
                className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                <option value="">{t("all departments")}</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          </div>

          <div className="p-2">
            {selectedDept ? (
              // لو محدد قسم معين → نعرض الأجهزة مباشرة
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
            ) : (
              // لو All Departments → نجمع الأجهزة حسب القسم
              Object.entries(
                visibleDepartments.reduce((acc: Record<string, Device[]>, dept) => {
                  acc[dept.name] = allDevices.filter(d => d.department_id === dept.id);
                  return acc;
                }, {})
              ).map(([deptName, deptDevices]) => (
                <div key={deptName} className="mb-10 last:mb-0">
                  <div className="flex items-center mb-4 pb-2 border-b border-gray-200">
                    <div className="w-3 h-8 bg-blue-500 rounded-full mr-3"></div>
                    <h2 className="text-xl font-bold text-gray-800">{deptName}</h2>
                    <span className="ml-3 bg-blue-100 text-blue-800 text-sm font-medium px-2.5 py-0.5 rounded-full">
                      {deptDevices.length} {t("devices")}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {deptDevices.map((device) => (
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
              ))
            )}
          </div>
        </div>
      </div>
    </LayoutWithNavbar>
  );
}