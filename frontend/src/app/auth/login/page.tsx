'use client';
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCard, setShowCard] = useState(false);
  const [showPassword, setShowPassword] = useState(false); // 👁️ هنا

  const router = useRouter();

  useEffect(() => {
    setTimeout(() => setShowCard(true), 100);
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("http://127.0.0.1:8000/auth/login/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (res.ok) {
        if (remember) {
          // يعيش بعد إعادة تشغيل المتصفح
          Cookies.set("token", data.token, { expires: 7 });
          Cookies.set("role", data.results.role, { expires: 7 });  // تخزين الـ role
          Cookies.set("username", data.results.username, { expires: 7 });  // تخزين الـ username
        } else {
          // يتشال لما يقفل المتصفح
          Cookies.set("token", data.token);
          Cookies.set("role", data.results.role);  // تخزين الـ role
          Cookies.set("username", data.results.username);  // تخزين الـ username
          sessionStorage.setItem("token", data.token);
        }

        // لو الـ role مش admin نسجل log دخول
        fetch("http://127.0.0.1:8000/logs/create/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Token ${data.token}`,
          },
          body: JSON.stringify({
            action: `logged in`,
            message: `User ${username} logged in`,
          })
        }).catch(console.error);
        
        // اعمل reload للـ Navbar
        window.dispatchEvent(new Event("authChanged"));

        router.push("/");
      } else {
        setError(data.message || "Login failed");
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center mt-4">
      <div
        className={`bg-white shadow-2xl rounded-2xl p-8 max-w-lg w-full transform transition-all duration-700 ease-out
        ${showCard ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-10 scale-95"}
        hover:scale-[1.02]`}
      >
        {/* Header */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <h1 className="text-4xl font-bold text-gray-800 transition-colors duration-300">
            Login
          </h1>
          <i className="fa-solid fa-arrow-right-to-bracket text-3xl text-gray-800"></i>
        </div>

        {/* Subtext */}
        <div className="text-center mb-6">
          <p className="font-semibold text-red-500">Welcome</p>
          <p className="text-gray-500 text-sm">Please login to your account</p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-100 text-red-700 p-3 mb-4 rounded animate-shake">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          {/* Username */}
          <div className="flex items-center border border-gray-400 rounded-full px-4 py-3 
                          focus-within:border-transparent focus-within:ring-2 focus-within:ring-red-400 transition">
            <i className="fa-solid fa-at text-gray-400"></i>
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="ml-3 flex-1 outline-none text-lg"
            />
          </div>

          {/* Password */}
          <div className="flex items-center border border-gray-400 rounded-full px-4 py-3 
                          focus-within:border-transparent focus-within:ring-2 focus-within:ring-red-400 transition">
            <i className="fa-solid fa-lock text-gray-400"></i>
            <input
              type={showPassword ? "text" : "password"}   // 👁️ هنا
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="ml-3 flex-1 outline-none text-lg"
            />
            <i
              className={`fa-solid ${showPassword ? "fa-eye-slash" : "fa-eye"} 
                         text-gray-400 cursor-pointer`}
              onClick={() => setShowPassword(!showPassword)} // 👁️ هنا
            ></i>
          </div>

          {/* Options */}
          <div className="flex justify-between items-center text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="accent-red-500"
              />
              Remember me
            </label>
            <a href="/auth/forgot-password" className="text-red-500 hover:underline">
              Forgot password?
            </a>
          </div>

          {/* Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white border border-red-500 text-red-500 py-3 mt-4 rounded-full 
             hover:bg-red-500 hover:text-white transition-all duration-300 transform hover:scale-105 text-lg font-semibold cursor-pointer"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}
