"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import Cookies from "js-cookie";
import { useTranslation } from "react-i18next";
import RoleProtected from "@/components/global/RoleProtected";
import LogsTable from "@/components/logs/LogsTable";
import DownloadPDFButton from "@/components/logs/download_pdf_logs";
import LayoutWithNavbar from "@/components/ui/layout_with_navbar";

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
  const [unreadCounts, setUnreadCounts] = useState<{ device: number; admin: number }>({ device: 0, admin: 0 });

  const [dateMode, setDateMode] = useState<"single" | "range">("single");
  const [singleDate, setSingleDate] = useState<string>("");
  const [dateRange, setDateRange] = useState<{ start?: string; end?: string }>({});
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const logsPerPage = 20;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<NodeJS.Timeout | null>(null);
  const token = Cookies.get("token");

  const { t } = useTranslation();

  // 🔹 Fetch initial logs
  const fetchInitialLogs = useCallback(async () => {
    if (!token) return;
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
    } catch (err) {
      console.error("Error fetching initial logs:", err);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  // 🔹 Fetch unread counts
  const fetchUnreadCounts = useCallback(async () => {
    if (!token) return;
    try {
      const res = await axios.get("http://127.0.0.1:8000/logs/unread/", {
        headers: { Authorization: `Token ${token}` },
      });
      setUnreadCounts({ device: res.data.device_logs, admin: res.data.admin_logs });
    } catch (err) {
      console.error("Failed fetching unread counts:", err);
    }
  }, [token]);

  // 🔹 Mark logs as read
  const markAsRead = async (type: "device" | "admin") => {
    if (!token) return;
    try {
      await axios.post(
        "http://127.0.0.1:8000/logs/read/",
        { type },
        { headers: { Authorization: `Token ${token}` } }
      );
      fetchUnreadCounts();
    } catch (err) {
      console.error("Error marking logs as read", err);
    }
  };

  // 🔹 WebSocket connection - محسّن
  useEffect(() => {
    if (!token) return;

    // إذا كان هناك اتصال مفتوح بالفعل، لا تنشئ اتصالاً جديداً
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log("🔗 Logs WebSocket already connected");
      return;
    }

    const connectWebSocket = () => {
      const ws = new WebSocket(`ws://127.0.0.1:8000/ws/logs/stream/?token=${token}`);
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
              if (prev.find((l) => l.id === log.id)) return prev;
              return [log, ...prev];
            });
            setUnreadCounts((prev) => ({ ...prev, device: prev.device + 1 }));
          } else if (msg.category === "admin_log") {
            setAdminLogs((prev) => {
              if (prev.find((l) => l.id === log.id)) return prev;
              return [log, ...prev];
            });
            setUnreadCounts((prev) => ({ ...prev, admin: prev.admin + 1 }));
          }
        } catch (err) {
          console.error("WS parse error:", err);
        }
      };

      ws.onerror = (e) => {
        console.error("[Logs WS Error ❌]", e);
      };

      ws.onclose = (e) => {        
        // إعادة الاتصال فقط للأخطاء غير متعمدة
        if (e.code !== 1000) { // 1000 = إغلاق طبيعي
          console.log("🔄 Attempting to reconnect in 3 seconds...");
          reconnectRef.current = setTimeout(() => {
            if (token) {
              connectWebSocket();
            }
          }, 3000);
        }
      };
    };

    connectWebSocket();

    return () => {
      // تنظيف مؤقت إعادة الاتصال
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current);
        reconnectRef.current = null;
      }
      
      // إغلاق WebSocket فقط إذا كان مفتوحاً
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close(1000, "Component unmounting");
      }
      wsRef.current = null;
    };
  }, [token]); // 🚨 اعتماد على token فقط

  // 🔹 Initial load
  useEffect(() => {
    fetchInitialLogs();
    fetchUnreadCounts();
  }, [fetchInitialLogs, fetchUnreadCounts]);

  const logs = activeTab === "device" ? deviceLogs : adminLogs;

  // 2️⃣ عمل فلترة frontend قبل عرض الجدول
  const filteredLogs = logs.filter((log) => {
    let pass = true;

    // فلترة حسب النوع
    if (typeFilter) pass = pass && log.type === typeFilter;

    // تاريخ اللوج بدون الوقت
    const logDate = new Date(log.timestamp);
    const logDateOnly = new Date(logDate.getFullYear(), logDate.getMonth(), logDate.getDate());

    if (dateMode === "single" && singleDate) {
      const [year, month, day] = singleDate.split("-").map(Number);
      const singleDateOnly = new Date(year, month - 1, day);
      pass = pass && logDateOnly.getTime() === singleDateOnly.getTime();
    } else if (dateMode === "range") {
      if (dateRange.start) {
        const [sy, sm, sd] = dateRange.start.split("-").map(Number);
        const startDate = new Date(sy, sm - 1, sd);
        pass = pass && logDateOnly >= startDate;
      }
      if (dateRange.end) {
        const [ey, em, ed] = dateRange.end.split("-").map(Number);
        const endDate = new Date(ey, em - 1, ed);
        pass = pass && logDateOnly <= endDate; // inclusive اليوم الأخير
      }
    }

    return pass;
  });


  // Pagination logic
  const totalPages = Math.ceil(filteredLogs.length / logsPerPage);
  const indexOfLastLog = currentPage * logsPerPage;
  const indexOfFirstLog = indexOfLastLog - logsPerPage;
  const currentLogs = filteredLogs.slice(indexOfFirstLog, indexOfLastLog);

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };
  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  // Reset to page 1 when tab changes
  useEffect(() => {
    setCurrentPage(1);
    markAsRead(activeTab);
  }, [activeTab]);

  return (
    <LayoutWithNavbar>
      <RoleProtected allowedRoles={["admin", "manager", "supervisor"]}>
        <div className="min-h-screen bg-white p-6">
          <div className="max-w-7xl mx-auto">
            {/* Header Section */}
            <div className="mb-8">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">{t("System Logs")}</h1>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <p className="text-gray-600 text-sm">{t("Real-time monitoring active")}</p>
                    </div>
                    <div className="hidden sm:flex items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        {t("Device Logs")}: {deviceLogs.length}
                      </span>
                      <span className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                        {t("Admin Logs")}: {adminLogs.length}
                      </span>
                    </div>
                  </div>
                </div>
                <DownloadPDFButton logs={currentLogs} />
              </div>
            </div>

            {/* Main Content Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              {/* Tabs Section */}
              <div className="border-b border-gray-200 bg-gray-50/50 px-6 py-4">
                <div className="flex justify-between">
                  <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
                    <button
                      onClick={() => setActiveTab("device")}
                      className={`relative px-6 py-3 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center gap-2 cursor-pointer ${
                        activeTab === "device"
                          ? "bg-white text-blue-700 shadow-sm"
                          : "text-gray-600 hover:text-gray-800"
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      {t("Device Logs")}
                      {unreadCounts.device > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                          {unreadCounts.device}
                        </span>
                      )}
                    </button>

                    <button
                      onClick={() => setActiveTab("admin")}
                      className={`relative px-6 py-3 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center gap-2 cursor-pointer ${
                        activeTab === "admin"
                          ? "bg-white text-purple-700 shadow-sm"
                          : "text-gray-600 hover:text-gray-800"
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      {t("Admin Logs")}
                      {unreadCounts.admin > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                          {unreadCounts.admin}
                        </span>
                      )}
                    </button>
                  </div>
                  <div className="flex gap-4 items-center mb-4">
                    {/* Switch */}
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="dateMode"
                        value="single"
                        checked={dateMode === "single"}
                        onChange={() => setDateMode("single")}
                      />
                      {t("Single Date")}
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="dateMode"
                        value="range"
                        checked={dateMode === "range"}
                        onChange={() => setDateMode("range")}
                      />
                      {t("Date Range")}
                    </label>

                    {/* Conditional Inputs */}
                    {dateMode === "single" ? (
                      <input
                        type="date"
                        value={singleDate}
                        max={new Date().toISOString().split("T")[0]} // يمنع اختيار بعد اليوم
                        onChange={(e) => setSingleDate(e.target.value)}
                        className="border px-2 py-1 rounded"
                      />
                    ) : (
                      <>
                        <input
                          type="date"
                          value={dateRange.start || ""}
                          max={new Date().toISOString().split("T")[0]} // start لا يمكن بعد اليوم
                          onChange={(e) =>
                            setDateRange((prev) => {
                              const newStart = e.target.value;
                              let newEnd = prev.end;

                              // لو end أقل من start الجديد، نعمله مساوي للـ start
                              if (newEnd && newEnd < newStart) newEnd = newStart;

                              return { ...prev, start: newStart, end: newEnd };
                            })
                          }
                          className="border px-2 py-1 rounded"
                        />

                        <input
                          type="date"
                          value={dateRange.end || ""}
                          min={dateRange.start || undefined} // end لا يمكن أقل من start
                          max={new Date().toISOString().split("T")[0]} // end لا يمكن بعد اليوم
                          onChange={(e) =>
                            setDateRange((prev) => ({ ...prev, end: e.target.value }))
                          }
                          className="border px-2 py-1 rounded"
                        />
                      </>

                    )}
                  </div>

                </div>
              </div>

              {/* Logs Table Section */}
              <div className="p-6">
                <LogsTable logs={currentLogs} isLoading={isLoading} mode={activeTab} />

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-6 pt-6 border-t border-gray-200">
                    <p className="text-sm text-gray-600">
                      {t("showing")} <span className="font-semibold">{indexOfFirstLog + 1}-{Math.min(indexOfLastLog, logs.length)}</span> {t("of")}{" "}
                      <span className="font-semibold">{logs.length}</span> {t("logs")}
                    </p>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handlePrevPage}
                        disabled={currentPage === 1}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center gap-2 cursor-pointer"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        {t("previous")}
                      </button>
                      
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNum;
                          if (totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i;
                          } else {
                            pageNum = currentPage - 2 + i;
                          }
                          
                          return (
                            <button
                              key={pageNum}
                              onClick={() => setCurrentPage(pageNum)}
                              className={`w-8 h-8 text-sm font-medium rounded-lg transition-colors duration-200 cursor-pointer ${
                                currentPage === pageNum
                                  ? "bg-blue-600 text-white"
                                  : "text-gray-600 hover:bg-gray-100"
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                      </div>
                      
                      <button
                        onClick={handleNextPage}
                        disabled={currentPage === totalPages}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center gap-2 cursor-pointer"
                      >
                        {t("next")}
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-blue-700">{t("Device Logs")}</p>
                    <p className="text-2xl font-bold text-blue-900">{deviceLogs.length}</p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-xl p-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-purple-700">{t("Admin Logs")}</p>
                    <p className="text-2xl font-bold text-purple-900">{adminLogs.length}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </RoleProtected>
    </LayoutWithNavbar>
  );
}