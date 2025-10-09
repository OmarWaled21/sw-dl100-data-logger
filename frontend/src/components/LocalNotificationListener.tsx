"use client";
import { useEffect, useRef, useState } from "react";
import Cookies from "js-cookie";

interface LogData {
  id: number;
  source: string;
  message: string;
  timestamp?: string;
}

export default function GlobalLogNotifier() {
  const lastLogIdRef = useRef<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [token, setToken] = useState<string | null>(Cookies.get("token") || null);
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  // ✅ فتح الصوت بعد أول تفاعل من المستخدم
  useEffect(() => {
    const unlockAudio = () => {
      const a = new Audio();
      a.play().catch(() => {});
      setAudioUnlocked(true);
      console.log("%c🔊 Audio unlocked after user interaction.", "color: green;");
      window.removeEventListener("click", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };

    window.addEventListener("click", unlockAudio);
    window.addEventListener("keydown", unlockAudio);

    return () => {
      window.removeEventListener("click", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
  }, []);

  // ✅ WebSocket logic
  useEffect(() => {
    if (!token) return;

    if (Notification.permission !== "granted") {
      Notification.requestPermission();
    }

    const wsUrl = `ws://127.0.0.1:8000/ws/logs/latest/?token=${token}`;
    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    socket.onopen = () => {
      console.log("%c[WebSocket Connected ✅]", "color: green;");
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };

    socket.onmessage = (event) => {
      try {
        const logData: LogData = JSON.parse(event.data);
        console.log("[WebSocket] Received:", logData);

        // تأكيد إن الرسالة جديدة
        if (!logData?.id || lastLogIdRef.current === logData.id) return;
        lastLogIdRef.current = logData.id;

        // ✅ Notification + صوت تنبيه
        if (Notification.permission === "granted") {
          const notif = new Notification("New Log Alert", {
            body: `[${logData.source}] ${logData.message}`,
            icon: "/alarm-icon.png",
          });

          if (audioUnlocked) {
            const audio = new Audio("/alarm.mp3");
            audio.play().catch(() => console.log("🔇 Audio autoplay blocked."));
          } else {
            console.warn("⚠️ Waiting for user interaction to unlock audio.");
          }

          setTimeout(() => notif.close(), 5000);
        }
      } catch (error) {
        console.error("Invalid message format:", error);
      }
    };

    socket.onclose = (e) => {
      console.warn("[WebSocket Closed ❌]", e.reason || "no reason");
      reconnectTimeoutRef.current = setTimeout(() => {
        console.log("🔁 Reconnecting WebSocket...");
        window.location.reload(); // أبسط طريقة
      }, 5000);
    };

    return () => {
      socket.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [token, audioUnlocked]);

  return null;
}
