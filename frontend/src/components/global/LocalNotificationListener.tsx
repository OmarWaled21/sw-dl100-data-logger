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
  const [token] = useState<string | null>(Cookies.get("token") || null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  // 🔊 إعداد عنصر الصوت مرة واحدة
  useEffect(() => {
    audioRef.current = new Audio("/alarm.mp3");
    audioRef.current.load();
    audioRef.current.preload = "auto";

    const unlockAudio = () => {
      if (audioRef.current) {
        audioRef.current.muted = true;  // ⛔ كتم الصوت أثناء التشغيل
        audioRef.current.play().catch(() => {});
        audioRef.current.pause();        // نوقفه فورًا
        audioRef.current.currentTime = 0;
        audioRef.current.muted = false;  // ✅ نرجّع الصوت عادي بعد الكتم
      }

      setAudioUnlocked(true);
      console.log("%c🔊 Audio unlocked after user interaction.", "color: green");
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

  // 🌐 WebSocket
  useEffect(() => {
    if (!token) return;

    if (Notification.permission !== "granted") {
      Notification.requestPermission();
    }

    const wsUrl = `ws://127.0.0.1:8000/ws/logs/latest/?token=${token}`;
    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    socket.onopen = () => {
      console.log("%c[WebSocket Connected ✅]", "color: green");
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };

    socket.onmessage = (event) => {
      console.log("%c[WS] 📩 Raw Message Received:", "color: cyan", event.data);
      try {
        const msg = JSON.parse(event.data);
        console.log("%c[WS] ✅ Parsed Message:", "color: green", msg);

        if (!msg?.category || !msg?.data) return;
        const logData: LogData = msg.data;

        console.log("%c[WS] 🔔 New Log Data:", "color: yellow", logData);

        if (!logData.id || lastLogIdRef.current === logData.id) return;
        lastLogIdRef.current = logData.id;

        // Notification
        if (Notification.permission === "granted") {
          const notif = new Notification("New Log Alert", {
            body: `[${logData.source}] ${logData.message}`,
            icon: "/alarm-icon.png",
          });
          setTimeout(() => notif.close(), 5000);
        }

        // Play audio if unlocked
        if (audioUnlocked && audioRef.current) {
          audioRef.current.currentTime = 0; // Restart from beginning
          audioRef.current.play().catch(() => console.log("🔇 Audio autoplay blocked."));
        } else if (!audioUnlocked) {
          console.warn("⚠️ Waiting for user interaction to unlock audio.");
        }

      } catch (error) {
        console.error("Invalid WebSocket message format:", error);
      }
    };

    socket.onerror = (e) => {
      console.error("[WebSocket Error ❌]", e, socket.readyState, socket.url);
    };

    socket.onclose = (e) => {
      console.warn(
        `[WebSocket Closed ❌] Code: ${e.code} | Reason: ${e.reason || "none"} | Clean: ${e.wasClean}`
      );
    };

    return () => {
      socket.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [token, audioUnlocked]);

  return null;
}
