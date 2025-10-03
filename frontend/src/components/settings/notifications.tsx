"use client";
import { useState, useEffect } from "react";
import axios from "axios";
import Cookies from "js-cookie";

export default function Notifications() {
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [localEnabled, setLocalEnabled] = useState(false);
  const [email, setEmail] = useState("");                

  useEffect(() => {
    axios.get(
      "http://127.0.0.1:8000/logs/notifications/settings/",
      { headers: { "Content-Type": "application/json", Authorization: `Token ${Cookies.get("token")}` } }
    ).then((res) => {
      const data = res.data;
      setEmailEnabled(data.gmail_is_active ?? false);
      setEmail(data.email ?? "");
      setLocalEnabled(data.local_is_active ?? false);
    }).catch(err => {
      console.error("Failed to load notification settings", err);
    });
  }, []);

  const handleSave = async () => {
    const settings = {
      gmail_is_active: emailEnabled,
      email: email || null,
      local_is_active: localEnabled,
    };

    try {
      await axios.post(
        "http://127.0.0.1:8000/logs/notifications/settings/", 
        settings, 
        { headers: { Authorization: `Token ${Cookies.get("token")}` } }
      );
      alert("✅ Notification settings saved!");
    } catch (err) {
      console.error(err);
      alert("❌ Failed to save settings");
    }
  };

  return (
    <div className="max-w-xl mx-auto p-6 bg-white shadow rounded-lg">
      <h3 className="text-2xl font-bold mb-6">Notifications Settings</h3>

      {/* Email */}
      <div className="space-y-3">
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={emailEnabled}
            onChange={(e) => setEmailEnabled(e.target.checked)}
          />
          <span>Send Device Logs to Email</span>
        </label>
        {emailEnabled && (
          <div className="ml-6 space-y-2">
            <input
              type="email"
              placeholder="Enter Gmail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border rounded px-3 py-2 w-full"
            />
          </div>
        )}
      </div>

      {/* Local Notifications */}
      <div className="mt-6">
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={localEnabled}
            onChange={(e) => setLocalEnabled(e.target.checked)}
          />
          <span>Local Notifications (if any log)</span>
        </label>
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        className="mt-6 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Save Settings
      </button>
    </div>
  );
}
