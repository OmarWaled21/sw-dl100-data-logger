"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { useRouter } from "next/navigation";
import LayoutWithNavbar from "@/components/ui/layout_with_navbar";
import { useIP } from "@/lib/IPContext";

export default function ResetPasswordPage() {
  const { uid, token } = useParams() as { uid: string; token: string };
  
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  
  const router = useRouter();

  const { ipHost, ipLoading } = useIP();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if(ipLoading) return;

    if (newPassword !== confirmPassword) {
      setMessage("Passwords do not match");
      return;
    }

    try {
      const res = await fetch(
        `https://${ipHost}/auth/password-reset-confirm/${uid}/${token}/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ new_password: newPassword }),
        }
      );

      if (res.ok) {
        setMessage("✅ Password reset successfully!");
        router.push("/auth/login");
      } else {
        const data = await res.json();
        setMessage(data?.detail || "❌ Failed to reset password.");
      }
    } catch (err) {
      setMessage("❌ Server error.");
    }
  };

  return (
    <LayoutWithNavbar>
      <div className="flex items-start justify-center min-h-screen">
        <form
          onSubmit={handleSubmit}
          className="bg-white p-6 rounded-lg shadow-md w-96"
        >
          <h2 className="text-xl font-semibold mb-4">Reset Your Password</h2>

          <input
            type="password"
            placeholder="New Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full p-2 mb-3 border rounded"
            required
          />

          <input
            type="password"
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full p-2 mb-3 border rounded"
            required
          />

          <button
            type="submit"
            className="w-full bg-white text-red-500 border border-red-500 hover:text-white hover:bg-red-500 py-2 rounded transition-colors cursor-pointer"
          >
            Reset Password
          </button>

          {message && <p className="mt-3 text-center">{message}</p>}
        </form>
      </div>
    </LayoutWithNavbar>
  );
}
