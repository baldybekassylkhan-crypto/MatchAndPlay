import { NextResponse, type NextRequest } from "next/server";
import { formatAddress, type ReverseGeocodeResult } from "@/lib/address";
import { createClient } from "@/lib/supabase/server";

// Границы Казахстана с запасом: чужие координаты сервис адресов не получает
const inKazakhstan = (lat: number, lng: number) => lat >= 40 && lat <= 56 && lng >= 46 && lng <= 88;

/** Адрес точки на карте. Запрос идёт с сервера и содержит только координаты. */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ address: null }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  if (!params.get("lat") || !params.get("lng") || !inKazakhstan(lat, lng)) {
    return NextResponse.json({ address: null }, { status: 400 });
  }

  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.search = new URLSearchParams({
    format: "jsonv2",
    // Около 10 метров: одинаковые точки берутся из кэша, лишних запросов нет
    lat: lat.toFixed(4),
    lon: lng.toFixed(4),
    zoom: "18",
    addressdetails: "1",
    "accept-language": "ru",
  }).toString();

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "map-address-lookup/1.0" },
      signal: AbortSignal.timeout(5000),
      next: { revalidate: 60 * 60 * 24 * 7 },
    });
    if (!res.ok) return NextResponse.json({ address: null });
    return NextResponse.json({ address: formatAddress((await res.json()) as ReverseGeocodeResult) });
  } catch {
    return NextResponse.json({ address: null });
  }
}
