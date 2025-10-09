"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import EditClock from "@/components/settings/edit_clock";
import Users from "@/components/settings/users";
import Notifications from "@/components/settings/notifications";
import Cookies from "js-cookie";

interface Tab {
  id: string;
  label: string;
  component: React.ReactNode;
  allowedRoles: string[]; // مين اللي يشوف التاب
}

export default function SettingsPage() {
  const [role, setRole] = useState<string>("");
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("");

  useEffect(() => {
    setRole(Cookies.get("role") || "");
    setMounted(true);
  }, []);

  const tabs: Tab[] = [
    { id: "clock", label: "Edit Clock", component: <EditClock />, allowedRoles: ["admin", "supervisor"] },
    { id: "users", label: "Users", component: <Users />, allowedRoles: ["admin"] },
    { id: "notifications", label: "Notifications", component: <Notifications />, allowedRoles: ["admin", "supervisor"] },
  ];

  // بس الـ tabs اللي مسموح لهم حسب الـ role
  const allowedTabs = tabs.filter(tab => tab.allowedRoles.includes(role));

  useEffect(() => {
    if (allowedTabs.length > 0) {
      setActiveTab(allowedTabs[0].id);
    }
  }, [allowedTabs]);

  // 🚫 لحد ما الـ role يتحمل، ما ترندرش الصفحة لتفادي الـ mismatch
  if (!mounted) return null;

  return (
    <div className="flex min-h-[calc(89.8vh)]">
      {/* Sidebar */}
      <div className="w-64 text-white p-4" style={{ backgroundColor: "#212529" }}>
        <h2 className="text-xl font-bold mb-6">Settings</h2>
        <ul className="space-y-3">
          {allowedTabs.map((tab) => (
            <li
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`cursor-pointer p-2 rounded ${activeTab === tab.id ? "bg-gray-700" : "hover:bg-gray-800"}`}
            >
              {tab.label}
            </li>
          ))}
        </ul>
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-gray-100">
        <AnimatePresence mode="wait">
          {allowedTabs.map((tab) =>
            activeTab === tab.id ? (
              <motion.div
                key={tab.id}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
              >
                {tab.component}
              </motion.div>
            ) : null
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
