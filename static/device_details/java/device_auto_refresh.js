function getCurrentFilterDate() {
  const input = document.querySelector('#start_date');
  if (input && input.value) return input.value;
  return new Date().toISOString().split('T')[0];
}


function fetchAndUpdateDeviceData(deviceId, filterDate) {
  // نحصل على تاريخ اليوم بصيغة yyyy-mm-dd
  const today = new Date().toISOString().split('T')[0];

  // إذا التاريخ هو اليوم، ما نضيفش ?filter_date في الرابط
  const url = filterDate === today ? `/device/${deviceId}/` : `/device/${deviceId}/?filter_date=${filterDate}`;

  fetch(url, {
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
    }
  })
  .then(response => response.json())
  .then(data => {

    document.querySelector(".device-status-text").textContent = `${i18n.status}: ${i18n[data.status]}`;
    document.querySelector(".last-update").textContent = data.last_update;
    const intervalElWifi = document.querySelector('.interval_wifi');
    if (intervalElWifi) {
      const interval = data.interval_wifi; // القيمة بالثواني

      const hours = Math.floor(interval / 3600);
      const minutes = Math.floor((interval % 3600) / 60);
      const seconds = interval % 60;

      let text = '';
      if (hours > 0) text += `${hours}h `;
      if (minutes > 0) text += `${minutes}m `;
      if (hours === 0 && minutes === 0) text += `${seconds}s`;

      intervalElWifi.textContent = text.trim();
    }

    const intervalElLocal = document.querySelector('.interval_local');
    if (intervalElLocal) {
      const interval = data.interval_local; // القيمة بالثواني

      const hours = Math.floor(interval / 3600);
      const minutes = Math.floor((interval % 3600) / 60);
      const seconds = interval % 60;

      let text = '';
      if (hours > 0) text += `${hours}h `;
      if (minutes > 0) text += `${minutes}m `;
      if (hours === 0 && minutes === 0) text += `${seconds}s`;

      intervalElLocal.textContent = text.trim();
    }

    // تحديث القيم داخل الـ DOM
    document.querySelector('.temp-value').textContent = `${data.temperature}°C`;
    document.querySelector('.temp-value').dataset.min = data.min_temp;
    document.querySelector('.temp-value').dataset.max = data.max_temp;
    document.querySelector('.temp-value').dataset.status = data.status;

    document.querySelector('.hum-value').textContent = `${data.humidity}%`;
    document.querySelector('.hum-value').dataset.min = data.min_hum;
    document.querySelector('.hum-value').dataset.max = data.max_hum;
    document.querySelector('.hum-value').dataset.status = data.status;

    // ✅ تحديث Battery
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

    // ✅ تحديث RTC - باستخدام الكلاس الصحيح
    const rtcIcon = document.querySelector(".fa-regular.fa-clock");
    const rtcText = document.querySelector(".rtc-status-text");
    if (rtcIcon && rtcText) {
      rtcIcon.className = "fa-regular fa-clock fs-5 " + 
        (data.status === 'offline' ? 'text-dark' : 
         data.rtc_error ? 'text-danger' : 'text-success');
      
      rtcText.textContent = data.status === 'offline' ? i18n.offline : 
                     (data.rtc_error ? i18n.error : i18n.working);
    }

    // ✅ تحديث Wi-Fi - إضافة الكلاس المحدد
    const wifiIcon = document.querySelector(".fa-wifi");
    const wifiText = document.querySelector(".wifi-strength-text");
    if (wifiIcon && wifiText) {
      wifiIcon.className = "fa-solid fa-wifi fs-5 " + 
        (data.status === 'offline' ? 'text-dark' : 'text-primary');
      
      wifiText.textContent = data.status === 'offline' ? i18n.offline : `${data.wifi_strength}dB`;
    }

    if (!rtcIcon) console.error("RTC icon not found!");
    if (!wifiIcon) console.error("Wi-Fi icon not found!");

    // ✅ تحديث SD Card
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

    // تحديث اللون + مؤشر الإبرة
    updateNeedles();
  })
  .catch(error => console.error("Error fetching data:", error));
}

let currentFilterDate = getCurrentFilterDate();

// Call it every 10 seconds
const deviceId = window.location.pathname.split("/").filter(Boolean).pop();
updateNeedles();
fetchAndUpdateDeviceData(deviceId, currentFilterDate);
fetchFilteredData(deviceId, currentFilterDate);

setInterval(() => {
  const filterDate = getCurrentFilterDate();
fetchAndUpdateDeviceData(deviceId, filterDate);
}, 5000);

// تحديث كل 10 ثوانٍ للجدول فقط إذا كان التبويب ظاهر
setInterval(() => {
  const tableTab = document.querySelector('#table-view');
  if (tableTab && tableTab.classList.contains('show') && tableTab.classList.contains('active')) {
    const filterDate = getCurrentFilterDate();
    fetchFilteredData(deviceId, filterDate);
  }
}, 10000);

function fetchFilteredData(deviceId, date) {
  const today = new Date().toISOString().split('T')[0];
  const url = date === today ? `/device/${deviceId}/` : `/device/${deviceId}/?filter_date=${date}`;

    fetch(url, {
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
        }
    })
    .then(response => response.json())
    .then(data => {
        updateTableData(data.combined_data);
        // يمكنك تحديث التاريخ المعروض إذا لزم الأمر
        document.querySelector('#current_filter_date').textContent = `${i18n.chosenDate}: ${date}`;
    })
    .catch(error => console.error("Error fetching filtered data:", error));
}

function updateTableData(data) {
    const tbody = document.querySelector('#readings_table tbody');
    tbody.innerHTML = ''; // Clear existing rows
    
    if (data.length === 0) {
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

  function getCurrentFilterDate() {
    const input = document.querySelector('#start_date');
    return input && input.value ? input.value : new Date().toISOString().split('T')[0];
  }

  let currentFilterDate = getCurrentFilterDate();
  updateNeedles();
  fetchAndUpdateDeviceData(deviceId, currentFilterDate);
  fetchFilteredData(deviceId, currentFilterDate);

  setInterval(() => {
    const filterDate = getCurrentFilterDate();
    fetchAndUpdateDeviceData(deviceId, filterDate);
  }, 5000);

  setInterval(() => {
    const tableTab = document.querySelector('#table-view');
    if (tableTab && tableTab.classList.contains('show') && tableTab.classList.contains('active')) {
      const filterDate = getCurrentFilterDate();
      fetchFilteredData(deviceId, filterDate);
    }
  }, 10000);
});
