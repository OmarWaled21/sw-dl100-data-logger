"use client";
import React, { useEffect, useState } from "react";
import axios from "axios";
import Cookies from "js-cookie";
import { useTranslation } from "react-i18next";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useIP } from "@/lib/IPContext";

interface Props {
  deviceId: string;
  hasTemperatureSensor: boolean;
  hasHumiditySensor: boolean;
}

export default function DeviceReadingChart({
  deviceId,
  hasTemperatureSensor,
  hasHumiditySensor,
}: Props) {
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation();

  const { ipHost, ipLoading } = useIP();

  useEffect(() => {
    if (ipLoading) return;
    let intervalId: NodeJS.Timeout;

    const fetchAverages = async () => {
      try {
        const res = await axios.get(
          `https://${ipHost}/device/${deviceId}/averages/`,
          {
            headers: { Authorization: `Token ${Cookies.get("token")}` },
          }
        );

        const { labels, avg_temperatures, avg_humidities } = res.data;

        const formatted = labels.map((label: string, i: number) => {
          const date = new Date(label);
          const hour = date.getHours().toString().padStart(2, "0") + ":00";
          return {
            hour,
            temperature: avg_temperatures[i],
            humidity: avg_humidities[i],
          };
        });

        const last12 = formatted.length > 12 ? formatted.slice(-12) : formatted;
        setChartData(last12);
      } catch (error) {
        console.error("Error fetching averages:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAverages();
    intervalId = setInterval(fetchAverages, 60000);

    return () => clearInterval(intervalId);
  }, [deviceId, ipLoading, ipHost]);

  if (loading) {
    return <div>Loading chart...</div>;
  }

  // ✅ لو مفيش أي حساس موجود
  if (!hasTemperatureSensor && !hasHumiditySensor) {
    return (
      <div className="bg-white rounded-2xl p-8 border border-gray-200 text-center text-gray-600">
        {t("No sensors available for this device.")}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-8 border border-gray-200">
      <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
        {t("Last 12 Hours (Avg per Hour)")}
      </h2>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="hour" interval={0} tick={{ fontSize: 12 }} />
          <YAxis />
          <Tooltip />
          <Legend />

          {/* ✅ عرض الخطوط حسب نوع الحساسات */}
          {hasTemperatureSensor && (
            <Line
              type="linear"
              dataKey="temperature"
              stroke="#ef4444"
              name={`${t('temperature')} (°C)`}
              dot
            />
          )}

          {hasHumiditySensor && (
            <Line
              type="linear"
              dataKey="humidity"
              stroke="#3b82f6"
              name={`${t('humidity')} (%)`}
              dot
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
