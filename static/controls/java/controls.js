function toggleLED(id) {
  fetch("/controls/api/led/toggle/", {
    method: "POST",
    headers: {
      "X-CSRFToken": getCookie("csrftoken"),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id: id })
  })
  .then(response => response.json())
  .then(data => {
    const toggleInput = document.getElementById(`toggle-${id}`);
    const statusText = document.getElementById(`led-status-${id}`);

    toggleInput.checked = data.is_on;

    if (data.is_on) {
      statusText.textContent = "ON";
      statusText.classList.remove("status-off");
      statusText.classList.add("status-on");
    } else {
      statusText.textContent = "OFF";
      statusText.classList.remove("status-on");
      statusText.classList.add("status-off");
    }
  });
}

// ✅ CSRF helper for external JS file
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

let refreshIntervalId = null;

function checkIfAnyScheduleIsOn() {
  const switches = document.querySelectorAll("input[id^='schedule-switch-']");
  return Array.from(switches).some(sw => sw.checked);
}

function startAutoRefresh() {
  if (!refreshIntervalId) {
    refreshIntervalId = setInterval(refreshLEDStates, 10000);
    console.log("🔄 Auto-refresh started");
  }
}

function stopAutoRefresh() {
  if (refreshIntervalId) {
    clearInterval(refreshIntervalId);
    refreshIntervalId = null;
    console.log("🛑 Auto-refresh stopped");
  }
}

function toggleSchedule(id) {
  const switchInput = document.getElementById(`schedule-switch-${id}`);
  const isChecked = switchInput.checked;
  const label = switchInput.nextElementSibling;

  const autoOnInput = document.getElementById(`auto_on-${id}`);
  const autoOffInput = document.getElementById(`auto_off-${id}`);

  fetch("/controls/api/led/toggle-schedule/", {
    method: "POST",
    headers: {
      "X-CSRFToken": getCookie("csrftoken"),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: id,
      schedule_on: isChecked
    })
  })
  .then(res => res.json())
  .then(data => {
    if (data.status === "success") {
      label.textContent = data.schedule_on ? "Enabled" : "Disabled";
      label.classList.remove("text-success", "text-danger");
      label.classList.add(data.schedule_on ? "text-success" : "text-danger");

      autoOnInput.disabled = !data.schedule_on;
      autoOffInput.disabled = !data.schedule_on;

      // ✅ التحكم في التحديث التلقائي حسب السويتشات
      if (checkIfAnyScheduleIsOn()) {
        startAutoRefresh();
      } else {
        stopAutoRefresh();
      }
    } else {
      alert("Error updating schedule");
      switchInput.checked = !isChecked;
    }
  })
  .catch(() => {
    alert("Network error");
    switchInput.checked = !isChecked;
  });
}

function updateAutoTime(id, field) {
  const input = document.getElementById(`${field}-${id}`);
  
  if (!input) {
    console.error(`❌ Element not found: ${field}-${id}`);
    return;
  }

  const value = input.value;

  fetch("/controls/api/led/update-time/", {
    method: "POST",
    headers: {
      "X-CSRFToken": getCookie("csrftoken"),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: id,
      field: field,
      value: value
    })
  })
  .then(res => res.json())
  .then(data => {
    if (data.status !== "success") {
      alert("Failed to update time");
    }
  })
  .catch(() => {
    alert("Network error while updating time");
  });
}

function refreshLEDStates() {
  fetch("/controls/api/led/auto-refresh/")
    .then(res => res.json())
    .then(data => {
      if (data.status === "success") {
        data.leds.forEach(led => {
          const toggleInput = document.getElementById(`toggle-${led.id}`);
          const statusText = document.getElementById(`led-status-${led.id}`);
          
          if (toggleInput) toggleInput.checked = led.is_on;
          if (statusText) {
            statusText.textContent = led.is_on ? "ON" : "OFF";
            statusText.classList.toggle("status-on", led.is_on);
            statusText.classList.toggle("status-off", !led.is_on);
          }
        });
      }
    })
    .catch(() => {
      console.warn("⚠️ Failed to auto-refresh LED states");
    });
}

// ✅ عند تحميل الصفحة: شغّل التحديث التلقائي لو في سويتشات مفعّلة
window.addEventListener("DOMContentLoaded", () => {
  if (checkIfAnyScheduleIsOn()) {
    startAutoRefresh();
  }
});
