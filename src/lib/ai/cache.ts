import "server-only";

import type { AiQuery } from "@/lib/ai/query";

/**
 * Кэш разобранных запросов на 10 минут в памяти сервера.
 * На Vercel у каждого экземпляра свой кэш — этого достаточно, чтобы
 * повторные одинаковые запросы не тратили бесплатный лимит Gemini.
 */
const TTL_MS = 10 * 60_000;
const MAX_ENTRIES = 500;

const store = new Map<string, { expires: number; value: AiQuery }>();

export function cacheKey(text: string, cityId: number, kzDate: string) {
  return `${kzDate}|${cityId}|${text.trim().toLowerCase().replace(/\s+/g, " ")}`;
}

export function cacheGet(key: string): AiQuery | null {
  const hit = store.get(key);
  if (!hit) return null;
  if (hit.expires < Date.now()) {
    store.delete(key);
    return null;
  }
  return hit.value;
}

export function cacheSet(key: string, value: AiQuery) {
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
  store.set(key, { expires: Date.now() + TTL_MS, value });
}
