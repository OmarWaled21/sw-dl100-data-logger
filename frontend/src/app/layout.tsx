// src/app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "@fortawesome/fontawesome-free/css/all.min.css";
import Navbar from "@/components/navbar";
import "./globals.css";
import "../i18n"; 
import GlobalLogNotifier from "@/components/LocalNotificationListener";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Data Logger App",
  description:
    "a data logger app built with Next.js and Django that logs data from various sensors. like temperature, humidity, soil moisture, light intensity, and more.",
  icons: {
    icon: "/favicon.ico",
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Navbar />
        {children}
        <GlobalLogNotifier />
      </body>
    </html>
  );
}
