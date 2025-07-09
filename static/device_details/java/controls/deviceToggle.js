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
    toggleSwitch.addEventListener('change', function() {
      toggleDevice(deviceId, this.checked);
    });
  }

  function toggleDevice(deviceId, isChecked) {
    toggleSwitch.disabled = true;
    const originalStatus = statusText.innerHTML;
    statusText.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> Processing...';

    fetch(`/api/device/${deviceId}/toggle/`, {
      method: 'POST',
      headers: getRequestHeaders()
    })
    .then(handleResponse)
    .then(data => {
      updateDeviceStatus(data.is_on);
    })
    .catch(error => {
      console.error('Toggle error:', error);
      toggleSwitch.checked = !isChecked;
      showTemporaryError(statusText, originalStatus);
    })
    .finally(() => {
      toggleSwitch.disabled = false;
    });
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