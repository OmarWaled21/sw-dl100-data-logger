"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import Cookies from "js-cookie";

export default function EditClock() {
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // ⏰ Fetch initial value
  useEffect(() => {
    async function fetchClock() {
      try {
        const res = await axios.get("http://127.0.0.1:8000/", {
          headers: { Authorization: `Token ${Cookies.get("token")}` },
        });
        const diffMinutes = res.data.results.time_difference;

        const initial = new Date();
        initial.setMinutes(initial.getMinutes() + diffMinutes);
        setCurrentTime(initial);
      } catch (err) {
        console.error("Error fetching clock:", err);
        setMessage("❌ Failed to load clock value");
      }
    }
    fetchClock();
  }, []);

  // ⏱️ Update time locally every second
  useEffect(() => {
    if (!currentTime) return;
    const interval = setInterval(() => {
      setCurrentTime((prev) => {
        if (!prev) return null;
        return new Date(prev.getTime() + 1000);
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [currentTime]);

  // ✅ Save changes
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await saveClock(currentTime);
  }

  // 🕒 Set Now button
  async function handleSetNow() {
    const now = new Date();
    setCurrentTime(now);
    await saveClock(now);
  }

  // 📡 General save function
  async function saveClock(time: Date | null) {
    setLoading(true);
    setMessage("");
    try {
      if (!time) {
        setMessage("⚠️ No clock value loaded");
        return;
      }

      const now = new Date();
      const diffMinutes = Math.round(
        (time.getTime() - now.getTime()) / 60000
      );

      await axios.post(
        "http://127.0.0.1:8000/edit/",
        { time_difference: diffMinutes },
        { headers: { "Content-Type": "application/json", Authorization: `Token ${Cookies.get("token")}` } }
      );

      setMessage("✅ Master clock updated successfully");
    } catch (err: any) {
      setMessage(
        err.response?.data?.message || "❌ Failed to update master clock"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-md mx-auto bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Edit Master Clock</h1>
              <p className="text-blue-100 mt-1 text-sm">Adjust system time settings</p>
            </div>
            <div className="bg-white/20 p-2 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
        
        {/* Content */}
        <div className="p-6">
          {currentTime ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Live Clock Display */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-100 text-center">
                <p className="text-blue-600 text-sm font-medium mb-3">CURRENT SYSTEM TIME</p>
                <div className="text-3xl font-mono font-bold text-gray-800 mb-1">
                  {currentTime.toLocaleTimeString('en-US', { 
                    hour12: true, 
                    hour: '2-digit', 
                    minute: '2-digit',
                    second: '2-digit'
                  })}
                </div>
                <div className="text-gray-600 font-medium">
                  {currentTime.toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </div>
              </div>
              
              {/* DateTime Input */}
              <div>
                <label className="block text-gray-700 font-semibold mb-3 text-sm uppercase tracking-wide">
                  Adjust Date & Time
                </label>
                <div className="relative">
                  <input
                    type="datetime-local"
                    value={new Date(
                      currentTime.getTime() -
                        currentTime.getTimezoneOffset() * 60000
                    )
                      .toISOString()
                      .slice(0, 16)}
                    onChange={(e) => setCurrentTime(new Date(e.target.value))}
                    className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
                  />
                </div>
              </div>
              
              {/* Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-4 py-3.5 rounded-xl font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-md hover:shadow-lg"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Saving Changes...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleSetNow}
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-4 py-3.5 rounded-xl font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-md hover:shadow-lg"
                >
                  {loading ? "Setting..." : "Set to Current Time"}
                </button>
              </div>
            </form>
          ) : (
            <div className="text-center py-10">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-100 rounded-full mb-4">
                <svg className="animate-spin h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
              <p className="text-gray-600 font-medium">Loading clock settings...</p>
            </div>
          )}

          {/* Message */}
          {message && (
            <div className={`mt-6 p-4 rounded-xl text-center border ${
              message.includes("❌") || message.includes("⚠️") 
                ? "bg-red-50 text-red-700 border-red-200" 
                : "bg-green-50 text-green-700 border-green-200"
            }`}>
              <div className="flex items-center justify-center space-x-2">
                {message.includes("❌") || message.includes("⚠️") ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
                <span className="font-medium">{message}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}