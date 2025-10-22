"use client";

import Navbar from "@/components/navbar";

export default function LayoutWithNavbar({
  children,
  fullScreen = false,
}: {
  children: React.ReactNode;
  fullScreen?: boolean;
}) {
  return (
    <>
      {!fullScreen && <Navbar />}
      {children}
    </>
  );
}
