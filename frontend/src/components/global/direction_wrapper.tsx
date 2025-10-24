"use client";

import { useEffect, useState } from "react";
import i18n from "i18next";

export default function DirectionWrapper({ children }: { children: React.ReactNode }) {
  const [dir, setDir] = useState<"ltr" | "rtl">("ltr");

  useEffect(() => {
    const currentLang = i18n.language || "en";
    const newDir = currentLang.startsWith("ar") ? "rtl" : "ltr";
    setDir(newDir);

    document.documentElement.lang = currentLang;
    document.documentElement.dir = newDir;
  }, [i18n.language]);

  return <div dir={dir}>{children}</div>;
}
