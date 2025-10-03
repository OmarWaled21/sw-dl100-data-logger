"use client";
import React, { useEffect, useState } from "react";
import axios from "axios";
import Cookies from "js-cookie";
import { downloadDevicePdf } from "./download_pdf_device";

interface Props {
  deviceId: string;
}

interface Reading {
  temperature: number;
  humidity: number;
  timestamp: string;
}

export default function DeviceReadingTable({ deviceId }: Props) {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [deviceName, setDeviceName] = useState("");
  const [loading, setLoading] = useState(true);

  // Filter states
  const [filtering, setFiltering] = useState(false);
  const [filterType, setFilterType] = useState<"single" | "range">("single");
  const [filterDateStart, setFilterDateStart] = useState<string>("");
  const [filterDateEnd, setFilterDateEnd] = useState<string>("");

  const [currentPage, setCurrentPage] = useState(0);
  const pageSize = 10;

  useEffect(() => {
    const fetchReadings = async () => {
      if (readings.length > 0) setFiltering(true); // لو فيه بيانات، ده فلترة
      else setLoading(true); // أول تحميل

      try {
        const params: any = {};
        if (filterType === "single" && filterDateStart) params.filter_date = filterDateStart;
        else if (filterType === "range" && filterDateStart && filterDateEnd) {
          params.start_date = filterDateStart;
          params.end_date = filterDateEnd;
        }

        const res = await axios.get(
          `http://127.0.0.1:8000/device/${deviceId}/readings/`,
          {
            headers: { Authorization: `Token ${Cookies.get("token")}` },
            params,
          }
        );

        setReadings(res.data.readings || []);
        setDeviceName(res.data.device_name || deviceId);
        setCurrentPage(0);
      } catch (error) {
        console.error("Error fetching readings:", error);
      } finally {
        setLoading(false);
        setFiltering(false);
      }
    };

    fetchReadings();
  }, [deviceId, filterType, filterDateStart, filterDateEnd]);

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  };

  const totalPages = Math.ceil(readings.length / pageSize);
  const start = currentPage * pageSize;
  const end = start + pageSize;
  const pageData = readings.slice(start, end);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-8 border border-gray-200">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-48 mb-6"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex space-x-4">
                <div className="h-12 bg-gray-200 rounded flex-1"></div>
                <div className="h-12 bg-gray-200 rounded flex-1"></div>
                <div className="h-12 bg-gray-200 rounded flex-1"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Recent Readings</h2>
          <p className="text-gray-500 text-sm mt-1">
            Real-time temperature and humidity data
          </p>
        </div>

        {/* Right section */}
        <div>
          <div className="flex items-center justify-end space-x-4">
            {/* Live indicator */}
            <div className="flex items-center space-x-2 bg-blue-50 px-4 py-2 rounded-xl">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <span className="text-blue-700 text-sm font-medium">Live</span>
            </div>

            {/* Download PDF */}
            <button
              onClick={() => downloadDevicePdf(readings, deviceName, filterType, filterDateStart, filterDateEnd)}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition-all duration-200 cursor-pointer"
            >
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"
                />
              </svg>
              Download PDF
            </button>
          </div>

          {/* Filter type */}
          <div className="flex items-center justify-end space-x-4 pt-4">
            <label className="text-sm font-medium text-gray-700">Filter type:</label>
            <div className="flex items-center space-x-2">
              <label className="flex items-center space-x-1">
                <input
                  type="radio"
                  checked={filterType === "single"}
                  onChange={() => setFilterType("single")}
                  className="accent-blue-600"
                />
                <span>Single Date</span>
              </label>
              <label className="flex items-center space-x-1">
                <input
                  type="radio"
                  checked={filterType === "range"}
                  onChange={() => setFilterType("range")}
                  className="accent-blue-600"
                />
                <span>Date Range</span>
              </label>
            </div>
          </div>

          {/* Filter inputs */}
          <div className="flex items-center justify-end space-x-2 pt-2">
            {filterType === "single" ? (
              <input
                type="date"
                value={filterDateStart}
                onChange={(e) => setFilterDateStart(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-xl text-sm"
              />
            ) : (
              <>
                <input
                  type="date"
                  value={filterDateStart}
                  onChange={(e) => setFilterDateStart(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-xl text-sm"
                />
                <span className="text-gray-500">to</span>
                <input
                  type="date"
                  value={filterDateEnd}
                  onChange={(e) => setFilterDateEnd(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-xl text-sm"
                />
              </>
            )}
            {(filterDateStart || filterDateEnd) && (
              <button
                onClick={() => {
                  setFilterDateStart("");
                  setFilterDateEnd("");
                }}
                className="px-3 py-2 bg-gray-200 rounded-xl text-sm hover:bg-gray-300 transition"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>
      
      {loading && readings.length === 0 ? (
        // Loading skeleton
        <div className="animate-pulse p-4 bg-gray-100 rounded-xl">
          <div className="h-8 bg-gray-200 rounded w-48 mb-6"></div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex space-x-4 mb-2">
              <div className="h-12 bg-gray-200 rounded flex-1"></div>
              <div className="h-12 bg-gray-200 rounded flex-1"></div>
              <div className="h-12 bg-gray-200 rounded flex-1"></div>
            </div>
          ))}
        </div>
      ) : (
      <div className={`transition-all duration-300 ${filtering ? 'opacity-50' : 'opacity-100'}`}>
        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-gray-200">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-gray-50 to-gray-100/80 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Timestamp</span>
                  </div>
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    <span>Temperature</span>
                  </div>
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                    </svg>
                    <span>Humidity</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {pageData.map((reading, index) => (
                <tr 
                  key={index} 
                  className="hover:bg-gray-50/80 transition-colors duration-200 group"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                      {formatTimestamp(reading.timestamp)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-lg font-semibold text-gray-900">
                      {reading.temperature}°
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <div className="text-lg font-semibold text-gray-900">
                        {reading.humidity}%
                      </div>
                      <div className={`w-2 h-2 rounded-full ${
                        reading.humidity > 70 ? 'bg-blue-600' : 
                        reading.humidity > 40 ? 'bg-blue-400' : 'bg-blue-300'
                      }`}></div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Empty State */}
        {readings.length === 0 && (
          <div className="text-center py-12">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 17v-2a3 3 0 00-3-3H5a3 3 0 00-3 3v2a1 1 0 001 1h12a1 1 0 001-1zm-6-8a3 3 0 100-6 3 3 0 000 6z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No readings available</h3>
            <p className="text-gray-500">Device readings will appear here once data is received.</p>
          </div>
        )}

        {/* Pagination */}
        {readings.length > 0 && (
          <div className="flex items-center justify-between mt-6 px-2">
            <div className="text-sm text-gray-500">
              Showing <span className="font-semibold text-gray-900">{start + 1}</span> to{" "}
              <span className="font-semibold text-gray-900">{Math.min(end, readings.length)}</span> of{" "}
              <span className="font-semibold text-gray-900">{readings.length}</span> results
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                disabled={currentPage === 0}
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 0))}
                className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Previous
              </button>
              
              <div className="flex items-center space-x-1">
                {[...Array(totalPages)].map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentPage(index)}
                    className={`w-8 h-8 text-sm font-medium rounded-lg transition-all duration-200 ${
                      currentPage === index
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-gray-500 hover:bg-gray-100"
                    }`}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
              
              <button
                disabled={currentPage >= totalPages - 1}
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages - 1))}
                className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                Next
                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );
}