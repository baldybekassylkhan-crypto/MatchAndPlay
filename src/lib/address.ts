/** Ответ сервиса адресов OpenStreetMap (только нужные поля). */
export interface ReverseGeocodeResult {
  name?: string | null;
  display_name?: string | null;
  address?: Record<string, string | undefined> | null;
}

const MAX_LENGTH = 120;

/** Короткий адрес для поля формы: название места, улица и дом. */
export function formatAddress(result: ReverseGeocodeResult): string | null {
  const a = result.address ?? {};
  const road = a.road ?? a.pedestrian ?? a.footway ?? a.path ?? null;
  const street = road ? [road, a.house_number].filter(Boolean).join(", ") : null;
  const name = result.name?.trim() || null;
  const place = name && name !== road && name !== a.house_number ? name : null;

  const parts = [place, street].filter(Boolean) as string[];
  if (parts.length === 0) {
    const area = a.neighbourhood ?? a.quarter ?? a.suburb ?? a.city_district ?? a.village ?? a.town ?? a.city;
    if (area) parts.push(area);
    else if (result.display_name) parts.push(result.display_name.split(",").slice(0, 2).join(",").trim());
  }
  const text = parts.join(", ").trim();
  return text ? text.slice(0, MAX_LENGTH) : null;
}
