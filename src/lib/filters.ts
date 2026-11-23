import { SPORT_IDS, SPORTS, type SportId } from "@/lib/sports";
import { formatDay, fromKzInputs, kzParts, kzStartOfDay } from "@/lib/time";
import { LEVELS, type SkillLevel } from "@/lib/types";

export const DAY_PRESETS = [
  { id: "any", label: "Любой день" },
  { id: "today", label: "Сегодня" },
  { id: "tomorrow", label: "Завтра" },
  { id: "weekend", label: "Выходные" },
  { id: "week", label: "Неделя" },
] as const;

export const TIMES_OF_DAY = [
  { id: "morning", label: "Утро", hint: "6–12", from: 6, to: 12 },
  { id: "day", label: "День", hint: "12–17", from: 12, to: 17 },
  { id: "evening", label: "Вечер", hint: "17–23", from: 17, to: 24 },
] as const;
export type TimeOfDay = (typeof TIMES_OF_DAY)[number]["id"];

export const DISTANCES = [2, 5, 10] as const;
export type Distance = (typeof DISTANCES)[number];

export interface HourRange {
  /** Час начала, 0–23 */
  from: number;
  /** Час окончания (не включительно), 1–24 */
  to: number;
}

export interface LobbyFilters {
  city: number | null;
  /** any | today | tomorrow | weekend | week | YYYY-MM-DD | YYYY-MM-DD_YYYY-MM-DD */
  day: string;
  sports: SportId[];
  times: TimeOfDay[];
  /** Точный интервал часов (из умного поиска), например 18–21 */
  hours: HourRange | null;
  dist: Distance | null;
  level: SkillLevel | null;
  /** Максимум игроков в игре всего */
  maxp: number | null;
  /** Минимум свободных мест */
  free: number | null;
  /** Ключевые слова: влияют на сортировку, не отсекают игры */
  kw: string[];
  /** Простой текстовый поиск по описанию и площадке */
  q: string;
  /** Исходный текст умного поиска (для подписи «Вы искали…») */
  ai: string;
}

export type SearchMode = "map" | "list" | "swipe";

export const EMPTY_FILTERS: LobbyFilters = {
  city: null,
  day: "any",
  sports: [],
  times: [],
  hours: null,
  dist: null,
  level: null,
  maxp: null,
  free: null,
  kw: [],
  q: "",
  ai: "",
};

type RawParams = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const list = (v: string | string[] | undefined) =>
  one(v)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && fromKzInputs(s, "00:00") !== null;
const isDateRange = (s: string) => {
  const [a, b] = s.split("_");
  return Boolean(a && b && isDate(a) && isDate(b) && a <= b);
};

const intIn = (v: string, min: number, max: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
};

export function parseHours(s: string): HourRange | null {
  const m = /^(\d{1,2})-(\d{1,2})$/.exec(s);
  if (!m) return null;
  const from = Number(m[1]);
  const to = Number(m[2]);
  return from >= 0 && from <= 23 && to > from && to <= 24 ? { from, to } : null;
}

export function parseFilters(params: RawParams): LobbyFilters {
  const day = one(params.day);
  const level = one(params.level);
  const dist = Number(one(params.dist));
  return {
    city: intIn(one(params.city), 1, 9999),
    day: DAY_PRESETS.some((d) => d.id === day) || isDate(day) || isDateRange(day) ? day : "any",
    sports: list(params.sports).filter((s): s is SportId => (SPORT_IDS as readonly string[]).includes(s)),
    times: list(params.times).filter((t): t is TimeOfDay => TIMES_OF_DAY.some((x) => x.id === t)),
    hours: parseHours(one(params.hours)),
    dist: (DISTANCES as readonly number[]).includes(dist) ? (dist as Distance) : null,
    level: LEVELS.some((l) => l.id === level) ? (level as SkillLevel) : null,
    maxp: intIn(one(params.maxp), 2, 100),
    free: intIn(one(params.free), 1, 50),
    kw: list(params.kw)
      .map((k) => k.slice(0, 30))
      .slice(0, 5),
    q: one(params.q).trim().slice(0, 100),
    ai: one(params.ai).trim().slice(0, 200),
  };
}

export function parseMode(params: RawParams): SearchMode {
  const mode = one(params.mode);
  // По умолчанию поиск открывается картой города
  return mode === "swipe" || mode === "list" ? mode : "map";
}

