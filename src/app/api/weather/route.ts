import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getGameWeather } from "@/lib/weather";

/**
 * Вызывается базой (pg_cron → pg_net) каждые 15 минут с заголовком x-push-secret.
 * Проверяет прогноз для игр на улице, которые начнутся примерно через 3 часа,
 * и при дожде, снеге, грозе, сильном ветре или экстремальной температуре предупреждает участников.
 */
export const runtime = "nodejs";

const SECRET = process.env.PUSH_WEBHOOK_SECRET ?? "";

function secretOk(given: string | null) {
  if (!SECRET || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(SECRET);
  return a.length === b.length && timingSafeEqual(a, b);
}

interface Row {
  id: string;
  lat: number | null;
  lng: number | null;
  start_time: string;
  duration_min: number;
  city: { lat: number; lng: number } | null;
  reminders: { kind: string }[];
}

export async function POST(request: Request) {
  if (!secretOk(request.headers.get("x-push-secret"))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "service_role_not_configured" }, { status: 503 });

  const now = Date.now();
  const { data } = await admin
    .from("lobbies")
    .select("id, lat, lng, start_time, duration_min, city:cities(lat, lng), reminders:lobby_reminders(kind)")
    .eq("is_outdoor", true)
    .in("status", ["active", "full"])
    .gt("start_time", new Date(now).toISOString())
    .lte("start_time", new Date(now + 3.5 * 3_600_000).toISOString())
    .limit(200);

  const rows = ((data as Row[] | null) ?? []).filter((l) => !l.reminders.some((r) => r.kind === "weather"));
  let alerted = 0;
  for (const l of rows) {
    const lat = l.lat ?? l.city?.lat;
    const lng = l.lng ?? l.city?.lng;
    if (lat == null || lng == null) continue;
    const w = await getGameWeather(lat, lng, l.start_time, l.duration_min);
    if (!w) continue; // прогноз недоступен — попробуем в следующий раз
    const { data: sent } = await admin.rpc("send_weather_alert", {
      p_lobby_id: l.id,
      p_forecast: w.bad
        ? { kind: w.kind, reasons: w.reasons, precip_prob: w.precipProb, wind_ms: w.windMs, temp_min: w.tempMin, temp_max: w.tempMax }
        : null,
    });
    if (sent) alerted++;
  }
  return NextResponse.json({ checked: rows.length, alerted });
}
