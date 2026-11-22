"use client";

interface CompressOptions {
  /** Максимальная сторона в пикселях */
  maxSide: number;
  /** Целевой размер файла в байтах */
  maxBytes: number;
  /** Обрезать по центру в квадрат (для аватаров) */
  square?: boolean;
}

type Mime = "image/webp" | "image/jpeg";

function toBlob(canvas: HTMLCanvasElement, type: Mime, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

let webpSupport: Promise<boolean> | null = null;

/**
 * Умеет ли браузер кодировать WebP. Safari на iPhone/iPad не умеет: вместо WebP молча
 * отдаёт несжатый PNG — из-за этого раньше фото «не сжимались». Тогда используем JPEG.
 */
function canEncodeWebp() {
  webpSupport ??= (async () => {
    const c = document.createElement("canvas");
    c.width = c.height = 2;
    const blob = await toBlob(c, "image/webp", 0.8);
    return blob?.type === "image/webp";
  })();
  return webpSupport;
}

type Source = { draw: CanvasImageSource; width: number; height: number; release: () => void };

/** Открывает фото. Если createImageBitmap не справился (например, HEIC с iPhone), пробуем через <img>. */
async function decode(file: File): Promise<Source> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { draw: bmp, width: bmp.width, height: bmp.height, release: () => bmp.close() };
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = "async";
      img.src = url;
      await img.decode();
      return { draw: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) };
    } catch {
      URL.revokeObjectURL(url);
      throw new Error("Этот формат фото не поддерживается. Сохраните фото как JPEG или сделайте скриншот и попробуйте снова.");
    }
  }
}

/** Сжимает изображение на устройстве (WebP или JPEG), чтобы уложиться в бесплатный лимит хранилища. */
export async function compressImage(file: File, { maxSide, maxBytes, square }: CompressOptions): Promise<Blob> {
  const src = await decode(file);
  const type: Mime = (await canEncodeWebp()) ? "image/webp" : "image/jpeg";

  try {
    let sx = 0;
    let sy = 0;
    let sw = src.width;
    let sh = src.height;
    if (!sw || !sh) throw new Error("Не удалось прочитать фото");
    if (square) {
      const side = Math.min(sw, sh);
      sx = (sw - side) / 2;
      sy = (sh - side) / 2;
      sw = sh = side;
    }

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Не удалось обработать фото на этом устройстве");

    // Сначала снижаем качество, потом — если не хватило — уменьшаем размер.
    for (const shrink of [1, 0.8, 0.64, 0.5, 0.4]) {
      const scale = Math.min(1, maxSide / Math.max(sw, sh)) * shrink;
      canvas.width = Math.max(1, Math.round(sw * scale));
      canvas.height = Math.max(1, Math.round(sh * scale));
      if (type === "image/jpeg") {
        // У JPEG нет прозрачности: прозрачные места иначе станут чёрными
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(src.draw, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

      for (const quality of [0.85, 0.72, 0.6, 0.48]) {
        const blob = await toBlob(canvas, type, quality);
        if (blob && blob.size <= maxBytes) return blob;
      }
    }
    throw new Error("Фото слишком большое даже после сжатия — попробуйте другое");
  } finally {
    src.release();
  }
}

/** Расширение файла по типу результата сжатия. */
export function imageExt(blob: Blob) {
  return blob.type === "image/webp" ? "webp" : blob.type === "image/png" ? "png" : "jpg";
}
