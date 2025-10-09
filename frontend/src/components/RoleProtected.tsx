'use client';

import React, { useEffect, useState } from "react";
import Cookies from "js-cookie";
import { useRouter } from "next/navigation";

interface Props {
  allowedRoles: string[];
  children: React.ReactNode;
}

export default function RoleProtected({ allowedRoles, children }: Props) {
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [checked, setChecked] = useState(false); // لتأخير العرض لحد ما يتحقق الشرط

  useEffect(() => {
    const storedRole = Cookies.get("role");
    setRole(storedRole || null);
    setChecked(true);

    if (!storedRole || !allowedRoles.includes(storedRole)) {
      router.push("/");
    }
  }, [allowedRoles, router]);

  // لو لسه بيشيّك على الـ role → رجّع null (منع mismatch)
  if (!checked) return null;

  // لو المستخدم مش مسموح له
  if (!role || !allowedRoles.includes(role)) return null;

  // لو كله تمام
  return <>{children}</>;
}
