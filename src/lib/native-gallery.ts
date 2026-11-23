"use client";

import { Capacitor } from "@capacitor/core";

/** Есть ли в установленном приложении нативный выбор фото (в старых сборках его нет). */
export const hasNativeGallery = () => Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("Camera");

function toFile(base64: string, format: string) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const ext = format === "jpeg" ? "jpg" : format;
  return new File([bytes], `gallery-${Date.now()}.${ext}`, { type: `image/${format}` });
}

/**
 * Открывает галерею iPhone без нажатия на кнопку, поэтому работает прямо после свайпа.
 * Фото приходит данными: приложение загружает сайт, и локальные пути файлов ему недоступны.
 * Возвращает null, если человек закрыл галерею.
 */
export async function pickNativePhoto(): Promise<File | null> {
  const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");
  try {
    const photo = await Camera.getPhoto({
      source: CameraSource.Photos,
      resultType: CameraResultType.Base64,
      quality: 90,
      width: 2048,
      correctOrientation: true,
    });
    return photo.base64String ? toFile(photo.base64String, photo.format || "jpeg") : null;
  } catch {
    return null;
  }
}
