"use client";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import axios from "axios";
import Cookies from "js-cookie";
import { useIP } from "@/lib/IPContext";

export default function NotificationManagerPanel() {
  const [tree, setTree] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [email, setEmail] = useState("");
  const [devices, setDevices] = useState<number[]>([]);
  const [sectionDevices, setSectionDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const token = Cookies.get("token");

  const { t } = useTranslation();

  const { ipHost, ipLoading } = useIP();

  // Load tree (departments + users + department devices)
  useEffect(() => {
    if (ipLoading) return;
    axios
      .get(`https://${ipHost}/logs/notifications/tree/`, {
        headers: { Authorization: `Token ${token}` },
      })
      .then((res) => {
        console.log("🌳 Tree data:", res.data);
        setTree(res.data);
      })
      .catch((err) => console.error("Error loading tree:", err));
  }, [ipHost, ipLoading]);

  // Load settings for specific user - FIXED VERSION
  const loadUserSettings = async (userId: number) => {
    if (ipLoading) return;
    setLoading(true);
    try {
      // First, get user settings
      const settingsRes = await axios.get(
        `https://${ipHost}/logs/notifications/settings/?user_id=${userId}`,
        { headers: { Authorization: `Token ${token}` } }
      );

      const userData = settingsRes.data;
      console.log("⚙️ User settings response:", userData);
      
      setSelectedUser(userData);
      setEmailEnabled(userData.gmail_is_active);
      setEmail(userData.email || userData.user_email || "");

      // Get enabled devices from TREE data (not from settings response)
      const userFromTree = tree
        .flatMap(dep => dep.users)
        .find(user => user.id === userId);

      console.log("👤 User from tree:", userFromTree);

      let enabledDeviceIds: number[] = [];

      if (userFromTree && userFromTree.devices) {
        // Get enabled devices from tree data
        enabledDeviceIds = userFromTree.devices
          .filter((d: any) => d.enabled === true)
          .map((d: any) => d.id);
        
        console.log("📱 Enabled devices from TREE:", enabledDeviceIds);
      } else {
        // Fallback: get from settings response
        enabledDeviceIds = userData.devices
          ?.filter((d: any) => d.enabled === true)
          ?.map((d: any) => d.id) || [];
        
        console.log("📱 Enabled devices from SETTINGS (fallback):", enabledDeviceIds);
      }

      // Set the devices state with the enabled devices
      setDevices(enabledDeviceIds);

      // Set all available devices from section_devices
      setSectionDevices(userData.section_devices || []);

      console.log("🎯 Final enabled devices:", enabledDeviceIds);
      console.log("📋 Available section devices:", userData.section_devices);

    } catch (error) {
      console.error("❌ Error loading user settings:", error);
      alert("Error loading user settings");
    } finally {
      setLoading(false);
    }
  };

  // Toggle device
  const toggleDevice = (id: number) => {
    setDevices((prev) => {
      const newDevices = prev.includes(id) 
        ? prev.filter((x) => x !== id)
        : [...prev, id];
      
      console.log("🔄 Toggled device:", id, "New devices:", newDevices);
      return newDevices;
    });
  };

  // Save changes
  const handleSave = async () => {
    if (ipLoading) return;
    if (!selectedUser) return alert("Please select a user first");

    try {
      console.log("💾 Saving with devices:", devices);
      
      await axios.post(
        `https://${ipHost}/logs/notifications/settings/`,
        {
          user_id: selectedUser.user_id,
          gmail_is_active: emailEnabled,
          device_ids: devices,
        },
        { headers: { Authorization: `Token ${token}` } }
      );

      alert("✅ Settings saved successfully");
      
      // Refresh the tree data to get updated device states
      const treeRes = await axios.get(
        `https://${ipHost}/logs/notifications/tree/`,
        { headers: { Authorization: `Token ${token}` } }
      );
      setTree(treeRes.data);
      
      // Reload the user settings to reflect changes
      loadUserSettings(selectedUser.user_id);
    } catch (error) {
      console.error("❌ Error saving settings:", error);
      alert("Error saving settings");
    }
  };

  // Auto-select first user when tree loads
  useEffect(() => {
    if (tree.length > 0 && !selectedUser) {
      const firstDepartmentWithUsers = tree.find(dep => dep.users.length > 0);
      if (firstDepartmentWithUsers && firstDepartmentWithUsers.users.length > 0) {
        loadUserSettings(firstDepartmentWithUsers.users[0].id);
      }
    }
  }, [tree]);

  // Effect to reload user settings when tree updates and we have a selected user
  useEffect(() => {
    if (selectedUser && tree.length > 0) {
      loadUserSettings(selectedUser.user_id);
    }
  }, [tree]);

  return (
    <div className="min-h-screen bg-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            {t("Notification Settings Management")}
          </h1>
          <p className="text-gray-600">{t("Manage notification preferences for users and departments")}</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Sidebar - Users */}
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                {t("Users & Departments")}
              </h2>
              
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                {tree.map((dep) => (
                  <div key={dep.department_id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 hover:shadow-md transition-shadow" dir="ltr">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      {dep.department}
                    </h3>
                    <div className="space-y-2">
                      {dep.users.map((u: any) => (
                        <button
                          key={u.id}
                          onClick={() => loadUserSettings(u.id)}
                          className={`w-full text-left p-3 rounded-lg transition-all duration-200 ${
                            selectedUser?.user_id === u.id
                              ? "bg-blue-50 border border-blue-200 text-blue-700 shadow-sm"
                              : "bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700"
                          }`}
                        >
                          <div className="font-medium">{u.username}</div>
                          <div className="text-sm text-gray-500 truncate">{u.email}</div>
                          <div className="text-xs text-gray-400 mt-1">
                            {u.devices?.filter((d: any) => d.enabled).length || 0} {t("devices enabled")}
                          </div>
                        </button>
                      ))}
                      {dep.users.length === 0 && (
                        <div className="text-center py-4 text-gray-500 text-sm">
                          {t("No users in this department")}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Selected User Settings */}
          {selectedUser && (
            <div className="bg-gradient-to-r from-gray-50 to-white rounded-2xl p-6 border border-gray-200 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-semibold text-lg">
                    {selectedUser.user_username?.charAt(0).toUpperCase() || selectedUser.username?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-800">
                    {selectedUser.user_username || selectedUser.username}
                  </h3>
                  <p className="text-gray-600 text-sm">
                    {loading ? "Loading..." : t("Notification Settings")}
                  </p>
                </div>
              </div>

              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-gray-600 mt-4">Loading settings...</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Email Notifications */}
                  <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <label className="flex items-center justify-between cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center">
                          <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div>
                          <span className="font-medium text-gray-800">{t("Email Notifications")}</span>
                          <p className="text-sm text-gray-600">{t("Enable Gmail notifications")}</p>
                        </div>
                      </div>
                      <div className="relative inline-block w-12 h-6">
                        <input
                          type="checkbox"
                          checked={emailEnabled}
                          onChange={(e) => setEmailEnabled(e.target.checked)}
                          className="opacity-0 w-0 h-0"
                        />
                        <span className={`absolute top-0 left-0 right-0 bottom-0 rounded-full transition-all duration-300 ${
                          emailEnabled ? 'bg-green-500' : 'bg-gray-300'
                        }`}></span>
                        <span className={`absolute top-0.5 left-0.5 bg-white w-5 h-5 rounded-full transition-transform duration-300 ${
                          emailEnabled ? 'transform translate-x-6' : ''
                        }`}></span>
                      </div>
                    </label>
                  </div>

                  {/* Email Address */}
                  <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <label className="block mb-2 font-medium text-gray-800">{t("Email Address")}</label>
                    <div className="relative">
                      <input
                        type="email"
                        value={email}
                        readOnly
                        className="w-full border border-gray-300 rounded-lg px-4 py-3 bg-gray-50 text-gray-700 focus:outline-none cursor-not-allowed pl-10"
                      />
                      <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Local Notifications */}
                  <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div>
                          <span className="font-medium text-gray-800">{t("Local Notifications")}</span>
                          <p className="text-sm text-green-600">{t("Always enabled")}</p>
                        </div>
                      </div>
                      <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Department Devices */}
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="p-4 border-b border-gray-200">
                      <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                        </svg>
                        {t("Department Devices")}
                      </h4>
                      <p className="text-sm text-gray-600 mt-1">
                        {devices.length} {t("of")} {sectionDevices.length} {t("devices enabled")}
                      </p>
                    </div>
                    <div className="max-h-64 overflow-y-auto p-4">
                      {sectionDevices.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <svg className="w-12 h-12 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          <p className="mt-2">{t("No devices in department")}</p>
                        </div>
                      ) : (
                        <div className="grid gap-2">
                          {sectionDevices.map((d: any) => {
                            const isEnabled = devices.includes(d.id);
                            console.log(`🔍 Rendering device ${d.id}: enabled=${isEnabled}`);
                            return (
                              <label key={d.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer border border-gray-200">
                                <div className="relative">
                                  <input
                                    type="checkbox"
                                    checked={isEnabled}
                                    onChange={() => toggleDevice(d.id)}
                                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                                  />
                                </div>
                                <div className="flex-1">
                                  <span className="font-medium text-gray-800">{d.name}</span>
                                  <span className={`ml-2 font-medium ${isEnabled ? 'text-green-600' : 'text-red-500'}`}>
                                    {isEnabled ? `(${t("Enabled")})` : `(${t("Disabled")})`}
                                  </span>
                                </div>
                                <div className={`w-3 h-3 rounded-full ${isEnabled ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Save Button */}
                  <button
                    onClick={handleSave}
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-6 rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {t("Save Changes")}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}