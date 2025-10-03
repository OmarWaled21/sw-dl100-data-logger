"use client";
import { useEffect, useRef, useState } from "react";
import axios from "axios";
import Cookies from "js-cookie";

interface Device {
  device_id: string;
  name: string;
  status: "working" | "offline" | "error";
}

export default function GlobalLogNotifier() {
  const lastLogIdRef = useRef<number | null>(null);
  const [token, setToken] = useState<string | null>(Cookies.get("token") || null);

  useEffect(() => {
    if (Notification.permission !== "granted") {
      Notification.requestPermission();
    }

    const interval = setInterval(async () => {
      const currentToken = Cookies.get("token");
      if (!currentToken) return; // لو مفيش توكن، ما نعملش أي request

      try {
        // جلب status الأجهزة
        const { data: statusData } = await axios.get("http://127.0.0.1:8000/", {
          headers: { Authorization: `Token ${currentToken}` },
        });

        const devices: Device[] = statusData?.results?.devices ?? [];
        const hasErrorDevice = devices.some((d: Device) => d.status === "offline" || d.status === "error");
        if (!hasErrorDevice) return;

        // جلب آخر log
        const { data: logData } = await axios.get("http://127.0.0.1:8000/logs/latest_log/", {
          headers: { Authorization: `Token ${currentToken}` },
        });

        if (!logData || !logData.message) return;

        if (lastLogIdRef.current === null || logData.id !== lastLogIdRef.current) {
          lastLogIdRef.current = logData.id;

          if (Notification.permission === "granted") {
            const notification = new Notification("Device Alert", {
              body: `[${logData.source}] ${logData.message}`,
              icon: "/alarm-icon.png",
            });

            const audio = new Audio("/alarm.mp3");
            audio.play().catch(console.log);

            setTimeout(() => notification.close(), 5000);
          }
        }
      } catch (err: any) {
        if (err.response?.status === 401) {
          console.log("Unauthorized: User logged out, stopping notifier.");
          return; // نتجاهل أو ممكن توقف الـ interval هنا
        }
        console.error(err);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return null;
}
