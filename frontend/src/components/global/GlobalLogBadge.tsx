"use client";
import { useEffect, useState } from "react";
import axios from "axios";
import Cookies from "js-cookie";

export default function GlobalLogBadge() {
  const [counts, setCounts] = useState({ total: 0, device_logs: 0, admin_logs: 0 });

  const fetchUnread = async () => {
    const token = Cookies.get("token");
    if (!token) return;

    try {
      const res = await axios.get("http://127.0.0.1:8000/logs/unread/", {
        headers: { Authorization: `Token ${token}` },
      });
      setCounts(res.data);
    } catch (err) {
      console.error("Error fetching unread logs:", err);
    }
  };

  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, 5000); // كل 5 ثواني يتحدث
    return () => clearInterval(interval);
  }, []);

  if (counts.total === 0) return null;

  return (
    <div className="relative inline-block">
      <button className="relative text-gray-700">
        🔔
        {counts.total > 0 && (
          <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs px-2 py-0.5 rounded-full">
            {counts.total}
          </span>
        )}
      </button>
    </div>
  );
}
