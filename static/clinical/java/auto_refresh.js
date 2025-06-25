let serverTime = null;
  let timeIntervalId = null;

  function displayTime(dateObj) {
    let hours = dateObj.getHours();
    const minutes = String(dateObj.getMinutes()).padStart(2, "0");
    const seconds = String(dateObj.getSeconds()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;

    document.getElementById(
      "current-time"
    ).textContent = `${hours}:${minutes}:${seconds}`;
    document.getElementById("am-pm-indicator").textContent = ampm;

    const options = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    document.getElementById("current-date").textContent =
      dateObj.toLocaleDateString(undefined, options);
  }

  function startClockInterval() {
    if (timeIntervalId) clearInterval(timeIntervalId);
    timeIntervalId = setInterval(() => {
      if (serverTime) {
        serverTime.setSeconds(serverTime.getSeconds() + 1);
        displayTime(serverTime);
      }
    }, 1000);
  }

  document.addEventListener("DOMContentLoaded", () => {
    const timeElem = document.getElementById("current-time");
    const serverTimeString = timeElem.dataset.serverTime;
    if (serverTimeString) {
      serverTime = new Date(serverTimeString);
      displayTime(serverTime);
      startClockInterval(); // نبدأ التحديث المحلي فقط
    }
  });