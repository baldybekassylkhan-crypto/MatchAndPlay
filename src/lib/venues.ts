import { SPORT_IDS, type SportId } from "@/lib/sports";

export type VenueKind = "stadium" | "football" | "basketball" | "tennis" | "gym" | "ice_rink";

/** Площадка из OpenStreetMap (файлы public/venues собирает scripts/fetch-venues.mjs). */
export interface Venue {
  id: string;
  k: VenueKind;
  /** Название, если оно есть в данных */
  n: string;
  /** Улица и дом */
  a: string;
  lat: number;
  lng: number;
}

export const VENUE_KINDS: Record<VenueKind, { label: string; color: string; sport: SportId | null }> = {
  stadium: { label: "Стадион", color: "#5856d6", sport: "football" },
  football: { label: "Футбольное поле", color: "#34c759", sport: "football" },
  basketball: { label: "Баскетбольная площадка", color: "#ff9500", sport: "basketball" },
  tennis: { label: "Теннисный корт", color: "#c7a500", sport: "tennis" },
  // В зале играют в разное, поэтому вид спорта остаётся на выбор игрока
  gym: { label: "Спортзал", color: "#ff2d55", sport: null },
  ice_rink: { label: "Каток", color: "#32ade6", sport: "hockey" },
};

export const VENUE_KIND_IDS = Object.keys(VENUE_KINDS) as VenueKind[];

export const venueTitle = (v: Venue) => v.n || VENUE_KINDS[v.k].label;

/** Текст для поля «Площадка или адрес». */
export function venuePlace(v: Venue) {
  const place = v.n && v.a ? `${v.n}, ${v.a}` : v.n || (v.a ? `${VENUE_KINDS[v.k].label}, ${v.a}` : VENUE_KINDS[v.k].label);
  return place.slice(0, 120);
}

export function venueCreateHref(v: Venue, cityId: number) {
  const p = new URLSearchParams({ place: venuePlace(v), lat: String(v.lat), lng: String(v.lng), city: String(cityId) });
  const sport = VENUE_KINDS[v.k].sport;
  if (sport) p.set("sport", sport);
  return `/create/lobby?${p.toString()}`;
}

export interface VenuePrefill {
  sport: SportId | null;
  place: string;
  lat: number;
  lng: number;
  cityId: number | null;
}

/** Параметры приходят из адреса, поэтому проверяем каждое значение. */
export function parseVenuePrefill(
  params: Record<string, string | string[] | undefined>,
  cityIds: number[],
): VenuePrefill | null {
  const one = (key: string) => {
    const v = params[key];
    return (Array.isArray(v) ? v[0] : v) ?? "";
  };
  const place = one("place").replace(/\s+/g, " ").trim().slice(0, 120);
  const latText = one("lat");
  const lngText = one("lng");
  const lat = Number(latText);
  const lng = Number(lngText);
  if (place.length < 2 || !latText || !lngText) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;

  const sport = one("sport");
  const cityId = Number(one("city"));
  return {
    sport: (SPORT_IDS as readonly string[]).includes(sport) ? (sport as SportId) : null,
    place,
    lat,
    lng,
    cityId: cityIds.includes(cityId) ? cityId : null,
  };
}
