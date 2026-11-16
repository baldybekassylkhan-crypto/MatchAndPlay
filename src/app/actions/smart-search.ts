"use server";

import { redirect } from "next/navigation";
import { cacheGet, cacheKey, cacheSet } from "@/lib/ai/cache";
import { geminiConfigured, parseWithGemini } from "@/lib/ai/gemini";
import { aiQueryToFilters, isMeaningful, type AiQuery } from "@/lib/ai/query";
import { parseWithRules } from "@/lib/ai/rules";
import { getCities, getMyProfile } from "@/lib/auth";
import { EMPTY_FILTERS, filtersToQuery, type Distance, type SearchMode } from "@/lib/filters";
import { createClient } from "@/lib/supabase/server";
import { toKzInputs } from "@/lib/time";

export type SmartSource = "ai" | "rules" | "text";

export interface SmartSearchResult {
  href: string;
  source: SmartSource;
}

/**
 * Умный поиск: текст → фильтры.
 * 1) кэш → 2) Gemini (если есть ключ и не превышен лимит) → 3) разбор по правилам → 4) обычный поиск по тексту.
 * Любая ошибка ИИ молча ведёт к запасному варианту.
 */
export async function smartSearch(
  rawText: string,
  ctx: { cityId: number | null; dist: Distance | null; mode: SearchMode },
): Promise<SmartSearchResult> {
  const profile = await getMyProfile();
  if (!profile) redirect("/login");

  const text = rawText.trim().slice(0, 200);
  if (!text) return { href: `/search${filtersToQuery({ ...EMPTY_FILTERS, city: ctx.cityId, dist: ctx.dist }, ctx.mode)}`, source: "text" };

  const cities = await getCities();
  const cityId = ctx.cityId ?? profile.city_id;
  const userCity = cities.find((c) => c.id === cityId) ?? null;
  const now = new Date();
  const key = cacheKey(text, cityId, toKzInputs(now).date);

  let query: AiQuery | null = cacheGet(key);
  let source: SmartSource = "ai";

  if (!query && geminiConfigured && text.length >= 3) {
    const supabase = await createClient();
    const { data: allowed } = await supabase.rpc("consume_ai_quota");
    if (allowed === true) {
      try {
        query = await parseWithGemini(text, cities, userCity, now);
        cacheSet(key, query);
      } catch (e) {
        // 429, таймаут, сеть, невалидный JSON — переключаемся на правила без сообщения пользователю
        console.warn("[smart-search] Gemini недоступен, используем правила:", e instanceof Error ? e.message : e);
      }
    }
  }

  if (!query) {
    query = parseWithRules(text, cities, now);
    source = "rules";
  }

  if (!isMeaningful(query)) {
    // Ничего не распознали — обычный текстовый поиск
    return {
      href: `/search${filtersToQuery({ ...EMPTY_FILTERS, city: ctx.cityId, dist: ctx.dist, q: text }, ctx.mode)}`,
      source: "text",
    };
  }

  const filters = aiQueryToFilters(query, text, cities, { city: ctx.cityId, dist: ctx.dist }, now);
  return { href: `/search${filtersToQuery(filters, ctx.mode)}`, source };
}
