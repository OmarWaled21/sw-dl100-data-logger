"use client";
import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation"; // للحصول على الـ device id من الرابط
import { RadialBarChart, RadialBar, PolarAngleAxis, Tooltip } from "recharts";
import { WiThermometer, WiHumidity } from "react-icons/wi";
import { FaBatteryFull, FaBatteryThreeQuarters, FaBatteryHalf, FaBatteryQuarter, FaBatteryEmpty } from "react-icons/fa";
import axios from "axios";
import Cookies from "js-cookie";

interface DeviceDetails {
  id: string;
  name: string;
  battery: number;
  temperature: number;
  humidity: number;
  minTemp: number;
  maxTemp: number;
  minHum: number;
  maxHum: number;
  status: "active" | "offline" | "error";
}

const DeviceDetailsPage: React.FC = () => {
  const params = useParams();
  const deviceId = params.id; // assumed route: /devices/[id]
  const [device, setDevice] = useState<DeviceDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // fetch device details from API
    const fetchDevice = async () => {
      try {
        const res = await axios.get(`http://127.0.0.1:8000/device/${deviceId}/`, {
          headers: { Authorization: `Token ${Cookies.get("token")}` },
        });
        console.log("API response:", res.data);
        const data = res.data.results;
        setDevice({
          id: data.device_id,
          name: data.name,
          battery: data.battery_level,
          temperature: data.temperature,
          humidity: data.humidity,
          minTemp: data.min_temp,
          maxTemp: data.max_temp,
          minHum: data.min_hum,
          maxHum: data.max_hum,
          status: data.status
        });
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchDevice();
  }, [deviceId]);

  if (loading) return <div className="p-6 text-center">Loading...</div>;
  if (!device) return <div className="p-6 text-center text-red-500">Device not found</div>;

  const tempColor = device.temperature < device.minTemp || device.temperature > device.maxTemp ? "#EF4444" : "#10B981";
  const humColor = device.humidity < device.minHum || device.humidity > device.maxHum ? "#EF4444" : "#10B981";

  const getBatteryIcon = () => {
    const b = device.battery;
    if (b > 75) return <FaBatteryFull className="inline" />;
    if (b > 50) return <FaBatteryThreeQuarters className="inline" />;
    if (b > 25) return <FaBatteryHalf className="inline" />;
    if (b > 10) return <FaBatteryQuarter className="inline" />;
    return <FaBatteryEmpty className="inline text-red-500" />;
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl p-6">
        <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">{device.name}</h1>

        {/* Status & Battery */}
        <div className="flex items-center justify-between mb-6">
          <span
            className={`px-3 py-1 rounded-full text-white font-semibold ${
              device.status === "active"
                ? "bg-green-500"
                : device.status === "offline"
                ? "bg-gray-400"
                : "bg-red-500"
            }`}
          >
            {device.status.toUpperCase()}
          </span>
          <span className="text-lg font-medium text-gray-900 dark:text-white">
            {getBatteryIcon()} {device.battery}%
          </span>
        </div>

        {/* Gauges */}
        <div className="flex flex-col sm:flex-row gap-8 mb-6 justify-center">
          {/* Temperature */}
          <div className="flex flex-col items-center bg-gray-100 dark:bg-gray-700 p-4 rounded-lg shadow-sm">
            <RadialBarChart width={150} height={120} cx={75} cy={60} innerRadius={45} outerRadius={65} barSize={12} data={[{ name: "temp", value: device.temperature, fill: tempColor }]} startAngle={180} endAngle={0}>
              <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
              <RadialBar background dataKey="value" cornerRadius={6} />
              <Tooltip />
            </RadialBarChart>
            <div className="mt-2 flex items-center gap-2 font-semibold" style={{ color: tempColor }}>
              <WiThermometer size={24} /> <span>Temperature: {device.temperature}°</span>
            </div>
            <div className="text-sm text-gray-500 mt-1">{device.minTemp}° - {device.maxTemp}°</div>
          </div>

          {/* Humidity */}
          <div className="flex flex-col items-center bg-gray-100 dark:bg-gray-700 p-4 rounded-lg shadow-sm">
            <RadialBarChart width={150} height={120} cx={75} cy={60} innerRadius={45} outerRadius={65} barSize={12} data={[{ name: "hum", value: device.humidity, fill: humColor }]} startAngle={180} endAngle={0}>
              <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
              <RadialBar background dataKey="value" cornerRadius={6} />
              <Tooltip />
            </RadialBarChart>
            <div className="mt-2 flex items-center gap-2 font-semibold" style={{ color: humColor }}>
              <WiHumidity size={24} /> <span>Humidity: {device.humidity}%</span>
            </div>
            <div className="text-sm text-gray-500 mt-1">{device.minHum}% - {device.maxHum}%</div>
          </div>
        </div>

        {/* Placeholder for readings history */}
        <div className="mt-6 bg-gray-50 dark:bg-gray-700 p-4 rounded-lg shadow-sm">
          <h2 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">Recent Readings</h2>
          <div className="text-gray-500 dark:text-gray-300">[Graph or table of historical readings will go here]</div>
        </div>
      </div>
    </div>
  );
};

export default DeviceDetailsPage;
