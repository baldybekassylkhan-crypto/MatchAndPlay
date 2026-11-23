/** Метка в User-Agent, которую добавляет iOS-приложение (см. capacitor.config.ts). */
export const NATIVE_UA_MARK = "MatchAndPlayApp";

/** Открыто ли приложение внутри iOS-оболочки. Вызывать только в браузере. */
export function isNativeApp() {
  return typeof navigator !== "undefined" && navigator.userAgent.includes(NATIVE_UA_MARK);
}
