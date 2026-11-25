import { createClient } from "@/lib/supabase/server";
import { KZ_OFFSET_MIN } from "@/lib/time";

/** Рейтинг пока только для этих видов спорта. */
export const RANKED_SPORTS = ["football", "basketball"] as const;
export type RankedSport = (typeof RANKED_SPORTS)[number];

export interface CrewRankRow {
  rank: number;
  crew_id: string;
  name: string;
  member_count: number;
  is_open: boolean;
  points: number;
  tournaments: number;
  wins: number;
  titles: number;
  prev_rank: number | null;
}

const MONTHS = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];
const MONTHS_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

/** Текущий месяц по времени Казахстана: «2026-11». */
export function currentKzMonth(now: Date = new Date()) {
  const kz = new Date(now.getTime() + KZ_OFFSET_MIN * 60_000);
  return `${kz.getUTCFullYear()}-${String(kz.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Последние n месяцев, начиная с текущего. */
export function recentMonths(n = 6, now: Date = new Date()) {
  const [y, m] = currentKzMonth(now).split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

export function monthLabel(month: string, now: Date = new Date()) {
  const [y, m] = month.split("-").map(Number);
  const name = MONTHS[m - 1] ?? "";
  const label = name.charAt(0).toUpperCase() + name.slice(1);
  return y === Number(currentKzMonth(now).slice(0, 4)) ? label : `${label} ${y}`;
}

/** Сколько дней до обновления рейтинга (1-е число следующего месяца, 00:00 по Казахстану). */
export function daysUntilReset(now: Date = new Date()) {
  const [y, m] = currentKzMonth(now).split("-").map(Number);
  const reset = Date.UTC(y, m, 1) - KZ_OFFSET_MIN * 60_000;
  return Math.max(1, Math.ceil((reset - now.getTime()) / 86_400_000));
}

export function resetDateLabel(now: Date = new Date()) {
  const [, m] = currentKzMonth(now).split("-").map(Number);
  return `1 ${MONTHS_GEN[m % 12]}`;
}

export function isMonth(v: string | undefined): v is string {
  return Boolean(v && /^\d{4}-(0[1-9]|1[0-2])$/.test(v));
}

export async function getCrewRanking(cityId: number, sport: RankedSport, month?: string): Promise<CrewRankRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_crew_ranking", {
    p_city_id: cityId,
    p_sport: sport,
    p_month: month ? `${month}-01` : null,
  });
  return (data as CrewRankRow[] | null) ?? [];
}

/** Место команды в рейтинге её города за текущий месяц. */
export async function getCrewPlace(cityId: number, sport: string, crewId: string) {
  if (!(RANKED_SPORTS as readonly string[]).includes(sport)) return null;
  const rows = await getCrewRanking(cityId, sport as RankedSport);
  const row = rows.find((r) => r.crew_id === crewId);
  return row ? { ...row, total: rows.length } : null;
}
