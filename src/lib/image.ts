"use client";

interface CompressOptions {
  /** Максимальная сторона в пикселях */
  maxSide: number;
  /** Целевой размер файла в байтах */
  maxBytes: number;
  /** Обрезать по центру в квадрат (для аватаров) */
  square?: boolean;
}

function toBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
}

/** Сжимает изображение в WebP на устройстве, чтобы уложиться в бесплатный лимит хранилища. */
export async function compressImage(file: File, { maxSide, maxBytes, square }: CompressOptions): Promise<Blob> {
  const bitmap = await createImageBitmap(file);

  let sx = 0;
  let sy = 0;
  let sw = bitmap.width;
  let sh = bitmap.height;
  if (square) {
    const side = Math.min(sw, sh);
    sx = (sw - side) / 2;
    sy = (sh - side) / 2;
    sw = sh = side;
  }

  const scale = Math.min(1, maxSide / Math.max(sw, sh));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas недоступен");
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  for (let quality = 0.85; quality >= 0.4; quality -= 0.15) {
    const blob = await toBlob(canvas, quality);
    if (blob && blob.size <= maxBytes) return blob;
  }
  const last = await toBlob(canvas, 0.35);
  if (!last || last.size > maxBytes) throw new Error("Не удалось сжать фото, попробуйте другое");
  return last;
}
