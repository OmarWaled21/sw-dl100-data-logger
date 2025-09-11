let serverTime = null;
let timeIntervalId = null;
const lang = document.documentElement.lang || "en";

function displayTime(dateObj) {
    let hours = dateObj.getHours();
    const minutes = String(dateObj.getMinutes()).padStart(2, "0");
    const seconds = String(dateObj.getSeconds()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;

    document.getElementById("current-time").textContent = `${hours}:${minutes}:${seconds}`;
    document.getElementById("am-pm-indicator").textContent = ampm;

    // 🟢 الترجمة حسب اللغة الحالية
    const lang = document.documentElement.lang || "en";
    const options = {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
    };

    const locale = lang === "ar" ? "ar-EG" : "en-US";
    document.getElementById("current-date").textContent = dateObj.toLocaleDateString(locale, options);
}

// تحديث الساعة كل ثانية محلياً
function startClockInterval() {
    if (timeIntervalId) clearInterval(timeIntervalId);
    timeIntervalId = setInterval(() => {
        if (serverTime) {
            serverTime.setSeconds(serverTime.getSeconds() + 1);
            displayTime(serverTime);
        }
    }, 1000);
}

function formatInterval(interval) {
    interval = parseInt(interval); // بالثواني
    const minutes = Math.floor(interval / 60);
    const seconds = interval % 60;

    if (minutes === 0) {
        return `${seconds} s`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    let result = "";

    if (hours > 0) {
        result += `${hours} h`;
    }

    if (remainingMinutes > 0) {
        result += (result ? " :" : "") + `${remainingMinutes} min`;
    }

    if (hours === 0 && remainingMinutes === 0 && seconds > 0) {
        result = `${seconds} s`;
    }

    return result;
}


function updateBatteryDisplay(device) {
  const icon = document.getElementById(`battery-icon-${device.id}`);
  const text = document.getElementById(`battery-text-${device.id}`);

  if (device.battery_level == null) {
    icon.className = "fa-solid fa-battery-empty ";  // بطارية فاضية باللون البرتقالي
    icon.classList.add("fa-battery-empty"); // علامة تعجب
    text.textContent = " Missing";
    return;
  }

  const level = device.battery_level;
  let iconClass = "fa-battery-empty";
  let color = "red";

  if (level >= 90) {
    iconClass = "fa-battery-full";
    color = "green";
  } else if (level >= 50) {
    iconClass = "fa-battery-three-quarters";
    color = "green";
  } else if (level >= 25) {
    iconClass = "fa-battery-half";
    color = "orange";
  } else if (level >= 20) {
    iconClass = "fa-battery-quarter";
    color = "red";
  } else {
    iconClass = "fa-battery-empty";
    color = "red";
  }

  icon.className = `fa-solid ${iconClass}`;
  icon.style.color = color;
  text.textContent = ` ${level}%`;
}

document.addEventListener("DOMContentLoaded", () => {
    function updateDashboard() {
        fetch(window.location.href, {
            headers: { "X-Requested-With": "XMLHttpRequest" }
        })
        .then(response => response.json())
        .then(data => {
            // تحديث توقيت الخادم
            serverTime = new Date(data.current_time);
            displayTime(serverTime);

            // تشغيل التحديث المحلي
            startClockInterval();

            // تحديث نظرة عامة على الأجهزة
            document.querySelector(".total_devices h3").textContent = data.total_devices;
            document.querySelector(".working h3").textContent = data.status_counts.working;
            document.querySelector(".warning h3").textContent = data.status_counts.error;
            document.querySelector(".offline h3").textContent = data.status_counts.offline;

            // تحديث كروت الأجهزة
            const container = document.getElementById("devices-cards");
            container.innerHTML = "";
            const getSensorColor = (isOnline, hasError) => {
                if (!isOnline) return "text-dark";
                return hasError ? "text-danger" : "text-success";
            };

            if (data.devices.length === 0) {
                container.innerHTML = `
                    <div class="text-center py-5 w-100">
                        <i class="fas fa-exclamation-triangle fa-3x text-muted mb-3"></i>
                        <h5 class="text-muted" data-translate="noDevices">No devices available</h5>
                        <p class="text-secondary">Please add a new device.</p>
                    </div>
                `;
                return;
            }

            let allCards = "";

            data.devices.forEach(device => {
            const isOnline = device.status !== "offline";
            const sdCardColor = getSensorColor(isOnline, device.sd_card_error);
            const rtcColor = getSensorColor(isOnline, device.rtc_error);
            const wifiColor = isOnline ? "text-success" : "text-dark";

            allCards += `
                <div class="device-col">
                    <div class="card h-100 shadow-sm border-success device-card" style="border-width: 3px">
                        <div class="card-header text-center">
                            <div class="d-flex justify-content-between align-items-center">
                                <h5 class="card-title" style="font-weight: bold">${device.name}</h5>
                                <div class="d-flex align-items-center gap-2"> 
                                <a class="refresh-button" href="/"> 
                                    <i class="fas fa-sync-alt"></i>
                                </a>
                                </div>
                            </div>
                            <div class="d-flex justify-content-between align-items-center ">
                                <div class="d-flex align-items-center ms-3">
                                    <span>${i18n.interval}: ${formatInterval(device.interval_wifi)}</span>
                                </div>
                                <div class="d-flex align-items-center ms-3">
                                    <i id="battery-icon-${device.id}" class="fa-solid me-1"></i>
                                    <span id="battery-text-${device.id}"></span>
                                </div>
                            </div>
                        </div>

                        <div class="card-body text-center ps-5 pe-5">
                            <div class="device-status mb-3">
                                <div class="d-flex justify-content-between align-items-center gap-4 flex-wrap">
                                    <div class="d-flex flex-column align-items-center" style="width: 40%">
                                        <div class="gauge">
                                            <img src="/static/images/gauge-bar.png" class="bar" />
                                            <img src="/static/images/needle.png" class="needle temp-needle" />
                                        </div>
                                        <div class="label-container d-flex align-items-center justify-content-center gap-2 mt-2">
                                            <i class="fa-solid fa-temperature-three-quarters fs-5"></i>
                                            <span class="label">${i18n.Temperature}</span>
                                        </div>
                                        <div class="value fs-5 mt-1 temp-value"
                                            data-status="${device.status}"
                                            data-min="${device.min_temp}"
                                            data-max="${device.max_temp}">
                                            ${device.temperature}°C
                                        </div>
                                    </div>

                                    <div class="d-flex flex-column align-items-center" style="width: 40%">
                                        <div class="gauge">
                                            <img src="/static/images/gauge-bar.png" class="bar" />
                                            <img src="/static/images/needle.png" class="needle hum-needle" />
                                        </div>
                                        <div class="label-container d-flex align-items-center justify-content-center gap-2 mt-2">
                                            <i class="fa-solid fa-droplet"></i>
                                            <span class="label">${i18n.Humidity}</span>
                                        </div>
                                        <div class="value fs-5 mt-1 hum-value"
                                            data-status="${device.status}"
                                            data-min="${device.min_hum}"
                                            data-max="${device.max_hum}">
                                            ${device.humidity}%
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- sensors icons -->
                            <div class="sensors-icons">
                            <div class="d-flex justify-content-between">
                                <i class="fa-solid fa-sd-card pe-2 ${sdCardColor}"> Sd</i>
                                <i class="fa-regular fa-clock pe-2 ${rtcColor}"> Rtc</i>
                                <i class="fa-solid fa-wifi pe-2 ${wifiColor}"> ${device.wifi_strength}</i>
                            </div>
                            </div>

                            <form action="/device/${device.device_id}" method="get">
                                <button type="submit" class="btn-red mt-3" dir="ltr">
                                <span>${i18n.ShowDetails}</span>
                                <i class="fas fa-chevron-right"></i>
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
                `;
                // ✨ نحدث البطارية بعد ما الكارت يتحط
                setTimeout(() => updateBatteryDisplay(device), 0);
            });
            container.innerHTML = allCards;

            // تحديث المؤشرات
            updateNeedles();
            updateLastUpdates();
        });
    }

    updateDashboard(); // التحديث الأول
    setInterval(updateDashboard, 5000); // كل 5 ثواني
});
