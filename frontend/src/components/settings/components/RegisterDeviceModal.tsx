"use client";
import { Dispatch, SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import Cookies from "js-cookie";
import { useIP } from "@/lib/IPContext";

interface Props {
  show: boolean;
  setShow: Dispatch<SetStateAction<boolean>>;
  selectedDevice: DiscoveredDevice | null;
  sensorType: ("temperature" | "humidity")[];
  setSensorType: Dispatch<SetStateAction<("temperature" | "humidity")[]>>;
  tempType: "" | "air" | "liquid";
  setTempType: Dispatch<SetStateAction<"" | "air" | "liquid">>;
  form: DeviceForm;
  setForm: Dispatch<SetStateAction<DeviceForm>>;
  isAdmin: boolean;
  departments: Department[];
  saving: boolean;
  setSaving: Dispatch<SetStateAction<boolean>>;
}

export default function RegisterDeviceModal({
  show, setShow, selectedDevice, sensorType, setSensorType, tempType, setTempType, form,
  setForm, isAdmin, departments, saving, setSaving,
}: Props) {
  const { t } = useTranslation();

  const { ipHost, ipLoading } = useIP();

  if (!show || !selectedDevice) return null;

  const handleTempTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setTempType(e.target.value as "air" | "liquid" | "");
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
  let value: string | number = e.target.value;
  const name = e.target.name;

  // لو المستخدم يدخل رقم للـ min_temp أو max_temp
  if (name === "min_temp" || name === "max_temp") {
    let num = Number(value);
    if (!isNaN(num)) {
      if (tempType === "air") {
        num = Math.max(0, Math.min(100, num));       // clamp بين 0 و 100
      } else if (tempType === "liquid") {
        num = Math.max(-55, Math.min(120, num));     // clamp بين -55 و 120
      }
      value = num;
    }
  }

  setForm({ ...form, [name]: value });
};

  const isFormValid = () => {
    if (!form.name.trim()) return false;
    if (sensorType.length === 0) return false;
    if (sensorType.includes("temperature")) {
      if (!tempType) return false;
      if (!form.min_temp || !form.max_temp) return false;
    }
    if (sensorType.includes("humidity")) {
      if (!form.min_hum || !form.max_hum) return false;
    }
    if (isAdmin && !form.department_id) return false;
    return true;
  };

  const handleSave = async () => {
    if (!ipHost || ipLoading) return;
    if (!selectedDevice) return;
    setSaving(true);
    const token = Cookies.get("token");

    try {
      // نجهز الداتا الفعلية اللي محتاجها الـ backend فقط
      const bodyData: Record<string, any> = {
        device_id: selectedDevice.device_id,
        name: form.name.trim(),
        min_temp: form.min_temp ? Number(form.min_temp) : null,
        max_temp: form.max_temp ? Number(form.max_temp) : null,
        min_hum: form.min_hum ? Number(form.min_hum) : null,
        max_hum: form.max_hum ? Number(form.max_hum) : null,
        has_temperature_sensor: sensorType.includes("temperature"),
        has_humidity_sensor: sensorType.includes("humidity"),
        temperature_type: sensorType.includes("temperature") ? tempType : null,
      };

      // لو المستخدم Admin نضيف department_id
      if (isAdmin && form.department_id) {
        bodyData.department_id = Number(form.department_id);
      }

      // 🔍 DEBUG: شوف البيانات قبل الإرسال
      console.log("📤 Sending data:", JSON.stringify(bodyData, null, 2));

      // ✅ إرسال البيانات فقط، بدون أي form كامل أو extra keys
      const response = await fetch(`https://${ipHost}/add/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Token ${token}`,
        },
        body: JSON.stringify(bodyData),
      });

      const data = await response.json();

      console.log("Response data:", data);

      if (!response.ok) {
        alert(`❌ Failed to register device: ${data.message || "Unknown error"}`);
        console.error("Backend error:", data);
        return;
      }

      alert("✅ Device registered successfully!");
      setShow(false);
    } catch (err: any) {
      console.error("Network or code error:", err);
      alert(`❌ Failed to register device: ${err.message || err}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg transform transition-all duration-300 scale-100">
        {/* Header */}
        <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-2xl">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{t("Register Device")}</h2>
            <p className="text-sm text-gray-600 mt-1 font-medium">{t("Device ID")}: <span className="text-blue-600">{selectedDevice.device_id}</span></p>
          </div>
          <button 
            onClick={() => setShow(false)} 
            className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 p-2 rounded-full transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-8 py-6 max-h-[70vh] overflow-y-auto space-y-6">
          {/* Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">{t("Device Name")}</label>
            <input
              type="text"
              name="name"
              dir="ltr"
              value={form.name}
              onChange={handleChange}
              className="w-full px-4 py-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              placeholder={t("Enter device name")}
            />
          </div>

          {/* Sensor Type */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              {t("Sensor Type")} <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-6">
              {["temperature", "humidity"].map((type) => (
                <label key={type} className="inline-flex items-center space-x-3 cursor-pointer">
                  <div className="relative">
                    <input
                      type="checkbox"
                      value={type}
                      checked={sensorType.includes(type as "temperature" | "humidity")}
                      onChange={(e) => {
                        const value = e.target.value as "temperature" | "humidity";
                        setSensorType(sensorType.includes(value) ? sensorType.filter(v => v !== value) : [...sensorType, value]);
                      }}
                      className="sr-only"
                    />
                    <div className={`w-5 h-5 border-2 rounded flex items-center justify-center transition-all ${
                      sensorType.includes(type as "temperature" | "humidity") 
                        ? 'bg-blue-600 border-blue-600' 
                        : 'bg-white border-gray-300'
                    }`}>
                      {sensorType.includes(type as "temperature" | "humidity") && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <span className="capitalize font-medium text-gray-700">{t(type)}</span>
                </label>
              ))}
            </div>
            {sensorType.length === 0 && <p className="text-red-500 text-sm mt-2">{t("Select at least one sensor type.")}</p>}
          </div>

          {/* Temperature */}
          {sensorType.includes("temperature") && (
            <div className="space-y-5 bg-blue-50 p-5 rounded-xl border border-blue-100">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">{t("Temperature Type")}</label>
                <select
                  name="temp_type"
                  value={tempType}
                  onChange={handleTempTypeChange}
                  className="w-full px-4 py-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                >
                  <option value="">{t("Select temperature type")}</option>
                  <option value="air">{t("air")}</option>
                  <option value="liquid">{t("liquid")}</option>
                </select>
                {!tempType && <p className="text-red-500 text-sm mt-2">{t("Please select temperature type.")}</p>}
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">{t("Temperature Range")}</label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-2">{t("Min Temperature")}</label>
                    <input
                      type="number"
                      dir="ltr"
                      name="min_temp"
                      value={form.min_temp}
                      onChange={handleChange}
                      className="w-full px-4 py-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      placeholder="Min"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-2">{t("Max Temperature")}</label>
                    <input
                      type="number"
                      dir="ltr"
                      name="max_temp"
                      value={form.max_temp}
                      onChange={handleChange}
                      className="w-full px-4 py-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      placeholder="Max"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Humidity */}
          {sensorType.includes("humidity") && (
            <div className="space-y-5 bg-green-50 p-5 rounded-xl border border-green-100">
              <label className="block text-sm font-semibold text-gray-700 mb-3">{t("Humidity Range")}</label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-2">{t("Min Humidity")}</label>
                  <input
                    type="number"
                    dir="ltr"
                    name="min_hum"
                    value={form.min_hum}
                    onChange={handleChange}
                    className="w-full px-4 py-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    placeholder="Min"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-2">{t("Max Humidity")}</label>
                  <input
                    type="number"
                    dir="ltr"
                    name="max_hum"
                    value={form.max_hum}
                    onChange={handleChange}
                    className="w-full px-4 py-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    placeholder="Max"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Department */}
          {isAdmin && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">{t("department")}</label>
              <select 
                name="department_id" 
                value={form.department_id} 
                onChange={handleChange} 
                className="w-full px-4 py-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              >
                <option value="">{t("Select department")}</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-5 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex justify-end gap-4">
          <button 
            onClick={() => setShow(false)} 
            className="px-7 py-3 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-100 transition-colors"
          >
            {t("Cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !isFormValid()}
            className="px-7 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-xl shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            {saving ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {t("Save Device")}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}