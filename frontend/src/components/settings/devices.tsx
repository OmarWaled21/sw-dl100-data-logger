"use client";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import axios from "axios";
import Cookies from "js-cookie";
import RegisterDeviceModal from "./components/RegisterDeviceModal";

export default function DiscoverDevices() {
  const [devices, setDevices] = useState<DiscoveredDevice[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<DiscoveredDevice | null>(null);
  const [sensorType, setSensorType] = useState<("temperature" | "humidity")[]>([]);
  const [tempType, setTempType] = useState<"" | "air" | "liquid">("");
  const [form, setForm] = useState<DeviceForm>({
    name: "",
    department_id: "",
  });
  const [saving, setSaving] = useState(false);

  const { t } = useTranslation();

  useEffect(() => {
    const fetchDevices = () => {
      axios.get("http://127.0.0.1:8000/discover/")
        .then((res) => {
          const data = Array.isArray(res.data) ? res.data : res.data.results;
          setDevices(data || []);
        })
        .finally(() => setLoading(false));
    }

    fetchDevices();

    // تكرار كل 10 ثواني
    const interval = setInterval(fetchDevices, 10000);

    // تنظيف عند اغلاق الصفحه او عند اعاده التحميل
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const token = Cookies.get("token");
    const role = Cookies.get("role");
    if (!token || !role) return;

    if (role === "admin") {
      setIsAdmin(true);
      axios.get("http://127.0.0.1:8000/departments/", {
        headers: { Authorization: `Token ${token}` },
      })
        .then((res) => setDepartments(res.data))
        .catch(() => setDepartments([]));
    }
  }, []);

  const openModal = (device: DiscoveredDevice) => {
    setSelectedDevice(device);
    setForm({
      name: "",
      min_temp: "",
      max_temp: "",
      min_hum: "",
      max_hum: "",
      department_id: "",
    });
    setShowModal(true);
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{t("Discovered Devices")}</h1>
          <p className="text-gray-600">{t("Manage and register new devices in your network")}</p>
        </div>

        {/* Devices Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {devices.map((dev) => (
            <div
              key={dev.device_id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-300 hover:border-blue-200"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{dev.device_id}</h3>
                    {dev.model && (
                      <p className="text-sm text-gray-500">{dev.model}</p>
                    )}
                  </div>
                </div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  {t("Online")}
                </span>
              </div>
            
              <button
                onClick={() => openModal(dev)}
                className="w-full bg-blue-600 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors duration-200 flex items-center justify-center space-x-2 cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span>{t("Register Device")}</span>
              </button>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {devices.length === 0 && (
          <div className="text-center py-12">
            <div className="w-24 h-24 mx-auto mb-4 text-gray-300">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t("No devices found")}</h3>
            <p className="text-gray-500">{t("No devices are currently available for registration.")}</p>
          </div>
        )}
      </div>

      {/* Modern Modal */}
      {showModal && selectedDevice && (
        <RegisterDeviceModal
          show={showModal}
          setShow={setShowModal}
          selectedDevice={selectedDevice}
          sensorType={sensorType}
          setSensorType={setSensorType}
          tempType={tempType}
          setTempType={setTempType}
          form={form}
          setForm={setForm}
          isAdmin={isAdmin}
          departments={departments}
          saving={saving}
          setSaving={setSaving}
        />
      )}
    </div>
  );
}