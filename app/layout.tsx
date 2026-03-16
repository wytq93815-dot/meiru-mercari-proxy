import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TopBar } from "./components/TopBar";
import { Sidebar } from "./components/Sidebar";
import { MobileTabBar } from "./components/MobileTabBar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "煤炉代切助手",
  description: "Mercari Proxy 管理面板",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-zinc-50`}
      >
        <TopBar />
        <div className="flex pb-14 md:pb-0">
          <Sidebar />
          <main className="min-h-[calc(100vh-48px)] flex-1 px-3 py-4 md:px-8 md:py-8">
            {children}
          </main>
        </div>
        <MobileTabBar />
      </body>
    </html>
  );
}
