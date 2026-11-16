import { z } from "zod";
import { EMPTY_FILTERS, isDate, type LobbyFilters } from "@/lib/filters";
import { SPORT_IDS } from "@/lib/sports";
import { toKzInputs } from "@/lib/time";
import type { City } from "@/lib/types";

/**
 * Структура, в которую умный поиск переводит текст пользователя.
 * Каждое поле с .catch(): если модель ошиблась в одном поле, остальные всё равно используются.
 */
export const aiQuerySchema = z.object({
  sports: z
    .array(z.string())
    .nullable()
    .catch(null)
    .transform((v) => (v ?? []).filter((s): s is (typeof SPORT_IDS)[number] => (SPORT_IDS as readonly string[]).includes(s))),
  city: z.string().max(60).nullable().catch(null),
  date_from: z.string().refine(isDate).nullable().catch(null),
  date_to: z.string().refine(isDate).nullable().catch(null),
  time_from: z.string().regex(/^\d{2}:\d{2}$/).nullable().catch(null),
  time_to: z.string().regex(/^\d{2}:\d{2}$/).nullable().catch(null),
  max_players: z.number().int().min(2).max(100).nullable().catch(null),
  min_free_slots: z.number().int().min(1).max(50).nullable().catch(null),
  level: z.enum(["beginner", "amateur", "advanced"]).nullable().catch(null),
  keywords: z
    .array(z.string())
    .nullable()
    .catch(null)
    .transform((v) =>
      (v ?? [])
        .map((k) => k.trim().toLowerCase().replace(/[,#]/g, "").slice(0, 30))
        .filter((k) => k.length >= 3)
        .slice(0, 5),
    ),
});

export type AiQuery = z.infer<typeof aiQuerySchema>;

export const EMPTY_AI_QUERY: AiQuery = {
  sports: [],
  city: null,
  date_from: null,
  date_to: null,
  time_from: null,
  time_to: null,
  max_players: null,
  min_free_slots: null,
  level: null,
  keywords: [],
};

/** Распознано ли хоть что-то полезное. */
export function isMeaningful(q: AiQuery) {
  return Boolean(
    q.sports.length ||
      q.city ||
      q.date_from ||
      q.date_to ||
      q.time_from ||
      q.time_to ||
      q.max_players ||
      q.min_free_slots ||
      q.level,
  );
}

const norm = (s: string) => s.toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-яәіңғүұқөһ0-9]/gi, "");

export function findCity(cities: City[], name: string | null): City | null {
  if (!name) return null;
  const n = norm(name);
  return (
    cities.find((c) => [c.name_ru, c.name_kz, c.slug, ...c.aliases].some((v) => norm(v) === n)) ??
    cities.find((c) => [c.name_ru, c.name_kz, ...c.aliases].some((v) => n.length >= 4 && norm(v).startsWith(n))) ??
    null
  );
}

const hour = (hhmm: string, roundUp: boolean) => {
  const [h, m] = hhmm.split(":").map(Number);
  return Math.min(24, roundUp && m > 0 ? h + 1 : h);
};

const addDays = (date: string, days: number) => {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
};

/** Разобранный запрос → фильтры поиска. Расстояние сохраняется из текущих фильтров. */
export function aiQueryToFilters(
  q: AiQuery,
  text: string,
  cities: City[],
  base: Pick<LobbyFilters, "city" | "dist">,
  now: Date = new Date(),
): LobbyFilters {
  const today = toKzInputs(now).date;
  const maxDate = addDays(today, 60);
  const clamp = (d: string) => (d < today ? today : d > maxDate ? maxDate : d);

  let day = "any";
  const from = q.date_from ? clamp(q.date_from) : null;
  const to = q.date_to ? clamp(q.date_to) : null;
  if (from && (!to || to === from)) day = from;
  else if (from && to && to > from) day = `${from}_${to}`;
  else if (!from && to) day = to === today ? today : `${today}_${to}`;

  let hours: LobbyFilters["hours"] = null;
  if (q.time_from || q.time_to) {
    const h1 = q.time_from ? hour(q.time_from, false) : 0;
    let h2 = q.time_to ? hour(q.time_to, true) : 24;
    if (h2 <= h1) h2 = 24; // «с 22 до часу ночи» — до конца дня
    if (!(h1 === 0 && h2 === 24)) hours = { from: h1, to: h2 };
  }

  return {
    ...EMPTY_FILTERS,
    city: findCity(cities, q.city)?.id ?? base.city,
    dist: base.dist,
    day,
    sports: q.sports,
    hours,
    maxp: q.max_players,
    free: q.min_free_slots,
    level: q.level,
    kw: q.keywords,
    ai: text.trim().slice(0, 200),
  };
}
