// utils.js
function getRequestHeaders(includeCSRF = true) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Token ${UserToken}`
  };
  
  if (includeCSRF) {
    headers['X-CSRFToken'] = getCookie('csrftoken');
  }
  
  return headers;
}

function handleResponse(response) {
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  return response.json();
}

function showTemporaryError(element, originalContent) {
  element.innerHTML = '<i class="fas fa-exclamation-circle me-1"></i> Error';
  element.className = 'status-indicator text-danger';
  
  setTimeout(() => {
    element.innerHTML = originalContent;
    element.className = `status-indicator ${toggleSwitch.checked ? 'text-success' : 'text-secondary'}`;
  }, 2000);
}

function updateDeviceStatus(isOn) {
  const toggleSwitch = document.getElementById('toggleDeviceSwitch');
  const statusText = document.getElementById('deviceStatusText');
  const statusBadge = document.querySelector('.device-info .badge');

  if (!toggleSwitch || !statusText) return;

  toggleSwitch.checked = isOn;

  // تحديث نص الحالة
  statusText.innerHTML = `
    <i class="fas fa-power-off me-1"></i>
    ${isOn ? 'POWER ON' : 'POWER OFF'}
  `;
  statusText.className = `status-indicator ${isOn ? 'text-success' : 'text-secondary'}`;

  // تحديث البادج
  if (statusBadge) {
    statusBadge.className = `badge me-2 ${isOn ? 'bg-success' : 'bg-secondary'}`;
    statusBadge.textContent = isOn ? 'ONLINE' : 'OFFLINE';
  }
}

function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

// utils.js
function updateScheduleUI(data) {
  const scheduleBadge = document.querySelector('.schedule-info .badge');
  if (scheduleBadge) {
    scheduleBadge.className = `badge ${data.auto_schedule ? 'bg-success' : 'bg-light text-dark'}`;
    scheduleBadge.textContent = data.auto_schedule ? 'ACTIVE' : 'INACTIVE';
  }

  const autoOnDisplay = document.querySelector('.schedule-info .col-6:nth-child(1) .fw-bold');
  const autoOffDisplay = document.querySelector('.schedule-info .col-6:nth-child(2) .fw-bold');

  if (autoOnDisplay) autoOnDisplay.textContent = data.auto_on || '--:--';
  if (autoOffDisplay) autoOffDisplay.textContent = data.auto_off || '--:--';
}


function saveSettings(deviceId, buttonElement, modalElement = null) {
  const autoScheduleSwitch = document.getElementById('autoScheduleSwitch');
  const autoOnTime = document.getElementById('autoOnTime');
  const autoOffTime = document.getElementById('autoOffTime');

  const tempControlSwitch = document.getElementById("tempControlSwitch");
  const tempOnThreshold = document.getElementById("tempOnThreshold");
  const tempOffThreshold = document.getElementById("tempOffThreshold");

  if (!deviceId) {
    alert("Device ID missing");
    return;
  }

  if (autoScheduleSwitch.checked && autoOnTime.value >= autoOffTime.value) {
    alert("Auto OFF time must be after Auto ON time.");
    return;
  }

  const originalText = buttonElement.innerHTML;
  buttonElement.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> Saving...';
  buttonElement.disabled = true;

  const schedulePayload = {
    auto_schedule: autoScheduleSwitch.checked,
  };

  if (autoScheduleSwitch.checked) {
    schedulePayload.auto_on = autoOnTime.value;
    schedulePayload.auto_off = autoOffTime.value;
  }

  const tempPayload = {
    temp_control_enabled: tempControlSwitch.checked,
    temp_on_threshold: tempOnThreshold.value,
    temp_off_threshold: tempOffThreshold.value,
  };

  const saveSchedule = fetch(`/api/device/${deviceId}/schedule/update/`, {
    method: 'POST',
    headers: getRequestHeaders(),
    body: JSON.stringify(schedulePayload)
  }).then(handleResponse);

  const saveTemp = fetch(`/api/device/${deviceId}/temp/update/`, {
    method: "POST",
    headers: getRequestHeaders(),
    body: JSON.stringify(tempPayload),
  }).then(handleResponse);

  Promise.all([saveSchedule, saveTemp])
    .then(([scheduleData, tempData]) => {
      updateScheduleUI(scheduleData);

      if (modalElement) {
        const modalInstance = bootstrap.Modal.getInstance(modalElement);
        if (modalInstance) modalInstance.hide();
      }

      alert("✅ Settings saved successfully!");
      location.reload(); // أو استخدم تحديث جزئي
    })
    .catch(error => {
      console.error("Save settings error:", error);
      alert("❌ Failed to save settings.");
    })
    .finally(() => {
      buttonElement.innerHTML = originalText;
      buttonElement.disabled = false;
    });
}


function updateArrowVisibility() {
  const rows = document.querySelectorAll("#priorityTableBody tr");

  rows.forEach((row, index) => {
    const upBtn = row.querySelector(".move-up");
    const downBtn = row.querySelector(".move-down");

    if (upBtn) upBtn.disabled = index === 0;
    if (downBtn) downBtn.disabled = index === rows.length - 1;
  });
}

// ⏳ تشغيل الوظيفة بعد تحميل الصفحة
document.addEventListener("DOMContentLoaded", function () {
  updateArrowVisibility();

  // 🔁 تحديث الحالة بعد كل click على سهم
  const tableBody = document.getElementById("priorityTableBody");
  if (tableBody) {
    tableBody.addEventListener("click", function (e) {
      if (e.target.closest(".move-up") || e.target.closest(".move-down")) {
        setTimeout(updateArrowVisibility, 0);  // ننتظر تحديث الـ DOM
      }
    });
  }
});
