function updateNeedles() {
  const tempValues = document.querySelectorAll(".temp-value");
  const tempNeedles = document.querySelectorAll(".temp-needle");

  const humValues = document.querySelectorAll(".hum-value");
  const humNeedles = document.querySelectorAll(".hum-needle");

  tempValues.forEach((valueEl, index) => {
    const needle = tempNeedles[index];
    updateNeedle(valueEl, needle);
  });

  humValues.forEach((valueEl, index) => {
    const needle = humNeedles[index];
    updateNeedle(valueEl, needle);
  });
}

function updateNeedle(valueText, needle) {
  if (!valueText || !needle) return;

  const labelContainer = needle.closest(".d-flex")?.querySelector(".label-container");
  const deviceCol = needle.closest(".device-col");

  let valueRaw = valueText.textContent.trim();
  let status = valueText.dataset.status?.trim().toLowerCase();

  if (
    status === "offline" ||
    valueRaw.toLowerCase() === "offline" ||
    valueRaw === "" ||
    isNaN(parseFloat(valueRaw))
  ) {
    valueText.style.color = "black";
    if (labelContainer) labelContainer.style.color = "black";
    needle.style.filter = "invert(100%)";
    needle.style.transform = "rotate(-90deg)";
    if (deviceCol) deviceCol.style.borderColor = "black";
    return;
  }

  const rawValue = valueRaw.replace(/[^0-9.]/g, "");
  const value = parseFloat(rawValue);
  const min = parseFloat(valueText.dataset.min) || 0;
  const max = parseFloat(valueText.dataset.max) || 100;

  // زاوية الدوران بناءً على min/max
  const angle = ((value - min) / (max - min)) * 180 - 90;
  needle.style.transform = `rotate(${angle}deg)`;

  // الآن نحدد اللون والفلاتر
  let color = "black";
  let filter = "invert(100%)";

  if (!isNaN(min) && !isNaN(max) && status !== "offline") {
    if (value > min && value < max) {
      // داخل النطاق
      color = "#1a8754"; // أخضر
      filter = "brightness(0) saturate(100%) invert(29%) sepia(58%) saturate(567%) hue-rotate(102deg) brightness(94%) contrast(92%)";
    } else if (value === min || value === max) {
      // على الحد
      color = "#f7b500"; // أصفر
      filter = "brightness(0) saturate(100%) invert(48%) sepia(88%) saturate(871%) hue-rotate(1deg) brightness(94%) contrast(95%)";
    } else {
      // خارج النطاق
      color = "#c5272f"; // أحمر
      filter = "brightness(0) saturate(100%) invert(31%) sepia(99%) saturate(7500%) hue-rotate(344deg) brightness(90%) contrast(115%)";
    }
  }

  // تطبيق الألوان على كل العناصر
  valueText.style.color = color;
  if (labelContainer) labelContainer.style.color = color;
  needle.style.filter = filter;

  if (deviceCol) {
    switch (status) {
      case "working":
        deviceCol.style.borderColor = "#1a8754"; // أخضر
        break;
      case "offline":
        deviceCol.style.borderColor = "#000000"; // أسود
        break;
      case "error":
      case "warning":
        deviceCol.style.borderColor = "#c5272f"; // أحمر
        break;
      default:
        deviceCol.style.borderColor = "#6c757d"; // رمادي افتراضي
    }
  }

  console.log(`Value: ${value}, Min: ${min}, Max: ${max}, Color: ${color}`);
}
