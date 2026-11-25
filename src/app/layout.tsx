import type { Metadata, Viewport } from "next";
import { KeyboardWatcher } from "@/components/KeyboardWatcher";
import { I18nProvider } from "@/components/I18nProvider";
import { MotionProvider } from "@/components/MotionProvider";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { getLocale } from "@/lib/i18n/server";
import "./globals.css";

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
    { media: "(prefers-color-scheme: light)", color: "#f2f2f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body className="font-sans antialiased">
        <I18nProvider locale={locale}>
          <MotionProvider>{children}</MotionProvider>
        </I18nProvider>
        <ServiceWorkerRegister />
        <KeyboardWatcher />
      </body>
    </html>
  );
}
