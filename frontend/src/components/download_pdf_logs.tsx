"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Props {
  logs: {
    id: number;
    source: string;
    error_type?: string;
    message: string;
    timestamp: string;
  }[];
  logoUrl?: string; // رابط اللوجو
}

export default function DownloadPDFButton({ logs, logoUrl = "/tomatiki_logo.png" }: Props) {
  const handleDownload = async () => {
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

    const imageBase64 = await toBase64(logoUrl);

    // ====== Header ======
    let logoWidth = 20;
    let logoHeight = 20;
    const img = new Image();
    img.src = imageBase64;
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

    doc.addImage(imageBase64, "PNG", 14, 10, logoWidth, logoHeight);
    doc.setFontSize(16);
    doc.text("System Logs", 50, 20);
    doc.setFontSize(10);
    doc.text(`Generated at: ${new Date().toLocaleString()}`, 50, 28);

    // ====== جدول اللوجز ======
    const tableData = logs.map((log) => [
      new Date(log.timestamp).toLocaleString(),
      log.source || "-",
      log.error_type || "-",
      log.message,
    ]);

    autoTable(doc, {
      head: [["Timestamp", "Device", "Error Type", "Message"]],
      body: tableData,
      startY: 40,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 144, 255] },
      didDrawPage: () => {
        // نعيد الهيدر على كل صفحة
        doc.addImage(imageBase64, "PNG", 14, 10, logoWidth, logoHeight);
        doc.setFontSize(16);
        doc.text("System Logs", 50, 20);
        doc.setFontSize(10);
        doc.text(`Generated at: ${new Date().toLocaleString()}`, 50, 28);
      },
    });

    doc.save("logs.pdf");
  };

  return (
    <button
      onClick={handleDownload}
      className="px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors cursor-pointer"
    >
      Download PDF
    </button>
  );
}
