"use client";

import Navbar from "@/components/navbar";
import GlobalLogNotifier from "@/components/global/LocalNotificationListener";

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
      <GlobalLogNotifier />
    </>
  );
}
