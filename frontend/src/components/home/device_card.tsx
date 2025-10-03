"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link"; // استدعاء Link
import { RadialBarChart, RadialBar, PolarAngleAxis, Tooltip } from "recharts";
import { WiThermometer, WiHumidity } from "react-icons/wi";
import { FaBatteryFull, FaBatteryThreeQuarters, FaBatteryHalf, FaBatteryQuarter, FaBatteryEmpty } from "react-icons/fa";
import { useTranslation } from "react-i18next";

interface DeviceCardProps {
  id: string; // معرف الجهاز لاستخدامه في الرابط
  name: string;
  battery: number; // 0-100
  temperature: number;
  humidity: number;
  minTemp: number;
  maxTemp: number;
  minHum: number;
  maxHum: number;
  status: "active" | "offline" | "error";
}

const DeviceCard: React.FC<DeviceCardProps> = ({
  id,
  name,
  battery,
  temperature,
  humidity,
  minTemp,
  maxTemp,
  minHum,
  maxHum,
  status,
}) => {
  const [prevTemp, setPrevTemp] = useState(temperature);
  const [prevHum, setPrevHum] = useState(humidity);
  const [highlightTemp, setHighlightTemp] = useState(false);
  const [highlightHum, setHighlightHum] = useState(false);

  const { t } = useTranslation();

  // Highlight effect on change
  useEffect(() => {
    if (temperature !== prevTemp) {
      setHighlightTemp(true);
      setTimeout(() => setHighlightTemp(false), 500);
      setPrevTemp(temperature);
    }
  }, [temperature, prevTemp]);

  useEffect(() => {
    if (humidity !== prevHum) {
      setHighlightHum(true);
      setTimeout(() => setHighlightHum(false), 500);
      setPrevHum(humidity);
    }
  }, [humidity, prevHum]);

  // Determine colors
  const getColor = (value: number, min: number, max: number, deviceStatus: string) => {
    if (deviceStatus === "offline") return "#94A3B8";
    if (deviceStatus === "error") return "#EF4444";
    if (value < min || value > max) return "#EF4444";
    return "#10B981";
  };

  const getStatusColor = () => {
    switch (status) {
      case "active": return "#10B981";
      case "error": return "#EF4444";
      case "offline": return "#94A3B8";
      default: return "#10B981";
    }
  };

  const getStatusText = () => {
    switch (status) {
      case "active": return t("active");
      case "error": return t("error");
      case "offline": return t("offline");
      default: return t("active");
    }
  };

  const borderColor = getStatusColor();
  const tempColor = getColor(temperature, minTemp, maxTemp, status);
  const humColor = getColor(humidity, minHum, maxHum, status);

  const tempData = [{ name: "temp", value: temperature, fill: tempColor }];
  const humData = [{ name: "hum", value: humidity, fill: humColor }];

  // Battery icon
  const getBatteryIcon = () => {
    if (battery > 75) return <FaBatteryFull className="inline" />;
    if (battery > 50) return <FaBatteryThreeQuarters className="inline" />;
    if (battery > 25) return <FaBatteryHalf className="inline" />;
    if (battery > 10) return <FaBatteryQuarter className="inline" />;
    return <FaBatteryEmpty className="inline text-red-500" />;
  };

  return (
    <Link href={`/device/${id}/`}
      className="block bg-white rounded-2xl p-4 sm:p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-gray-200 w-full max-w-sm sm:max-w-md mx-auto"
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-4 sm:mb-6">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-1">{name}</h2>
          <span 
            className="inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium"
            style={{ 
              backgroundColor: `${borderColor}15`,
              color: borderColor
            }}
          >
            <span 
              className="w-2 h-2 rounded-full mr-2"
              style={{ backgroundColor: borderColor }}
            ></span>
            {getStatusText()}
          </span>
        </div>
        <div className="text-sm font-medium mt-1">
          {getBatteryIcon()} {battery}%
        </div>
      </div>

      {/* Gauges */}
      <div className="flex gap-4 sm:gap-6 lg:gap-8 justify-center">
        {/* Temperature */}
        <div className="flex flex-col items-center">
          <div className="relative">
            <RadialBarChart
              width={120}
              height={100}
              cx={60}
              cy={65}
              innerRadius={40}
              outerRadius={55}
              barSize={10}
              data={tempData}
              startAngle={180}
              endAngle={0}
            >
              <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
              <RadialBar background dataKey="value" cornerRadius={6} />
            </RadialBarChart>
            <div className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center ${highlightTemp ? 'animate-pulse' : ''}`}>
              <span className="text-xl sm:text-2xl font-bold" style={{ color: tempColor }}>
                {temperature}°
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 mt-2 sm:mt-3 font-semibold" style={{ color: tempColor }}>
            <WiThermometer size={20} className="sm:w-6 sm:h-6" />
            <span className="text-xs sm:text-sm">{t("temperature")}</span>
          </div>
          <div className="text-xs text-gray-500 mt-1">{minTemp}° - {maxTemp}°</div>
        </div>

        {/* Humidity */}
        <div className="flex flex-col items-center">
          <div className="relative">
            <RadialBarChart
              width={120}
              height={100}
              cx={60}
              cy={65}
              innerRadius={40}
              outerRadius={55}
              barSize={10}
              data={humData}
              startAngle={180}
              endAngle={0}
            >
              <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
              <RadialBar background dataKey="value" cornerRadius={6} />
            </RadialBarChart>
            <div className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center ${highlightHum ? 'animate-pulse' : ''}`}>
              <span className="text-xl sm:text-2xl font-bold" style={{ color: humColor }}>
                {humidity}%
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 mt-2 sm:mt-3 font-semibold" style={{ color: humColor }}>
            <WiHumidity size={20} className="sm:w-6 sm:h-6" />
            <span className="text-xs sm:text-sm">{t("humidity")}</span>
          </div>
          <div className="text-xs text-gray-500 mt-1">{minHum}% - {maxHum}%</div>
        </div>
      </div>
    </Link>

  );
};

export default DeviceCard;
