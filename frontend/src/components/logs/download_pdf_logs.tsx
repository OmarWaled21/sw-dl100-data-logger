"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Props {
  logs: Record<string, any>[];
  logoUrl?: string;
  title?: string;
}

export default function DownloadPDFButton({
  logs,
  logoUrl = "/tomatiki_logo.png",
  title = "System Logs",
}: Props) {
  const handleDownload = async () => {
    if (!logs || logs.length === 0) {
      alert("No logs to export!");
      return;
    }

    const doc = new jsPDF();

    // تحويل اللوجو إلى Base64
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
    doc.text(title, 50, 20);
    doc.setFontSize(10);
    doc.text(`Generated at: ${new Date().toLocaleString()}`, 50, 28);

    // ====== تحديد الأعمدة ======
    let columns: string[] = [];
    let headers: string[] = [];
    const allKeys = Object.keys(logs[0]);

    // === Admin Logs ===
    if (
      title.toLowerCase().includes("admin") ||
      allKeys.some((k) => ["user", "role", "action"].includes(k.toLowerCase()))
    ) {
      const timeKey =
        allKeys.find((k) =>
          ["timestamp", "time", "created_at", "datetime"].includes(
            k.toLowerCase()
          )
        ) || "timestamp";

      // الترتيب المطلوب
      const desiredOrder = [timeKey, "user", "role", "action", "message"];
      columns = desiredOrder.filter((key) =>
        allKeys.some((k) => k.toLowerCase() === key.toLowerCase())
      );

      // العناوين النهائية
      headers = ["TIME", "USER", "ROLE", "ACTION", "MESSAGE"];
    }

    // === Device Logs ===
    else if (
      title.toLowerCase().includes("device") ||
      allKeys.some((k) => ["source", "error_type"].includes(k.toLowerCase()))
    ) {
      const timeKey =
        allKeys.find((k) =>
          ["timestamp", "time", "created_at", "datetime"].includes(
            k.toLowerCase()
          )
        ) || "timestamp";

      const desiredOrder = [timeKey, "source", "error_type", "message"];
      columns = desiredOrder.filter((key) =>
        allKeys.some((k) => k.toLowerCase() === key.toLowerCase())
      );

      headers = ["TIME", "DEVICE", "ERROR TYPE", "MESSAGE"];
    }

    // === Dynamic Fallback ===
    else {
      columns = allKeys.filter(
        (key) => !["id", "admin"].includes(key.toLowerCase())
      );
      headers = columns.map((c) => c.toUpperCase().replace(/_/g, " "));
    }

    // ====== بناء الجدول ======
    const tableHead = [headers];
    const tableBody = logs.map((log) =>
      columns.map((col) => {
        const key = Object.keys(log).find(
          (k) => k.toLowerCase() === col.toLowerCase()
        );
        const value = key ? log[key] : "-";

        if (value === null || value === undefined) return "-";
        if (col.toLowerCase().includes("time")) {
          return new Date(value).toLocaleString();
        }
        return typeof value === "object" ? JSON.stringify(value) : String(value);
      })
    );

    // ====== إنشاء الجدول ======
    autoTable(doc, {
      head: tableHead,
      body: tableBody,
      startY: 40,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 144, 255] },
      didDrawPage: () => {
        doc.addImage(imageBase64, "PNG", 14, 10, logoWidth, logoHeight);
        doc.setFontSize(16);
        doc.text(title, 50, 20);
        doc.setFontSize(10);
        doc.text(`Generated at: ${new Date().toLocaleString()}`, 50, 28);
      },
    });

    // ====== حفظ الملف ======
    const safeTitle = title.toLowerCase().replace(/\s+/g, "_");
    doc.save(`${safeTitle}_${new Date().toISOString().split("T")[0]}.pdf`);
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
