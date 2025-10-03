"use client";

import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import Cookies from "js-cookie";
import DownloadPDFButton from "@/components/logs/download_pdf_logs";
import RoleProtected from "@/components/RoleProtected";

interface Log {
  id: number;
  source: string;
  error_type?: string;
  message: string;
  timestamp: string;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [filterMode, setFilterMode] = useState<"single" | "range">("single");
  const [singleDate, setSingleDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [currentTime, setCurrentTime] = useState("");


  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: any = {};

      if (filterMode === "single" && singleDate) params.filter_date = singleDate;
      if (filterMode === "range" && startDate && endDate) {
        params.start_date = startDate;
        params.end_date = endDate;
      }

      if (deviceName) params.device_name = deviceName;

      const response = await axios.get("http://127.0.0.1:8000/logs/", {
        params,
        headers: { Authorization: `Token ${Cookies.get("token")}` },
      });
      setLogs(response.data.results);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [singleDate, startDate, endDate, deviceName, filterMode]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const clearFilters = () => {
    setSingleDate("");
    setStartDate("");
    setEndDate("");
    setDeviceName("");
  };

  const logsPerPage = 20;
  const indexOfLastLog = currentPage * logsPerPage;
  const indexOfFirstLog = indexOfLastLog - logsPerPage;
  const currentLogs = logs.slice(indexOfFirstLog, indexOfLastLog);
  const totalPages = Math.ceil(logs.length / logsPerPage);
  const hasNextPage = currentPage < totalPages;
  const hasPreviousPage = currentPage > 1;

  useEffect(() => {
    setCurrentPage(1);
  }, [logs]);

  const goToNextPage = () => {
    if (hasNextPage) {
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPreviousPage = () => {
    if (hasPreviousPage) {
      setCurrentPage(currentPage - 1);
    }
  };

  return (
    <RoleProtected allowedRoles={["admin", "supervisor"]}>
      <div className="p-6">
        <div className="bg-white shadow-lg rounded-2xl p-6">
          <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-10xl mx-auto">
              {/* Header */}
              <div className="mb-6 flex justify-between items-center">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 mb-1">System Logs</h1>
                  <p className="text-gray-600 text-sm">View and manage system logs</p>
                </div>
                <DownloadPDFButton logs={logs} />
              </div>

              {/* Filters */}
              <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6 shadow-sm">
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
                  {/* Filter Mode Toggle */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => setFilterMode("single")}
                      className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                        filterMode === "single"
                          ? "bg-blue-100 text-blue-700 border border-blue-200"
                          : "bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200"
                      }`}
                    >
                      Single Date
                    </button>
                    <button
                      onClick={() => setFilterMode("range")}
                      className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                        filterMode === "range"
                          ? "bg-blue-100 text-blue-700 border border-blue-200"
                          : "bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200"
                      }`}
                    >
                      Date Range
                    </button>
                  </div>

                  {/* Date Inputs */}
                  <div className="flex flex-col sm:flex-row gap-3 flex-1">
                    {filterMode === "single" ? (
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                        <input
                          type="date"
                          value={singleDate}
                          onChange={(e) => setSingleDate(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    ) : (
                      <>
                        <div className="flex-1">
                          <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
                          <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
                          <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                      </>
                    )}
                  </div>

                  {/* Device Name */}
                  <div className="flex-1 w-full sm:w-auto">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Device Name</label>
                    <input
                      type="text"
                      placeholder="Search by device name..."
                      value={deviceName}
                      onChange={(e) => setDeviceName(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button
                      onClick={clearFilters}
                      className="px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>

              {/* Logs Table */}
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-gray-900">
                      Logs <span className="text-gray-500">({logs.length})</span>
                    </h2>
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Updated: {currentTime}
                    </div>
                  </div>
                </div>
                
                {isLoading ? (
                  <div className="flex justify-center items-center py-8">
                    <div className="flex flex-col items-center">
                      <svg className="animate-spin h-6 w-6 text-blue-600 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <p className="text-gray-600 text-sm">Loading logs...</p>
                    </div>
                  </div>
                ) : logs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <svg className="h-8 w-8 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h3 className="text-sm font-medium text-gray-900 mb-1">No logs found</h3>
                    <p className="text-gray-500 text-xs">No logs match your current search criteria.</p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Device</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Error Type</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Message</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {currentLogs.map((log) => (
                            <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                {new Date(log.timestamp).toLocaleString()}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                {log.source || <span className="text-gray-400">-</span>}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm">
                                {log.error_type ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                                    {log.error_type}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900 max-w-md">
                                <div className="truncate" title={log.message}>
                                  {log.message}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-700">
                          Showing <span className="font-medium">{indexOfFirstLog + 1}</span> to{" "}
                          <span className="font-medium">
                            {Math.min(indexOfLastLog, logs.length)}
                          </span> of{" "}
                          <span className="font-medium">{logs.length}</span> results
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={goToPreviousPage}
                            disabled={!hasPreviousPage}
                            className={`px-3 py-1 text-sm rounded-md border transition-colors ${
                              hasPreviousPage
                                ? "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                                : "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                            }`}
                          >
                            Previous
                          </button>
                          <button
                            onClick={goToNextPage}
                            disabled={!hasNextPage}
                            className={`px-3 py-1 text-sm rounded-md border transition-colors ${
                              hasNextPage
                                ? "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                                : "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                            }`}
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </RoleProtected>
  );
}