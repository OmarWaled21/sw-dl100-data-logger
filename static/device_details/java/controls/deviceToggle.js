document.addEventListener("DOMContentLoaded", function () {
  const toggleSwitch = document.getElementById('toggleDeviceSwitch');
  const statusText = document.getElementById('deviceStatusText');
  const statusBadge = document.querySelector('.device-info .badge');
  const deviceId = toggleSwitch?.dataset.deviceId;

  if (!deviceId) {
    console.error('Device ID not found');
    return;
  }

  // ✅ Polling كل 5 ثواني (مرة واحدة فقط)
if (!window.__deviceControlTimer) {
  window.__deviceControlTimer = setInterval(() => {
    fetch(`/api/device/${deviceId}/control-info/`, {
      method: 'GET',
      headers: getRequestHeaders(false)
    })
    .then(res => res.json())
    .then(data => {
      updateDeviceStatus(data.is_on);
    })
    .catch(err => {
      console.error("Polling error:", err);
    });
  }, 5000);
}

  // ✅ إرسال toggle عند تغيير الزر
  toggleSwitch.addEventListener('change', function () {
    const originalChecked = toggleSwitch.checked;

    toggleSwitch.disabled = true;
    statusText.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>';
    statusText.className = 'status-indicator text-warning';

    fetch(`/api/device/${deviceId}/toggle/`, {
      method: 'POST',
      headers: getRequestHeaders(),
    })
    .then(response => response.json())
    .then(data => {
      console.log("Toggle command sent. Waiting for polling...");
      // الحالة هتتحدث تلقائيًا بعد شوية
    })
    .catch(error => {
      console.error('Toggle error:', error);
      toggleSwitch.checked = !originalChecked;
      toggleSwitch.disabled = false;
    });
  });

  // ✅ تحديث حالة الزر والكتابة
  function updateDeviceStatus(isOn) {
    toggleSwitch.checked = isOn;
    toggleSwitch.disabled = false;

    statusText.innerHTML = `<i class="fas fa-power-off me-1"></i>${isOn ? 'POWER ON' : 'POWER OFF'}`;
    statusText.className = `status-indicator ${isOn ? 'text-success' : 'text-secondary'}`;

    if (statusBadge) {
      statusBadge.className = `badge me-2 ${isOn ? 'bg-success' : 'bg-secondary'}`;
      statusBadge.textContent = isOn ? 'ONLINE' : 'OFFLINE';
    }
  }

  // ✅ headers و csrf
  function getRequestHeaders(includeJson = true) {
    const headers = {
      'X-CSRFToken': getCookie('csrftoken'),
      'Authorization': `Token ${UserToken}`
    };
    if (includeJson) headers['Content-Type'] = 'application/json';
    return headers;
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
});
