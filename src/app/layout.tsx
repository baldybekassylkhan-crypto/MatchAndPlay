import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { KeyboardWatcher } from "@/components/KeyboardWatcher";
import { MotionProvider } from "@/components/MotionProvider";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Match&Play", template: "%s · Match&Play" },
  description: "Найди, с кем сыграть: футбол, баскетбол, волейбол и другие виды спорта по всему Казахстану.",
  applicationName: "Match&Play",
  appleWebApp: { capable: true, title: "Match&Play", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Android: при открытой клавиатуре страница сжимается, а не уезжает под неё
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body className={`${inter.variable} font-sans antialiased`}>
        <MotionProvider>{children}</MotionProvider>
        <ServiceWorkerRegister />
        <KeyboardWatcher />
      </body>
    </html>
  );
}
