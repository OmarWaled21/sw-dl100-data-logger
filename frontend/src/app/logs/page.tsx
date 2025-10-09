"use client";

import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import Cookies from "js-cookie";
import RoleProtected from "@/components/RoleProtected";
import LogsTable from "@/components/logs/LogsTable";
import DownloadPDFButton from "@/components/logs/download_pdf_logs";

export default function LogsPage() {
  const [activeTab, setActiveTab] = useState<"device" | "admin">("device");
  const [deviceLogs, setDeviceLogs] = useState([]);
  const [adminLogs, setAdminLogs] = useState([]);
  const [unreadDevice, setUnreadDevice] = useState(0);
  const [unreadAdmin, setUnreadAdmin] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = Cookies.get("token");
      const [deviceRes, adminRes] = await Promise.all([
        axios.get("http://127.0.0.1:8000/logs/device/", { headers: { Authorization: `Token ${token}` } }),
        axios.get("http://127.0.0.1:8000/logs/admin/", { headers: { Authorization: `Token ${token}` } }),
      ]);
      setDeviceLogs(deviceRes.data.results || []);
      setAdminLogs(adminRes.data.results || []);
      setUnreadDevice(deviceRes.data.unread_count || 0);
      setUnreadAdmin(adminRes.data.unread_count || 0);

      // Mark as read automatically
      await axios.post("http://127.0.0.1:8000/logs/mark-read/", { all: true }, {
        headers: { Authorization: `Token ${token}` },
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const logs = activeTab === "device" ? deviceLogs : adminLogs;

  return (
    <RoleProtected allowedRoles={["admin", "manager", "supervisor"]}>
      <div className="p-6">
        <div className="bg-white shadow-lg rounded-2xl p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">System Logs</h1>
              <p className="text-gray-600 text-sm">View and manage system logs</p>
            </div>
            <DownloadPDFButton logs={logs} />
          </div>

          {/* Toggle Buttons */}
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
              {unreadDevice > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {unreadDevice}
                </span>
              )}
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
              {unreadAdmin > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {unreadAdmin}
                </span>
              )}
            </button>
          </div>

          {/* Logs Table */}
          <LogsTable logs={logs} isLoading={isLoading} mode={activeTab} />
        </div>
      </div>
    </RoleProtected>
  );
}
