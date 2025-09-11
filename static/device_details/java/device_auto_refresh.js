// static/device_details/java/device_auto_refresh.js
function getCurrentFilterDateRange() {
  const startInput = document.querySelector('#start_date');
  const endInput = document.querySelector('#end_date');
  const today = new Date().toISOString().split('T')[0];

  const startDate = startInput && startInput.value ? startInput.value : today;
  const endDate = endInput && endInput.value ? endInput.value : startDate;

  return { startDate, endDate };
}

function fetchAndUpdateDeviceData(deviceId) {
  const { startDate, endDate } = getCurrentFilterDateRange();
  const url = `/device/${deviceId}/?start_date=${startDate}&end_date=${endDate}`;

  fetch(url, {
    headers: { 'X-Requested-With': 'XMLHttpRequest' }
  })
  .then(response => response.json())
  .then(data => {
    // الحالة العامة
    document.querySelector(".device-status-text").textContent = `${i18n.status}: ${i18n[data.status]}`;
    document.querySelector(".last-update").textContent = data.last_update;

    // الفترات
    const updateInterval = (selector, interval) => {
      const el = document.querySelector(selector);
      if (!el) return;

      const hours = Math.floor(interval / 3600);
      const minutes = Math.floor((interval % 3600) / 60);
      const seconds = interval % 60;

      let text = '';
      if (hours > 0) text += `${hours}h `;
      if (minutes > 0) text += `${minutes}m `;
      if (hours === 0 && minutes === 0) text += `${seconds}s`;

      el.textContent = text.trim();
    };

    updateInterval('.interval_wifi', data.interval_wifi);
    updateInterval('.interval_local', data.interval_local);

    // الحرارة والرطوبة
    const tempEl = document.querySelector('.temp-value');
    tempEl.textContent = `${data.temperature}°C`;
    tempEl.dataset.min = data.min_temp;
    tempEl.dataset.max = data.max_temp;
    tempEl.dataset.status = data.status;

    const humEl = document.querySelector('.hum-value');
    humEl.textContent = `${data.humidity}%`;
    humEl.dataset.min = data.min_hum;
    humEl.dataset.max = data.max_hum;
    humEl.dataset.status = data.status;

    // البطارية
    const batteryIcon = document.querySelector(".fa-battery-empty, .fa-battery-quarter, .fa-battery-half, .fa-battery-three-quarters, .fa-battery-full");
    const batteryText = document.querySelector(".batt-status-text");

    if (batteryIcon && batteryText) {
      if (data.status === 'offline') {
        batteryIcon.className = "fa-solid fa-battery-empty fs-5 text-dark";
        batteryText.textContent = "";
      } else {
        const level = data.battery_level;
        const battery_class = level > 80 ? 'fa-battery-full'
                            : level > 50 ? 'fa-battery-three-quarters'
                            : level > 25 ? 'fa-battery-half'
                            : level > 20 ? 'fa-battery-quarter text-warning'
                            : 'fa-battery-empty text-danger';

        batteryIcon.className = `fa-solid ${battery_class} fs-5 text-success`;
        batteryText.textContent = `(${level}%)`;
      }
    }

    // RTC
    const rtcIcon = document.querySelector(".fa-regular.fa-clock");
    const rtcText = document.querySelector(".rtc-status-text");
    if (rtcIcon && rtcText) {
      rtcIcon.className = "fa-regular fa-clock fs-5 " + 
        (data.status === 'offline' ? 'text-dark' : 
         data.rtc_error ? 'text-danger' : 'text-success');

      rtcText.textContent = data.status === 'offline' ? i18n.offline : 
                   (data.rtc_error ? i18n.error : i18n.working);
    }

    // Wi-Fi
    const wifiIcon = document.querySelector(".fa-wifi");
    const wifiText = document.querySelector(".wifi-strength-text");
    if (wifiIcon && wifiText) {
      wifiIcon.className = "fa-solid fa-wifi fs-5 " + 
        (data.status === 'offline' ? 'text-dark' : 'text-primary');

      wifiText.textContent = data.status === 'offline' ? i18n.offline : `${data.wifi_strength}dB`;
    }

    // SD Card
    const sdIcon = document.querySelector(".fa-sd-card");
    const sdText = document.querySelector(".sd-card-text");
    if (data.status === 'offline') {
      sdIcon.className = "fa-solid fa-sd-card fs-5 text-dark";
      sdText.textContent = i18n.offline;
    } else if (data.sd_card_error) {
      sdIcon.className = "fa-solid fa-sd-card fs-5 text-danger";
      sdText.textContent = i18n.error;
    } else {
      sdIcon.className = "fa-solid fa-sd-card fs-5 text-success";
      sdText.textContent = i18n.working;
    }

    updateNeedles();  // لو في gauge مثلاً

    // ✅ تحديث الجدول
    updateTableData(data.combined_data);

    // ✅ تحديث الفلتر النصي المعروض (اختياري)
    document.querySelector('#current_filter_date').textContent = `${i18n.chosenDate}: ${startDate} → ${endDate}`;
  })
  .catch(error => console.error("Error fetching data:", error));
}function updateTableData(data) {
  const tbody = document.querySelector('#readings_table tbody');
  tbody.innerHTML = '';

  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" class="text-center">No data available for the selected date.</td></tr>';
    return;
  }

  data.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row[0]}</td>
      <td>${row[1]}</td>
      <td>${row[2]}</td>
    `;
    tbody.appendChild(tr);
  });
}

document.addEventListener("DOMContentLoaded", function () {
  const deviceId = window.location.pathname.split("/").filter(Boolean).pop();
  fetchAndUpdateDeviceData(deviceId);

  setInterval(() => {
    const deviceTab = document.querySelector('#status-view');
    const tableTab = document.querySelector('#table-view');

    const isDeviceTabActive = deviceTab && deviceTab.classList.contains('show') && deviceTab.classList.contains('active');
    const isTableTabActive = tableTab && tableTab.classList.contains('show') && tableTab.classList.contains('active');

    if (isDeviceTabActive || isTableTabActive) {
      fetchAndUpdateDeviceData(deviceId);
    }
  }, 15000);
});