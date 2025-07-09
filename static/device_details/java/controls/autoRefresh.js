// autoRefresh.js
document.addEventListener("DOMContentLoaded", function () {
  const deviceId =
    document.getElementById("toggleDeviceSwitch")?.dataset.deviceId;
  const autoScheduleSwitch = document.getElementById("autoScheduleSwitch");
  const refreshInterval = 10000; // 10 seconds
  let refreshIntervalId = null;

  if (autoScheduleSwitch?.checked) {
    startAutoRefresh();
  }

  function startAutoRefresh() {
    if (!refreshIntervalId && deviceId) {
      refreshIntervalId = setInterval(refreshDeviceStatus, refreshInterval);
      console.log("Auto-refresh started");
      refreshDeviceStatus();
    }
  }

  function stopAutoRefresh() {
    if (refreshIntervalId) {
      clearInterval(refreshIntervalId);
      refreshIntervalId = null;
      console.log("Auto-refresh stopped");
    }
  }

  function refreshDeviceStatus() {
    if (!deviceId) return;

    // 🌀 1. Refresh ON/OFF state
    fetch(`/api/device/${deviceId}/schedule/refresh/`, {
      headers: getRequestHeaders(false),
    })
      .then(handleResponse)
      .then((data) => {
        if (data.status === "success") {
          const deviceData = data.device_controls.find(
            (d) => d.device_id === deviceId
          );
          if (deviceData) {
            updateDeviceStatus(deviceData.is_on);
          }
        }
      })
      .catch((error) => {
        console.error("Refresh ON/OFF error:", error);
      });

    // 🌡️ 2. Refresh Temp Control Settings
    fetch(`/api/device/${deviceId}/temp/settings/`, {
      headers: getRequestHeaders(false),
    })
      .then(handleResponse)
      .then((data) => {
        const tempControlSwitch = document.getElementById("tempControlSwitch");
        const tempOnThreshold = document.getElementById("tempOnThreshold");
        const tempOffThreshold = document.getElementById("tempOffThreshold");
        const tempSettings = document.getElementById("tempSettings");

        if (
          tempControlSwitch &&
          tempOnThreshold &&
          tempOffThreshold &&
          tempSettings
        ) {
          tempControlSwitch.checked = data.temp_control_enabled;
          tempOnThreshold.value = data.temp_on_threshold ?? "";
          tempOffThreshold.value = data.temp_off_threshold ?? "";

          tempSettings.classList.toggle("d-none", !data.temp_control_enabled);
          tempOnThreshold.disabled = !data.temp_control_enabled;
          tempOffThreshold.disabled = !data.temp_control_enabled;
        }
      })
      .catch((error) => {
        console.error("Refresh Temp Settings error:", error);
      });

    // 🥇 3. Refresh Priority Order
    fetch(`/api/device/${deviceId}/priority/get/`, {
      headers: getRequestHeaders(false),
    })
      .then(handleResponse)
      .then((data) => {
        const tableBody = document.getElementById("priorityTableBody");
        if (!tableBody) return;

        const priorities = data.priorities;
        const rows = Array.from(tableBody.querySelectorAll("tr"));

        // ✨ أعد ترتيب الصفوف حسب الأولوية القادمة من السيرفر
        priorities.sort((a, b) => a.priority - b.priority);

        // ✂️ ترتيب الصفوف
        const sortedRows = [];
        priorities.forEach((p) => {
          const row = rows.find((r) => r.dataset.feature === p.feature);
          if (row) sortedRows.push(row);
        });

        // 🧩 إعادة ترتيب الصفوف فعليًا في الجدول
        sortedRows.forEach((row) => tableBody.appendChild(row));
      })
      .catch((error) => {
        console.error("Refresh Priority error:", error);
      });
  }
});
