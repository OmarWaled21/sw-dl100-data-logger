"use client";

import React from "react";

interface Log {
  id: number;
  source?: string;
  user?: string | number;
  role?: string;
  admin?: number;
  error_type?: string;
  action?: string;
  type?: string;
  message: string;
  timestamp: string;
}

interface LogsTableProps {
  logs: Log[];
  isLoading: boolean;
  mode: "device" | "admin";
}

export default function LogsTable({ logs, isLoading, mode }: LogsTableProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="flex flex-col items-center">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-4 border-gray-200 border-t-blue-500 animate-spin"></div>
          </div>
          <p className="mt-3 text-gray-600 text-sm font-medium">Loading logs...</p>
        </div>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
          <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No logs found</h3>
        <p className="text-gray-500 max-w-sm">No logs match your current search criteria. Try adjusting your filters.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Time</th>
              {mode === "device" ? (
                <>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Device</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Error Type</th>
                </>
              ) : (
                <>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">User</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Type</th>
                </>
              )}
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Message</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50 transition-all duration-150 group">
                {/* Time */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {new Date(log.timestamp).toLocaleDateString()}
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </div>
                </td>

                {/* Conditional cells */}
                {mode === "device" ? (
                  <>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-2 h-2 rounded-full bg-blue-500 mr-2"></div>
                        <span className="text-sm font-medium text-gray-900">{log.source || "-"}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {log.error_type ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-100">
                          {log.error_type}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold mr-3">
                          {typeof log.user === "string" ? log.user.charAt(0).toUpperCase() : "U"}
                        </div>
                        <span className="text-sm font-medium text-gray-900">
                          {log.role && log.user
                            ? `${String(log.role).charAt(0).toUpperCase() + String(log.role).slice(1)} ${String(log.user).charAt(0).toUpperCase() + String(log.user).slice(1)}`
                            : typeof log.user === "string"
                            ? String(log.user).charAt(0).toUpperCase() + String(log.user).slice(1)
                            : `User #${log.user}`}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900">{log.action || log.type || "-"}</span>
                    </td>
                  </>
                )}

                {/* Message */}
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-700 max-w-md">
                    <div className="line-clamp-2 group-hover:line-clamp-none transition-all duration-200">
                      {log.message}
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
