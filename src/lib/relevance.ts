import { fromKzInputs, formatShortDayTime, plural, toKzInputs } from "@/lib/time";
import { isDate, type LobbyFilters } from "@/lib/filters";
import { lobbySlots, type LobbyWithMeta } from "@/lib/types";

const lower = (s: string) => s.toLowerCase().replace(/ё/g, "е");

function keywordHits(lobby: LobbyWithMeta, kw: string[]) {
  if (!kw.length) return [];
  const hay = lower(`${lobby.description} ${lobby.location_name}`);
  // Сравниваем по основе слова, чтобы «дружеская» находила «дружеский»
  return kw.filter((k) => hay.includes(lower(k).slice(0, Math.max(4, k.length - 2))));
}

/** Чем выше, тем лучше подходит. */
export function relevanceScore(lobby: LobbyWithMeta, f: LobbyFilters) {
  const { free } = lobbySlots(lobby);
  let score = keywordHits(lobby, f.kw).length * 3;
  if (lobby.status === "active") score += 2;
  if (f.level && lobby.level === f.level) score += 1;
  if (f.free && free >= f.free) score += 1;
  return score;
}

export function rankLobbies(lobbies: LobbyWithMeta[], f: LobbyFilters) {
  return [...lobbies].sort(
    (a, b) => relevanceScore(b, f) - relevanceScore(a, f) || a.start_time.localeCompare(b.start_time),
  );
}

/** Короткое объяснение, почему игра подходит: «Сб 19:00 · 8 игроков · 2 места». */
export function matchReason(lobby: LobbyWithMeta, f: LobbyFilters) {
  const { total, free } = lobbySlots(lobby);
  const parts = [
    formatShortDayTime(lobby.start_time),
    `${total} ${plural(total, ["игрок", "игрока", "игроков"])}`,
    free > 0 ? `${free} ${plural(free, ["место", "места", "мест"])}` : "мест нет",
  ];
  const hits = keywordHits(lobby, f.kw);
  if (hits.length) parts.push(hits.map((h) => `#${h}`).join(" "));
  return parts.join(" · ");
}

const shiftDate = (date: string, days: number) => {
  const d = fromKzInputs(date, "12:00")!;
  return toKzInputs(new Date(d.getTime() + days * 86_400_000)).date;
};

/** Смягчённые условия для «Похожих вариантов»: ±2 часа, ±1 день, без ограничения по числу игроков. */
export function relaxFilters(f: LobbyFilters): LobbyFilters | null {
  const today = toKzInputs(new Date()).date;
  const clamp = (d: string) => (d < today ? today : d);

  let day = f.day;
  if (isDate(f.day)) day = `${clamp(shiftDate(f.day, -1))}_${shiftDate(f.day, 1)}`;
  else if (f.day.includes("_")) {
    const [a, b] = f.day.split("_");
    day = `${clamp(shiftDate(a, -1))}_${shiftDate(b, 1)}`;
  } else if (f.day === "today") day = `${today}_${shiftDate(today, 1)}`;
  else if (f.day === "tomorrow") day = `${today}_${shiftDate(today, 2)}`;
  else if (f.day === "weekend") day = "week";

  const relaxed: LobbyFilters = {
    ...f,
    day,
    times: [],
    hours: f.hours ? { from: Math.max(0, f.hours.from - 2), to: Math.min(24, f.hours.to + 2) } : null,
    maxp: null,
    free: f.free ? 1 : null,
    level: null,
  };

  const changed =
    relaxed.day !== f.day ||
    f.times.length > 0 ||
    f.hours !== null ||
    f.maxp !== null ||
    (f.free ?? 0) > 1 ||
    f.level !== null;
  return changed ? relaxed : null;
}
