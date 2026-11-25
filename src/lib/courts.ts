import type { Venue } from "@/lib/venues";

export const COURT_ISSUES = {
  hoop: { label: "Сломано кольцо или щит", short: "Кольцо" },
  net: { label: "Нет сетки", short: "Сетка" },
  goal: { label: "Сломаны ворота", short: "Ворота" },
  surface: { label: "Разбито покрытие", short: "Покрытие" },
  lighting: { label: "Не работает освещение", short: "Свет" },
  fence: { label: "Сломан забор", short: "Забор" },
  trash: { label: "Мусор на площадке", short: "Мусор" },
  other: { label: "Другое", short: "Другое" },
} as const;
export type CourtIssue = keyof typeof COURT_ISSUES;
export const COURT_ISSUE_IDS = Object.keys(COURT_ISSUES) as CourtIssue[];

export type CourtReportStatus = "new" | "sent" | "in_progress" | "fixed" | "rejected";
export const OPEN_STATUSES: CourtReportStatus[] = ["new", "sent", "in_progress"];

export const STATUS_INFO: Record<CourtReportStatus, { label: string; tone: "muted" | "warn" | "ok" | "bad" }> = {
  new: { label: "Новое", tone: "muted" },
  sent: { label: "Передано в акимат", tone: "warn" },
  in_progress: { label: "В работе", tone: "warn" },
  fixed: { label: "Исправлено", tone: "ok" },
  rejected: { label: "Отклонено", tone: "bad" },
};

export interface CourtReport {
  id: string;
  venue_id: string;
  city_id: number;
  venue_name: string;
  lat: number;
  lng: number;
  kind: CourtIssue;
  comment: string | null;
  photo_path: string | null;
  status: CourtReportStatus;
  admin_note: string | null;
  votes: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

/** Какие проблемы бывают на площадке этого типа. */
export function issuesFor(kind: Venue["k"]): CourtIssue[] {
  if (kind === "basketball") return ["hoop", "net", "surface", "lighting", "fence", "trash", "other"];
  if (kind === "football" || kind === "stadium") return ["goal", "net", "surface", "lighting", "fence", "trash", "other"];
  if (kind === "tennis") return ["net", "surface", "lighting", "fence", "trash", "other"];
  return ["surface", "lighting", "trash", "other"];
}

const PAID = /манеж|арена|arena|клуб|club|центр|center|fitness|фитнес|комплекс|академ|academy|ск |спорткомплекс|школа футбола|padel|падел/i;

/**
 * Открытая городская площадка: поле, баскетбольная или теннисная площадка из OpenStreetMap
 * без признаков платного клуба или манежа в названии. Это оценка, а не гарантия.
 */
export function isFreeCourt(v: Pick<Venue, "k" | "n">) {
  return (v.k === "football" || v.k === "basketball" || v.k === "tennis") && !PAID.test(v.n ?? "");
}

export function courtReportHref(v: Venue, cityId: number) {
  const p = new URLSearchParams({ venue: v.id, k: v.k, name: (v.n || "").slice(0, 120), a: (v.a || "").slice(0, 120), lat: String(v.lat), lng: String(v.lng), city: String(cityId) });
  return `/courts/report?${p.toString()}`;
}

/** Текст обращения в акимат по списку проблем — для e-Otinish / iKomek 109 или письма. */
export function akimatAppeal(cityName: string, reports: Pick<CourtReport, "venue_name" | "kind" | "comment" | "lat" | "lng" | "votes" | "created_at">[]) {
  const lines = reports.map((r, i) => {
    const map = `https://www.openstreetmap.org/?mlat=${r.lat.toFixed(5)}&mlon=${r.lng.toFixed(5)}#map=18/${r.lat.toFixed(5)}/${r.lng.toFixed(5)}`;
    const date = new Date(r.created_at).toLocaleDateString("ru-RU", { timeZone: "Asia/Almaty" });
    return `${i + 1}. ${r.venue_name} — ${COURT_ISSUES[r.kind].label.toLowerCase()}${r.comment ? ` («${r.comment}»)` : ""}. Сообщили жители: ${r.votes}. С ${date}. Карта: ${map}`;
  });
  return [
    `В акимат города ${cityName}`,
    "",
    `Жители через приложение Match&Play сообщили о проблемах на открытых спортивных площадках города (${reports.length}). Просим проверить и устранить:`,
    "",
    ...lines,
    "",
    "Статус исправления будет виден жителям в приложении. Спасибо!",
  ].join("\n");
}
