import type { CapacitorConfig } from "@capacitor/cli";

// Адрес опубликованного сайта передаёт сборка iOS (.github/workflows/ios.yml).
const serverUrl = process.env.CAP_SERVER_URL;

const config: CapacitorConfig = {
  appId: "kz.matchandplay.app",
  appName: "Match&Play",
  webDir: "ios-shell",
  // Метка нужна сайту, чтобы скрыть функции, недоступные во встроенном окне (см. src/lib/native.ts)
  appendUserAgent: "MatchAndPlayApp",
  backgroundColor: "#000000",
  ios: {
    contentInset: "never",
    scrollEnabled: true,
    allowsLinkPreview: false,
  },
  ...(serverUrl ? { server: { url: serverUrl, cleartext: false } } : {}),
};

export default config;
