import type { City, LobbyWithMeta } from "@/lib/types";

/** Понедельник, 16 ноября 2026, 14:00 по времени Казахстана (UTC+5). */
export const MONDAY_2PM = new Date("2026-11-16T09:00:00Z");

const city = (id: number, slug: string, name_ru: string, name_kz: string, aliases: string[] = []): City => ({
  id,
  slug,
  name_ru,
  name_kz,
  aliases,
  lat: 0,
  lng: 0,
  sort_order: id,
});

export const CITIES: City[] = [
  city(1, "astana", "Астана", "Астана", ["Нур-Султан", "Целиноград"]),
  city(2, "almaty", "Алматы", "Алматы", ["Алма-Ата"]),
  city(4, "karaganda", "Караганда", "Қарағанды"),
  city(8, "oskemen", "Усть-Каменогорск", "Өскемен", ["Оскемен"]),
  city(13, "oral", "Уральск", "Орал", ["Орал"]),
];

export function lobby(overrides: Partial<LobbyWithMeta> = {}): LobbyWithMeta {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    organizer_id: "00000000-0000-4000-8000-0000000000aa",
    sport: "basketball",
    description: "Дружеская игра, нас 6",
    players_current: 6,
    players_needed: 2,
    accepted_count: 0,
    start_time: "2026-11-21T14:00:00Z", // Сб 19:00 KZ
    duration_min: 90,
    city_id: 1,
    location_name: "Зал «Олимп»",
    lat: null,
    lng: null,
    level: null,
    price_kzt: null,
    status: "active",
    created_at: "2026-11-10T00:00:00Z",
    updated_at: "2026-11-10T00:00:00Z",
    organizer: null,
    city: { name_ru: "Астана" },
    ...overrides,
  };
}
