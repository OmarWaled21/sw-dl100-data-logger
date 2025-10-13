"use client";
import { useEffect, useState } from "react";
import axios from "axios";
import Cookies from "js-cookie";

interface DiscoveredDevice {
  device_id: string;
  model?: string;
}

interface Department {
  id: number;
  name: string;
}

interface DeviceForm {
  name: string;
  min_temp: string;
  max_temp: string;
  min_hum: string;
  max_hum: string;
  department_id?: string;
}

export default function DiscoverDevices() {
  const [devices, setDevices] = useState<DiscoveredDevice[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<DiscoveredDevice | null>(null);
  const [form, setForm] = useState<DeviceForm>({
    name: "",
    min_temp: "",
    max_temp: "",
    min_hum: "",
    max_hum: "",
    department_id: "",
  });
  const [saving, setSaving] = useState(false);

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    if (!selectedDevice) return;
    setSaving(true);
    const token = Cookies.get("token");

    try {
      await axios.post("http://127.0.0.1:8000/add/", {
        ...form,
        device_id: selectedDevice.device_id,
      }, {
        headers: { Authorization: `Token ${token}` },
      });

      alert("✅ Device registered successfully!");
      setShowModal(false);
    } catch (err: any) {
      console.error(err);
      alert("❌ Failed to register device");
    } finally {
      setSaving(false);
    }
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Discovered Devices</h1>
          <p className="text-gray-600">Manage and register new devices in your network</p>
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
                  Online
                </span>
              </div>
            
              <button
                onClick={() => openModal(dev)}
                className="w-full bg-blue-600 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors duration-200 flex items-center justify-center space-x-2 cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span>Register Device</span>
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
            <h3 className="text-lg font-medium text-gray-900 mb-2">No devices found</h3>
            <p className="text-gray-500">No devices are currently available for registration.</p>
          </div>
        )}
      </div>

      {/* Modern Modal */}
      {showModal && selectedDevice && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md transform transition-all">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Register Device</h2>
                  <p className="text-sm text-gray-500 mt-1">Device ID: {selectedDevice.device_id}</p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors duration-200 cursor-pointer"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-4 max-h-96 overflow-y-auto">
              <div className="space-y-4">
                {["name", "min_temp", "max_temp", "min_hum", "max_hum"].map((key) => (
                  <div key={key}>
                    <label className="block text-sm font-medium text-gray-700 mb-2 capitalize">
                      {key.replace("_", " ")}
                    </label>
                    <input
                      type="text"
                      name={key}
                      value={(form as any)[key]}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                      placeholder={`Enter ${key.replace("_", " ")}`}
                    />
                  </div>
                ))}

                {isAdmin && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Department
                    </label>
                    <select
                      name="department_id"
                      value={form.department_id}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white cursor-pointer"
                    >
                      <option value="">Select department</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-6 py-2.5 text-gray-700 font-medium rounded-lg border border-gray-300 hover:bg-gray-100 transition-colors duration-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center space-x-2 cursor-pointer"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Save Device</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}