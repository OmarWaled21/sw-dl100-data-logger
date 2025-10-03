"use client";
import React from "react";

interface SensorCardProps {
  title: string;
  icon: React.ReactNode;
  unit: string;
  value: number;
  min: number;
  max: number;
  color: string;
}

const SensorCard: React.FC<SensorCardProps> = ({ title, icon, unit, value, min, max, color }) => {
  const circumference = 2 * Math.PI * 54; // 2πr , r=54
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="bg-white rounded-2xl p-8 border border-gray-200 hover:shadow-lg transition-shadow duration-300">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gray-50">{icon}</div>
          <h3 className="text-xl font-semibold text-gray-900">{title}</h3>
        </div>
        <div className="text-2xl font-bold" style={{ color }}>
          {value}{unit}
        </div>
      </div>

      {/* Gauge */} 
      <div className="flex justify-center mb-4">
        <div className="relative w-40 h-40">
          <svg className="w-full h-full" viewBox="0 0 120 120">
            <circle
              cx="60"
              cy="60"
              r="54"
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="12"
            />
            <circle
              cx="60"
              cy="60"
              r="54"
              fill="none"
              stroke={color}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              transform="rotate(-90 60 60)"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900">
                {value}{unit}
              </div>
              <div className="text-sm text-gray-500 mt-1">Current</div>
            </div>
          </div>
        </div>
      </div>

      <div className="text-center text-sm text-gray-600 bg-gray-50 py-2 px-4 rounded-lg border border-gray-100">
        Operating Range:{" "}
        <span className="font-semibold text-gray-900">
          {min}{unit} - {max}{unit}
        </span>
      </div>
    </div>
  );
};

export default SensorCard;
