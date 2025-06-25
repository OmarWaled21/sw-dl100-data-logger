let sensorChart = null;

document.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById("sensorChart");
    if (!canvas) {
        console.error("Canvas element not found!");
        return;
    }

    const labels = JSON.parse(document.getElementById('labels-data').textContent);
    const tempData = JSON.parse(document.getElementById('temp-data').textContent);
    const humData = JSON.parse(document.getElementById('hum-data').textContent);

    if (!labels.length || !tempData.length || !humData.length) {
        console.error("Missing chart data attributes!");
        return;
    }

    const ctx = canvas.getContext("2d");

    sensorChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: i18n.temperature +' (°C)',
                    data: tempData,
                    borderColor: 'rgba(255, 99, 132, 1)',
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    fill: false,
                    tension: 0.3,
                    pointRadius: 4,
                    borderWidth: 2
                },
                {
                    label: i18n.humidity +' (%)',
                    data: humData,
                    borderColor: 'rgba(54, 162, 235, 1)',
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    fill: false,
                    tension: 0.3,
                    pointRadius: 4,
                    borderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
});

function updateSensorChart(newLabels, newTempData, newHumData) {
    if (!sensorChart) {
        console.error("sensorChart not initialized yet!");
        return;
    }
    sensorChart.data.labels = newLabels;
    sensorChart.data.datasets[0].data = newTempData;
    sensorChart.data.datasets[1].data = newHumData;
    sensorChart.update();
}


async function fetchAndUpdateData() {
    try {
        const response = await fetch(window.location.href, {
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        });
        if (!response.ok) throw new Error("Network response was not ok");

        const data = await response.json();

        // تحديث الإبر أو أي عناصر أخرى في الصفحة بناءً على data.temperature و data.humidity
        // مثلا:
        // document.querySelector('.temp-value').textContent = data.temperature + '°C';

        // حدث الجراف
        updateSensorChart(data.labels, data.temp_data, data.hum_data);

    } catch (error) {
        console.error("Error fetching sensor data:", error);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    // الكود السابق هنا...

    // بعد إنشاء sensorChart
    fetchAndUpdateData();  // تحديث أول مرة

    setInterval(fetchAndUpdateData, 10000);  // تحديث كل 10 ثواني
});