/** Фильтры → строка запроса (без пустых значений). */
export function filtersToQuery(f: LobbyFilters, mode?: SearchMode) {
  const p = new URLSearchParams();
  if (f.ai) p.set("ai", f.ai);
  if (f.q) p.set("q", f.q);
  if (f.city) p.set("city", String(f.city));
  if (f.day !== "any") p.set("day", f.day);
  if (f.sports.length) p.set("sports", f.sports.join(","));
  if (f.times.length) p.set("times", f.times.join(","));
  if (f.hours) p.set("hours", `${f.hours.from}-${f.hours.to}`);
  if (f.dist) p.set("dist", String(f.dist));
  if (f.level) p.set("level", f.level);
  if (f.maxp) p.set("maxp", String(f.maxp));
  if (f.free) p.set("free", String(f.free));
  if (f.kw.length) p.set("kw", f.kw.join(","));
  if (mode === "swipe" || mode === "list") p.set("mode", mode);
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** Сколько фильтров включено (без города и текста) — для значка на кнопке. */
export function countActiveFilters(f: LobbyFilters) {
  return (
    (f.day !== "any" ? 1 : 0) +
    f.sports.length +
    f.times.length +
    (f.hours ? 1 : 0) +
    (f.dist ? 1 : 0) +
    (f.level ? 1 : 0) +
    (f.maxp ? 1 : 0) +
    (f.free ? 1 : 0)
  );
}

/** Интервал дат (UTC) для фильтра по дню, по времени Казахстана. */
export function dayRange(day: string, now: Date = new Date()): { from: Date; to: Date } {
  const maxTo = new Date(now.getTime() + 60 * 86_400_000);
  const clampFrom = (d: Date) => (d > now ? d : now);
  switch (day) {
    case "today":
      return { from: now, to: kzStartOfDay(1, now) };
    case "tomorrow":
      return { from: kzStartOfDay(1, now), to: kzStartOfDay(2, now) };
    case "week":
      return { from: now, to: kzStartOfDay(7, now) };
    case "weekend": {
      const w = kzParts(now).weekday; // 0 — воскресенье, 6 — суббота
      if (w === 6) return { from: now, to: kzStartOfDay(2, now) };
      if (w === 0) return { from: now, to: kzStartOfDay(1, now) };
      return { from: kzStartOfDay(6 - w, now), to: kzStartOfDay(8 - w, now) };
    }
    default: {
      if (isDate(day)) {
        const start = fromKzInputs(day, "00:00")!;
        return { from: clampFrom(start), to: new Date(start.getTime() + 86_400_000) };
      }
      if (isDateRange(day)) {
        const [a, b] = day.split("_");
        const start = fromKzInputs(a, "00:00")!;
        const end = new Date(fromKzInputs(b, "00:00")!.getTime() + 86_400_000);
        return { from: clampFrom(start), to: end < maxTo ? end : maxTo };
      }
      return { from: now, to: maxTo };
    }
  }
}

/** Подходит ли время начала под выбранные части дня и интервал часов. */
export function matchesTime(startTime: string, f: Pick<LobbyFilters, "times" | "hours">) {
  const h = kzParts(startTime).hours;
  if (f.hours && (h < f.hours.from || h >= f.hours.to)) return false;
  if (f.times.length === 0) return true;
  return f.times.some((t) => {
    const r = TIMES_OF_DAY.find((x) => x.id === t)!;
    return h >= r.from && h < r.to;
  });
}

export function dayLabel(day: string) {
  const preset = DAY_PRESETS.find((d) => d.id === day);
  if (preset) return preset.label;
  if (isDate(day)) return formatDay(fromKzInputs(day, "12:00")!);
  if (isDateRange(day)) {
    const [a, b] = day.split("_");
    return `${formatDay(fromKzInputs(a, "12:00")!)} – ${formatDay(fromKzInputs(b, "12:00")!)}`;
  }
  return "Любой день";
}

const hoursLabel = (h: HourRange) => `${String(h.from).padStart(2, "0")}:00–${String(h.to).padStart(2, "0")}:00`;

/** Чипы активных фильтров: подпись + фильтры без этого значения. */
export function filterChips(f: LobbyFilters): { key: string; label: string; without: LobbyFilters }[] {
  const chips: { key: string; label: string; without: LobbyFilters }[] = [];
  if (f.q) chips.push({ key: "q", label: `«${f.q}»`, without: { ...f, q: "" } });
  for (const s of f.sports) {
    chips.push({
      key: `s-${s}`,
      label: SPORTS[s].label,
      without: { ...f, sports: f.sports.filter((x) => x !== s) },
    });
  }
  if (f.day !== "any") chips.push({ key: "day", label: dayLabel(f.day), without: { ...f, day: "any" } });
  for (const t of f.times) {
    const r = TIMES_OF_DAY.find((x) => x.id === t)!;
    chips.push({ key: `t-${t}`, label: r.label, without: { ...f, times: f.times.filter((x) => x !== t) } });
  }
  if (f.hours) chips.push({ key: "hours", label: hoursLabel(f.hours), without: { ...f, hours: null } });
  if (f.maxp) chips.push({ key: "maxp", label: `До ${f.maxp} игроков`, without: { ...f, maxp: null } });
  if (f.free) chips.push({ key: "free", label: `Свободно от ${f.free}`, without: { ...f, free: null } });
  if (f.dist) chips.push({ key: "dist", label: `До ${f.dist} км`, without: { ...f, dist: null } });
  if (f.level) {
    chips.push({ key: "level", label: LEVELS.find((l) => l.id === f.level)!.label, without: { ...f, level: null } });
  }
  for (const k of f.kw) {
    chips.push({ key: `kw-${k}`, label: `#${k}`, without: { ...f, kw: f.kw.filter((x) => x !== k) } });
  }
  return chips;
}
