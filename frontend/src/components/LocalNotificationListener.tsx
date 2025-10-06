"use client";
import { useEffect, useRef, useState } from "react";
import Cookies from "js-cookie";

interface LogData {
  id: number;
  source: string;
  message: string;
}

export default function GlobalLogNotifier() {
  const lastLogIdRef = useRef<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [token, setToken] = useState<string | null>(Cookies.get("token") || null);

  useEffect(() => {
    if (Notification.permission !== "granted") {
      Notification.requestPermission();
    }

    const currentToken = Cookies.get("token");
    if (!currentToken) return;

    // 🧠 WebSocket URL — غيّر الـ host حسب السيرفر بتاعك
    const wsUrl = `ws://127.0.0.1:8000/ws/logs/latest/?token=${currentToken}`;
    // لو ngrok أو https استخدم wss://example.ngrok.io/ws/latest-log/?token=...

    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    socket.onopen = () => {
      console.log("[WebSocket] Connected to server ✅");
    };

    socket.onmessage = (event) => {
      try {
        const logData: LogData = JSON.parse(event.data);
        console.log("[WebSocket] New log:", logData);

        if (!logData || !logData.id || !logData.message) return;
        if (lastLogIdRef.current === logData.id) return; // نفس اللوج القديم

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
      } catch (err) {
        console.error("Invalid log data:", err);
      }
    };

    socket.onerror = (err) => {
      console.error("[WebSocket] Error:", err);
    };

    socket.onclose = () => {
      console.warn("[WebSocket] Connection closed, will retry...");
      // إعادة محاولة الاتصال بعد 5 ثواني
      setTimeout(() => {
        if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
          window.location.reload(); // أبسط طريقة لإعادة الاتصال
        }
      }, 5000);
    };

    return () => {
      socket.close();
    };
  }, []);

  return null;
}
