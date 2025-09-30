import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import Chart from "chart.js/auto";

interface Row {
  timestamp: string; // "YYYY-MM-DD HH:mm:ss"
  temperature: number;
  humidity: number;
}

function calculateSummary(values: number[]) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const average = values.reduce((a, b) => a + b, 0) / values.length;

  const freqMap = new Map<number, number>();
  values.forEach((v) => freqMap.set(v, (freqMap.get(v) || 0) + 1));

  let mostRepeated = values[0];
  let maxCount = 0;
  freqMap.forEach((count, value) => {
    if (count > maxCount) {
      maxCount = count;
      mostRepeated = value;
    }
  });

  return { max, min, average, mostRepeated };
}

export async function downloadDevicePdf(
  rows: Row[],
  name: string,
  filterType: "single" | "range",
  filterDateStart?: string,
  filterDateEnd?: string
) {
  const doc = new jsPDF();

  // تحويل صورة اللوجو لـ Base64
  const toBase64 = (url: string) =>
    fetch(url)
      .then((res) => res.blob())
      .then(
        (blob) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          })
      );

  const imageBase64 = await toBase64("/tomatiki_logo.png");

  const img = new Image();
  img.src = imageBase64;
  let logoWidth = 20;
  let logoHeight = 20;
  await new Promise<void>((resolve) => {
    img.onload = () => {
      const maxWidth = 30;
      const maxHeight = 20;
      const ratio = Math.min(maxWidth / img.width, maxHeight / img.height);
      logoWidth = img.width * ratio;
      logoHeight = img.height * ratio;
      resolve();
    };
  });

  const temperatures = rows.map((r) => r.temperature);
  const humidities = rows.map((r) => r.humidity);

  // ====== Header ======
  const addHeader = (doc: jsPDF) => {
    doc.addImage(imageBase64, "PNG", 14, 10, logoWidth, logoHeight);
    doc.setFontSize(16);
    doc.text(`${name} Readings`, 50, 20);
    doc.setFontSize(10);

    let filterText = "All dates";
    if (filterType === "single" && filterDateStart) filterText = `Date: ${filterDateStart}`;
    else if (filterType === "range" && filterDateStart && filterDateEnd)
      filterText = `Date Range: ${filterDateStart} to ${filterDateEnd}`;
    doc.text(filterText, 50, 28);
    doc.text(`Generated at: ${new Date().toLocaleString()}`, 50, 33);
  };

  addHeader(doc);

  // ====== جدول القراءات ======
  autoTable(doc, {
    startY: 40,
    head: [["Timestamp", "Temperature (°C)", "Humidity (%)"]],
    body: rows.map((r) => [r.timestamp, r.temperature.toFixed(1), r.humidity.toFixed(1)]),
    styles: { fontSize: 8 },
    headStyles: { fontSize: 8 },
    didDrawPage: () => addHeader(doc),
  });

  // ====== Line Chart للقراءات الكبيرة ======
  const lineCanvas = document.createElement("canvas");
  const sortedRows = [...rows].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const labels = sortedRows.map(r => {
    const d = new Date(r.timestamp);
    const date = d.toLocaleDateString(); // YYYY-MM-DD حسب Locale
    const time = d.toLocaleTimeString(); // HH:MM:SS حسب Locale
    return `${date}\n${time}`; // سطرين
  });

  lineCanvas.width = 800;
  lineCanvas.height = 250;
  lineCanvas.style.position = "absolute";
  lineCanvas.style.left = "-9999px";
  document.body.appendChild(lineCanvas);

  const ctxLine = lineCanvas.getContext("2d");
  if (ctxLine) {
    new Chart(ctxLine, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          { 
            label: "Temperature (°C)", 
            data: sortedRows.map(r => r.temperature),
            borderColor: "rgba(255, 99, 132, 1)",
            backgroundColor: "rgba(255, 99, 132, 0.2)",
            fill: false,
            tension: 0.1,
            borderWidth: 1,
          },
          { 
            label: "Humidity (%)", 
            data: sortedRows.map(r => r.humidity),
            borderColor: "rgba(54, 162, 235, 1)",
            backgroundColor: "rgba(54, 162, 235, 0.2)",
            fill: false,
            tension: 0.1,
            borderWidth: 1,
          },
        ]
      },
      options: {
        responsive: false,
        scales: {
          x: {
            title: { display: true, text: "Date / Time" },
            ticks: {
              autoSkip: true,
              maxTicksLimit: 15,
              font: {size: 8},
              callback: function(val, index) {
                const label = this.getLabelForValue(index);
                return label.split("\n"); // اجعل التاريخ فوق الوقت
              }
            }
          },
          y: { title: { display: true, text: "Values" }, beginAtZero: false },
        },
        plugins: { legend: { position: "top" } },
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  const lineChartImage = lineCanvas.toDataURL("image/png");
  document.body.removeChild(lineCanvas);

  const chartY = (doc as any).lastAutoTable.finalY + 10;
  doc.addImage(lineChartImage, "PNG", 14, chartY, 180, 100);

  // ====== جدول الملخص ======
  const startYSummary = chartY + 110;
  const tempSummary = calculateSummary(temperatures);
  const humSummary = calculateSummary(humidities);

  autoTable(doc, {
    startY: startYSummary,
    head: [["Metric", "Temperature (°C)", "Humidity (%)"]],
    body: [
      ["Max", tempSummary.max.toFixed(1), humSummary.max.toFixed(1)],
      ["Min", tempSummary.min.toFixed(1), humSummary.min.toFixed(1)],
      ["Average", tempSummary.average.toFixed(2), humSummary.average.toFixed(2)],
      ["Most Repeated", tempSummary.mostRepeated.toFixed(1), humSummary.mostRepeated.toFixed(1)],
    ],
    theme: "grid",
    styles: { fontSize: 8 },
    headStyles: { fontSize: 8 },
  });

  // ====== Bar Chart للملخص ======
  const barCanvas = document.createElement("canvas");
  barCanvas.width = 600;
  barCanvas.height = 150;
  barCanvas.style.position = "absolute";
  barCanvas.style.left = "-9999px";
  document.body.appendChild(barCanvas);

  const ctxBar = barCanvas.getContext("2d");
  const barTempValues = [tempSummary.max, tempSummary.min, tempSummary.average, tempSummary.mostRepeated];
  const barHumValues = [humSummary.max, humSummary.min, humSummary.average, humSummary.mostRepeated];

  if (ctxBar) {
    new Chart(ctxBar, {
      type: "bar",
      data: {
        labels: ["Max", "Min", "Average", "Most Repeated"],
        datasets: [
          { label: "Temperature (°C)", data: barTempValues, backgroundColor: "rgba(255, 99, 132, 0.8)" },
          { label: "Humidity (%)", data: barHumValues, backgroundColor: "rgba(54, 162, 235, 0.8)" },
        ],
      },
      options: {
        responsive: false,
        scales: { y: { beginAtZero: false, title: { display: true, text: "Values" } } },
        plugins: { legend: { position: "top" } },
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  const barChartImage = barCanvas.toDataURL("image/png");
  document.body.removeChild(barCanvas);

  const pageHeight = doc.internal.pageSize.height; // ارتفاع الصفحة
  const margin = 10; // هامش
  const chartHeight = 60; // ارتفاع الرسم
  const spaceNeeded = (doc as any).lastAutoTable.finalY + chartHeight + margin;

  // لو المساحة المتبقية قليلة أضف صفحة جديدة
  if (spaceNeeded > pageHeight) {
    doc.addPage();
    (doc as any).lastAutoTable = { finalY: margin }; // reset finalY
  }

  const finalY = (doc as any).lastAutoTable.finalY + 10;
  doc.addImage(barChartImage, "PNG", 14, finalY, 180, 60);

  doc.save(`device_data_${name}.pdf`);
}
