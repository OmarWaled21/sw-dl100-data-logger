"use client";
import React, { useState } from "react";
import DeviceReadingChart from "./device_reading_charts";
import DeviceReadingTable from "./device_reading_table";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  deviceId: string;
  readings: Reading[];
  deviceName: string;
}

interface Reading {
  temperature: number;
  humidity: number;
  timestamp: string;
}

export default function DeviceReadingsPage({ deviceId, readings, deviceName }: Props) {
  const [view, setView] = useState<"chart" | "table">("chart");

  return (
    <div className="p-6">
      {/* Switch Buttons */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setView("chart")}
          className={`px-4 py-2 rounded-lg font-semibold cursor-pointer transition ${
            view === "chart" ? "bg-blue-600 text-white" : "bg-gray-200"
          }`}
        >
          Chart
        </button>
        <button
          onClick={() => setView("table")}
          className={`px-4 py-2 rounded-lg font-semibold cursor-pointer transition ${
            view === "table" ? "bg-blue-600 text-white" : "bg-gray-200"
          }`}
        >
          Table
        </button>
      </div>

      {/* Animated Switch */}
      <div className="relative min-h-[450px]">
        <AnimatePresence mode="wait">
          {view === "chart" ? (
            <motion.div
              key="chart"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
              className="absolute w-full"
            >
              <DeviceReadingChart deviceId={deviceId} />
            </motion.div>
          ) : (
            <motion.div
              key="table"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="absolute w-full"
            >
              <DeviceReadingTable readings={readings} deviceName={deviceName} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
