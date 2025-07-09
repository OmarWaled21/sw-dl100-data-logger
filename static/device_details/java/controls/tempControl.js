// tempControl.js
document.addEventListener("DOMContentLoaded", function () {
  const tempControlSwitch = document.getElementById("tempControlSwitch");
  const tempSettings = document.getElementById("tempSettings");
  const tempOnThreshold = document.getElementById("tempOnThreshold");
  const tempOffThreshold = document.getElementById("tempOffThreshold");

  const deviceId = document.getElementById("toggleDeviceSwitch")?.dataset.deviceId;

  const scheduleModal = document.getElementById('scheduleModal');
  
  if (scheduleModal) {
    scheduleModal.addEventListener('show.bs.modal', function () {
      loadTempSettings();  // 🔁 تحميل الإعدادات كل مرة يتفتح فيها
    });
  }
  
  if (!deviceId) {
    console.error("Device ID not found for temp control.");
    return;
  }

  // ⬆️ Toggle visibility when checkbox changes
  if (tempControlSwitch && tempSettings) {
    tempControlSwitch.addEventListener("change", function () {
      const enabled = this.checked;
      tempSettings.classList.toggle("d-none", !enabled);
      tempOnThreshold.disabled = !enabled;
      tempOffThreshold.disabled = !enabled;
    });
  }

  // ⬇️ Load current temp settings
  function loadTempSettings() {
    fetch(`/api/device/${deviceId}/temp/settings/`, {
      headers: getRequestHeaders(false),
    })
      .then(handleResponse)
      .then((data) => {
        tempControlSwitch.checked = data.temp_control_enabled;
        tempOnThreshold.value = data.temp_on_threshold ?? "";
        tempOffThreshold.value = data.temp_off_threshold ?? "";

        tempSettings.classList.toggle("d-none", !data.temp_control_enabled);
        tempOnThreshold.disabled = !data.temp_control_enabled;
        tempOffThreshold.disabled = !data.temp_control_enabled;
      })
      .catch((err) => {
        console.error("Error loading temp settings", err);
      });
  }

  // ✅ Load on page load
  loadTempSettings();
});
