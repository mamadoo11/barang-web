import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "بارنگ | مدیریت ارسال بار",
  description: "ثبت و مدیریت ساده و سریع ارسال بار",
  applicationName: "بارنگ",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "بارنگ",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#f6f7f9",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
