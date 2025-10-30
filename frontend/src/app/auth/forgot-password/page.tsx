'use client';
import LayoutWithNavbar from "@/components/ui/layout_with_navbar";
import { useIP } from "@/lib/IPContext";
import React, { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const { ipHost, ipLoading } = useIP();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    if(ipLoading) return;

    try {
      const res = await fetch(`https://${ipHost}/auth/password_reset/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage("Password reset email sent. Check your inbox!");
      } else {
        setMessage(data.message || "Failed to send reset email");
      }
    } catch {
      setMessage("An error occurred. Try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <LayoutWithNavbar>
      <div className="flex items-center justify-center mt-4">
        <div className="bg-white shadow-2xl rounded-2xl p-8 max-w-md w-full">
          <h1 className="text-2xl font-bold mb-4">Forgot Password</h1>

          {message && <div className="mb-4 text-red-500">{message}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email"
              placeholder="Your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border px-4 py-3 rounded-full outline-none focus:ring-2 focus:ring-red-400"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-red-500 text-white py-3 rounded-full hover:bg-red-600 transition"
            >
              {loading ? "Sending..." : "Send Reset Email"}
            </button>
          </form>
        </div>
      </div>
    </LayoutWithNavbar>
  );
}
