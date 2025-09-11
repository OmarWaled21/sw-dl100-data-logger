// autoRefresh.js
document.addEventListener("DOMContentLoaded", function () {
  const deviceId = window.deviceId;
  const refreshInterval = 10000; // 10 seconds
  let refreshIntervalId = null;

  
  startAutoRefresh();
  
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

    console.log("🚀 Calling /schedule/refresh/");
    // ✅ Force timeout check and apply correction if needed
    fetch(`/api/device/${deviceId}/schedule/refresh/`, {
      headers: getRequestHeaders(false)
    })
    .then(handleResponse)
    .then((data) => {
      console.log("✅ Refreshed control state from /schedule/refresh/");
      // optionally: process data.device_controls لو حابب
    })
    .catch((err) => {
      console.error("Error refreshing control state:", err);
    });

    // 🌀 1. Refresh ON/OFF state
    fetch(`/api/device/${deviceId}/schedule/refresh/`, {
      headers: getRequestHeaders(false),
    })
      .then(handleResponse)
      .then((data) => {
        const deviceData = data.device_controls.find(
          (d) => d.device_id === deviceId
        );
        const toggleSwitch = document.getElementById("toggleDeviceSwitch");
        const statusText = document.getElementById("deviceStatusText");
        const statusBadge = document.querySelector(".device-info .badge");

        if (deviceData && toggleSwitch && !toggleSwitch.disabled) {
          // ✅ فقط إذا مش منتظر confirmation
          if (!deviceData.pending_confirmation) {
            const currentStatus = toggleSwitch.checked;
            if (currentStatus !== deviceData.is_on) {
              toggleSwitch.checked = deviceData.is_on;
              statusText.innerHTML = `<i class="fas fa-power-off me-1"></i>${deviceData.is_on ? 'POWER ON' : 'POWER OFF'}`;
              statusText.className = `status-indicator ${deviceData.is_on ? 'text-success' : 'text-secondary'}`;

              if (statusBadge) {
                statusBadge.className = `badge me-2 ${deviceData.is_on ? 'bg-success' : 'bg-secondary'}`;
                statusBadge.textContent = deviceData.is_on ? 'ONLINE' : 'OFFLINE';
              }
            }
          } else {
            console.log("⏳ Still waiting for confirmation, skip refresh update.");
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
