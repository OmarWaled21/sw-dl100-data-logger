"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import Cookies from "js-cookie";
import RoleProtected from "@/components/RoleProtected";
import LogsTable from "@/components/logs/LogsTable";
import DownloadPDFButton from "@/components/logs/download_pdf_logs";

interface Log {
  id: number;
  source?: string;
  user?: string | number;
  role?: string;
  error_type?: string;
  action?: string;
  type?: string;
  message: string;
  timestamp: string;
}

export default function LogsPage() {
  const [activeTab, setActiveTab] = useState<"device" | "admin">("device");
  const [deviceLogs, setDeviceLogs] = useState<Log[]>([]);
  const [adminLogs, setAdminLogs] = useState<Log[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<NodeJS.Timeout | null>(null);
  const token = Cookies.get("token");

  // ⏩ تحميل أولي للوجات من الـ API (history)
  const fetchInitialLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const [deviceRes, adminRes] = await Promise.all([
        axios.get("http://127.0.0.1:8000/logs/device/", {
          headers: { Authorization: `Token ${token}` },
        }),
        axios.get("http://127.0.0.1:8000/logs/admin/", {
          headers: { Authorization: `Token ${token}` },
        }),
      ]);
      setDeviceLogs(deviceRes.data.results || []);
      setAdminLogs(adminRes.data.results || []);
    } catch (e) {
      console.error("Error fetching initial logs:", e);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  // 🔄 WebSocket connection
  useEffect(() => {
    if (!token) return;

    const ws = new WebSocket(`ws://127.0.0.1:8000/ws/logs/latest/?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("%c[Logs WS Connected ✅]", "color: green;");
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (!msg?.category || !msg?.data) return;
        const log = msg.data;

        if (msg.category === "device_log") {
          setDeviceLogs((prev) => {
            if (prev.find((l) => l.id === log.id)) return prev; // لو موجود بالفعل
            return [log, ...prev];
          });
        } else if (msg.category === "admin_log") {
          setAdminLogs((prev) => {
            if (prev.find((l) => l.id === log.id)) return prev;
            return [log, ...prev];
          });
        }

        console.log("🟢 New log received:", msg.category, log);
      } catch (err) {
        console.error("WS parse error:", err);
      }
    };

    ws.onclose = (e) => {
      console.warn("[Logs WS Closed ❌]", e.reason || "no reason");
      reconnectRef.current = setTimeout(() => {
        console.log("🔁 Reconnecting WebSocket...");
        window.location.reload();
      }, 5000);
    };

    ws.onerror = (e) => {
      console.error("[Logs WS Error ❌]", e);
      ws.close();
    };

    return () => {
      ws.close();
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
    };
  }, [token]);

  // 📥 تحميل أولي عند الدخول
  useEffect(() => {
    fetchInitialLogs();
  }, [fetchInitialLogs]);

  const logs = activeTab === "device" ? deviceLogs : adminLogs;

  return (
    <RoleProtected allowedRoles={["admin", "manager", "supervisor"]}>
      <div className="p-6">
        <div className="bg-white shadow-lg rounded-2xl p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">System Logs</h1>
              <p className="text-gray-600 text-sm">Real-time logs via WebSocket</p>
            </div>
            <DownloadPDFButton logs={logs} />
          </div>

          {/* Tabs */}
          <div className="flex gap-3 mb-6">
            <button
              onClick={() => setActiveTab("device")}
              className={`relative px-4 py-2 rounded-lg border text-sm font-medium ${
                activeTab === "device"
                  ? "bg-blue-100 text-blue-700 border-blue-300"
                  : "bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200"
              }`}
            >
              Device Logs
            </button>

            <button
              onClick={() => setActiveTab("admin")}
              className={`relative px-4 py-2 rounded-lg border text-sm font-medium ${
                activeTab === "admin"
                  ? "bg-blue-100 text-blue-700 border-blue-300"
                  : "bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200"
              }`}
            >
              Admin Logs
            </button>
          </div>

          <LogsTable logs={logs} isLoading={isLoading} mode={activeTab} />
        </div>
      </div>
    </RoleProtected>
  );
}
