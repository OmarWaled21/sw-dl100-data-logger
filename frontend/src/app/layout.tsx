import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "@fortawesome/fontawesome-free/css/all.min.css";
import "./globals.css";
import "../i18n";
import DirectionWrapper from "@/components/global/direction_wrapper"; // 👈 مكون جديد
import GlobalLogNotifier from "@/components/global/LocalNotificationListener";

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
    "A data logger app built with Next.js and Django that logs data from various sensors.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
      >
        <DirectionWrapper>
          <main className="flex-1 w-full">
            <GlobalLogNotifier />
            {children}
          </main>
        </DirectionWrapper>
      </body>
    </html>
  );
}
