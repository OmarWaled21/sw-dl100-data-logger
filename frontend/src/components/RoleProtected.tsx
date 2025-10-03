// components/RoleProtected.tsx
'use client';
import React, { useEffect } from "react";
import Cookies from "js-cookie";
import { useRouter } from "next/navigation";

interface Props {
  allowedRoles: string[]; // اللي مسموح لهم يشوفوا الصفحة
  children: React.ReactNode; // الصفحة نفسها
}

export default function RoleProtected({ allowedRoles, children }: Props) {
  const router = useRouter();
  const role = Cookies.get("role"); // جايبنا الـ role من الكوكيز

  useEffect(() => {
    if (!role || !allowedRoles.includes(role)) {
      router.push("/"); // redirect
    }
  }, [role, allowedRoles, router]);

  // لو مش مسموح له، ممكن ترجّع null لحد ما الـ useEffect ينفذ
  if (!role || !allowedRoles.includes(role)) return null;

  return <>{children}</>;
}

