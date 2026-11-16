import type { City } from "@/lib/types";

/** Расстояние между двумя точками в километрах (формула гаверсинуса). */
export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function nearestCity(cities: City[], lat: number, lng: number) {
  let best: City | null = null;
  let bestDist = Infinity;
  for (const city of cities) {
    const d = distanceKm(lat, lng, city.lat, city.lng);
    if (d < bestDist) {
      best = city;
      bestDist = d;
    }
  }
  return best ? { city: best, distanceKm: bestDist } : null;
}
