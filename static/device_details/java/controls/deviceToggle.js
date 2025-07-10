// deviceToggle.js
document.addEventListener("DOMContentLoaded", function() {
  const toggleSwitch = document.getElementById('toggleDeviceSwitch');
  const statusText = document.getElementById('deviceStatusText');
  const statusBadge = document.querySelector('.device-info .badge');
  const deviceId = toggleSwitch?.dataset.deviceId;

  if (!deviceId) {
    console.error('Device ID not found');
    return;
  }

  if (toggleSwitch && statusText) {
    toggleSwitch.addEventListener('change', function () {
      const originalChecked = toggleSwitch.checked;  // 🟡 احتفظ بالحالة الأصلية
      toggleDevice(deviceId, originalChecked);
    });
  }

  function toggleDevice(deviceId, isChecked) {
    toggleSwitch.disabled = true;
    const originalStatus = statusText.innerHTML;

    // 🌀 Spinner أثناء الانتظار
    statusText.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>';
    statusText.className = 'status-indicator text-warning';

    fetch(`/api/device/${deviceId}/toggle/`, {
      method: 'POST',
      headers: getRequestHeaders()
    })
    .then(handleResponse)
    .then(data => {
      if (data.status === "pending") {
        waitForConfirmation(deviceId, isChecked, 20);  // ✅ استنى لحد 20 محاولة
      } else if (data.status === "waiting") {
        statusText.innerHTML = `<i class="fas fa-clock me-1"></i> Still waiting...`;
        statusText.className = 'status-indicator text-warning';
        toggleSwitch.checked = !isChecked; // ⛔ رجع الزر
        toggleSwitch.disabled = false;
      }
    })
    .catch(error => {
      console.error('Toggle error:', error);
      toggleSwitch.checked = !isChecked;
      showTemporaryError(statusText, originalStatus);
      toggleSwitch.disabled = false;
    });
  }

  function waitForConfirmation(deviceId, originalChecked, retries = 30) {
    if (retries <= 0) {
      statusText.innerHTML = `<i class="fas fa-exclamation-circle me-1"></i> Timeout`;
      statusText.className = 'status-indicator text-danger';

      // 👇 نرسل طلب POST جديد لإعادة الحالة
      fetch(`/api/device/${deviceId}/toggle/`, {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ force_restore: true })  // ✅ مهم
      })
      .then(handleResponse)
      .then(data => {
        if (data.restored_to !== undefined) {
          updateDeviceStatus(data.restored_to);
          console.log("Restored device to last confirmed state:", data.restored_to);
        } else {
          console.warn("No 'restored_to' in response");
        }
        toggleSwitch.disabled = false;  // ← هنا 👈
      })
      .catch((err) => {
        console.error("Failed to restore device after timeout:", err);
        updateDeviceStatus(!originalChecked);  // fallback
      });
      return;
    }



    fetch(`/api/device/${deviceId}/control-info/`, {
      method: 'GET',
      headers: getRequestHeaders(false)
    })
    .then(handleResponse)
    .then(data => {
      if (data.pending_confirmation) {
        setTimeout(() => waitForConfirmation(deviceId, originalChecked, retries - 1), 1000);
      } else {
        updateDeviceStatus(data.is_on);  // ✅ الجهاز أكد، حدّث الحالة
        toggleSwitch.disabled = false;
      }
    })
    .catch(err => {
      console.error("Error checking confirmation:", err);
      toggleSwitch.disabled = false;
    });
  }

  function showTemporaryError(elem, originalHTML) {
    elem.innerHTML = '<i class="fas fa-exclamation-triangle me-1"></i> Error!';
    elem.className = 'status-indicator text-danger';
    setTimeout(() => {
      elem.innerHTML = originalHTML;
      elem.className = 'status-indicator text-secondary';
    }, 3000);
  }

  function updateDeviceStatus(isOn) {
    toggleSwitch.checked = isOn;
    statusText.innerHTML = `<i class="fas fa-power-off me-1"></i>${isOn ? 'POWER ON' : 'POWER OFF'}`;
    statusText.className = `status-indicator ${isOn ? 'text-success' : 'text-secondary'}`;

    if (statusBadge) {
      statusBadge.className = `badge me-2 ${isOn ? 'bg-success' : 'bg-secondary'}`;
      statusBadge.textContent = isOn ? 'ONLINE' : 'OFFLINE';
    }
  }
});
