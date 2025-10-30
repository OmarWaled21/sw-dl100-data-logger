"use client";

import { useEffect, useState } from "react";
import { Device } from "@/types/device";
import LayoutWithNavbar from "@/components/ui/layout_with_navbar";
import Cookies from "js-cookie";
import { useIP } from "@/lib/IPContext";

export default function SecurityScreen() {
  const [devices, setDevices] = useState<Device[]>([]);
  const statusOrder: Record<Device["status"], number> = { offline: 0, error: 1, active: 2 };

  const { ipHost, ipLoading } = useIP();

  useEffect(() => {
    if (ipLoading) return;

    const ws = new WebSocket(`wss://${ipHost}/ws/home/?token=${Cookies.get("token")}`);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.message === "Initial Devices") {
        setDevices((data.results.devices as Device[]).sort((a, b) => statusOrder[a.status] - statusOrder[b.status]));
      } else if (data.message === "Device Updated") {
        setDevices((prev) =>
          prev.map((d) => (d.device_id === (data.device as Device).device_id ? (data.device as Device) : d))
        );
      }
    };

    return () => ws.close();
  }, [ipHost, ipLoading]);

  const getStatusIcon = (status: Device["status"]) => {
    switch (status) {
      case "active":
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      case "error":
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
      case "offline":
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  const getStatusColor = (status: Device["status"]) => {
    switch (status) {
      case "active":
        return {
          bg: "bg-green-50 border-green-200",
          text: "text-green-700",
          icon: "text-green-500",
          badge: "bg-green-100 text-green-800"
        };
      case "error":
        return {
          bg: "bg-orange-50 border-orange-200",
          text: "text-orange-700",
          icon: "text-orange-500",
          badge: "bg-orange-100 text-orange-800"
        };
      case "offline":
        return {
          bg: "bg-red-50 border-red-200",
          text: "text-red-700",
          icon: "text-red-500",
          badge: "bg-red-100 text-red-800"
        };
    }
  };

  const getMetricIcon = (type: 'temp' | 'humidity' | 'battery') => {
    switch (type) {
      case 'temp':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v4m0 14v-4m9 4a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'humidity':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
          </svg>
        );
      case 'battery':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10.5h.375c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125H21M3.75 18h15A2.25 2.25 0 0021 15.75v-6a2.25 2.25 0 00-2.25-2.25h-15A2.25 2.25 0 001.5 9.75v6A2.25 2.25 0 003.75 18z" />
          </svg>
        );
    }
  };

  return (
    <LayoutWithNavbar fullScreen>
      <div className="min-h-screen bg-white p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            
            {/* Stats Summary */}
            <div className="flex flex-wrap gap-4 mt-6">
              <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm font-medium text-gray-700">Active: </span>
                  <span className="text-sm font-semibold text-gray-900">
                    {devices.filter(d => d.status === 'active').length}
                  </span>
                </div>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                  <span className="text-sm font-medium text-gray-700">Error: </span>
                  <span className="text-sm font-semibold text-gray-900">
                    {devices.filter(d => d.status === 'error').length}
                  </span>
                </div>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span className="text-sm font-medium text-gray-700">Offline: </span>
                  <span className="text-sm font-semibold text-gray-900">
                    {devices.filter(d => d.status === 'offline').length}
                  </span>
                </div>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span className="text-sm font-medium text-gray-700">Total: </span>
                  <span className="text-sm font-semibold text-gray-900">{devices.length}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Devices Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {devices.map((device) => {
              const statusColors = getStatusColor(device.status);
              
              return (
                <div
                  key={device.device_id}
                  className={`bg-white border-2 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300 ${statusColors.bg}`}
                >
                  {/* Device Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-gray-900 truncate mb-1">
                        {device.name}
                      </h3>
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusColors.badge}`}>
                        <span className={`${statusColors.icon}`}>
                          {getStatusIcon(device.status)}
                        </span>
                        <span className="capitalize">{device.status}</span>
                      </div>
                    </div>
                    <div className="w-10 h-10 bg-white rounded-lg border border-gray-200 flex items-center justify-center shadow-sm">
                      <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                  </div>

                  {/* Device ID */}
                  <p className="text-xs text-gray-500 font-mono mb-4 truncate">
                    ID: {device.device_id}
                  </p>

                  {/* Department */}
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">
                          {getMetricIcon('temp')}
                        </span>
                        <span className="text-sm font-medium text-gray-700">Department</span>
                      </div>
                      <span className="text-sm font-semibold text-gray-900">
                        {device.department_name}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Empty State */}
          {devices.length === 0 && (
            <div className="text-center py-12">
              <div className="w-24 h-24 mx-auto mb-4 text-gray-300">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No devices found</h3>
              <p className="text-gray-500">Devices will appear here when connected to the system.</p>
            </div>
          )}
        </div>
      </div>
    </LayoutWithNavbar>
  );
}