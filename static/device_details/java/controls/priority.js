// Periority.js
document.addEventListener("DOMContentLoaded", function () {
  const tableBody = document.getElementById("priorityTableBody");
  const savePriorityBtn = document.getElementById("savePriorityBtn");
  const deviceId = document.getElementById("toggleDeviceSwitch")?.dataset.deviceId;

  if (!tableBody || !savePriorityBtn || !deviceId) {
    console.warn("Priority table or button or deviceId missing.");
    return;
  }

  // 🔁 حركة الصفوف
  tableBody.addEventListener("click", function (e) {
    if (e.target.closest(".move-up")) {
      const row = e.target.closest("tr");
      const prev = row.previousElementSibling;
      if (prev) tableBody.insertBefore(row, prev);
    }

    if (e.target.closest(".move-down")) {
      const row = e.target.closest("tr");
      const next = row.nextElementSibling;
      if (next) tableBody.insertBefore(next, row);
    }
  });

  // 💾 زر الحفظ
  savePriorityBtn.addEventListener("click", () => {
    const rows = tableBody.querySelectorAll("tr");
    const priorityData = [];

    rows.forEach((row, index) => {
      const featureName = row.dataset.feature;
      if (featureName) {
        priorityData.push({
          feature: featureName,
          priority: index + 1,
        });
      }
    });

    // إرسال للسيرفر
    savePriorityBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> Saving...';
    savePriorityBtn.disabled = true;

    fetch(`/api/device/${deviceId}/priority/`, {
      method: "POST",
      headers: getRequestHeaders(),
      body: JSON.stringify({ priorities: priorityData }),
    })
      .then(handleResponse)
      .then((data) => {
        alert("✅ Priorities updated successfully!");
        location.reload();
      })
      .catch((err) => {
        console.error("Priority save error:", err);
        alert("❌ Failed to save priorities.");
      })
      .finally(() => {
        savePriorityBtn.innerHTML = "Save Priority";
        savePriorityBtn.disabled = false;
      });
  });
});
