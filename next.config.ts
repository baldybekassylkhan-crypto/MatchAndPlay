import path from "node:path";
import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  // Геолокация нужна для «ближайшего города» и фильтра по расстоянию, камера — для QR-отметки; микрофон — нет
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(self), interest-cohort=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  // Выше по дереву папок есть другой package-lock.json — явно указываем корень проекта.
  outputFileTracingRoot: path.join(__dirname),
  poweredByHeader: false,
  // Метаданные (title, description) сразу в <head>, а не потоком в конце страницы:
  // страницы и так рендерятся на сервере, задержка ничтожная, а превью ссылок и SEO надёжнее.
  htmlLimitedBots: /.*/,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // Площадки меняются редко: телефон держит файл сутки и потом проверяет обновление
        source: "/venues/:file*",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
      },
      {
        // Service worker всегда проверяется заново, чтобы обновления доходили сразу
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
};

export default nextConfig;
