import { SUPABASE_URL } from "@/lib/env";

export const POSTS_BUCKET = "posts";
export const MAX_POST_IMAGES = 10;
export const MAX_IMAGE_BYTES = 1024 * 1024;
export const MAX_IMAGE_SIDE = 1080;
export const MAX_VIDEO_BYTES = 20 * 1024 * 1024;
export const MAX_VIDEO_SECONDS = 30;

/**
 * Публичная ссылка на файл из бакета posts.
 * Пути, начинающиеся с "/", — локальные демо-картинки из public/ (только для seed-данных).
 */
export function mediaUrl(path: string) {
  if (path.startsWith("/")) return path;
  return `${SUPABASE_URL}/storage/v1/object/public/${POSTS_BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`;
}
