// scheduleControl.js
document.addEventListener("DOMContentLoaded", function() {
  const scheduleModal = document.getElementById('scheduleModal');
  const autoScheduleSwitch = document.getElementById('autoScheduleSwitch');
  const timeSettings = document.getElementById('timeSettings');
  const autoOnTime = document.getElementById('autoOnTime');
  const autoOffTime = document.getElementById('autoOffTime');
  const saveScheduleBtn = document.getElementById('saveScheduleBtn');
  const deviceId = document.getElementById('toggleDeviceSwitch')?.dataset.deviceId;

  if (!deviceId) return;

  if (scheduleModal) {
    scheduleModal.addEventListener('show.bs.modal', function() {
      loadDeviceSettings(deviceId);
    });

    if (autoScheduleSwitch && timeSettings) {
      autoScheduleSwitch.addEventListener('change', function() {
        timeSettings.classList.toggle('d-none', !this.checked);
        autoOnTime.disabled = !this.checked;
        autoOffTime.disabled = !this.checked;
      });
    }

    if (saveScheduleBtn) {
      saveScheduleBtn.addEventListener('click', function () {
        const deviceId = document.getElementById("toggleDeviceSwitch")?.dataset.deviceId;
        saveSettings(deviceId, saveScheduleBtn, scheduleModal);
      });
    }
  }

  function loadDeviceSettings(deviceId) {
    fetch(`/api/device/${deviceId}/control-info/`, {
      headers: getRequestHeaders(false)
    })
    .then(handleResponse)
    .then(data => {
      autoScheduleSwitch.checked = data.auto_schedule;
      autoOnTime.value = data.auto_on || '08:00';
      autoOffTime.value = data.auto_off || '20:00';
      timeSettings.classList.toggle('d-none', !data.auto_schedule);
      autoOnTime.disabled = !data.auto_schedule;
      autoOffTime.disabled = !data.auto_schedule;
    })
    .catch(error => {
      console.error('Load settings error:', error);
      alert('Failed to load device settings');
    });
  }

  function saveScheduleSettings(deviceId) {
    if (autoOnTime.value >= autoOffTime.value) {
      alert("Auto OFF time must be after Auto ON time.");
      return;
    }

    const originalText = saveScheduleBtn.innerHTML;
    saveScheduleBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> Saving...';
    saveScheduleBtn.disabled = true;

    const payload = {
      auto_schedule: autoScheduleSwitch.checked,
      auto_on: autoOnTime.value,
      auto_off: autoOffTime.value
    };

    fetch(`/api/device/${deviceId}/schedule/update/`, {
      method: 'POST',
      headers: getRequestHeaders(),
      body: JSON.stringify(payload)
    })
    .then(handleResponse)
    .then(data => {
      updateScheduleUI(data);
      const modal = bootstrap.Modal.getInstance(scheduleModal);
      modal.hide();
      updateScheduleUI(data);
      updateDeviceStatus(data.is_on); // لو رجعت الحالة من الـ API
    })
    .catch(error => {
      console.error('Save error:', error);
      alert('Failed to save schedule settings');
    })
    .finally(() => {
      saveScheduleBtn.innerHTML = originalText;
      saveScheduleBtn.disabled = false;
    });
  }

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
});