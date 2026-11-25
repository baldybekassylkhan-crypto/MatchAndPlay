/**
 * Погода для игр на улице. Прогноз — Open-Meteo (бесплатно, без ключа).
 * Оценка прогноза — чистая функция, чтобы её можно было проверить тестами.
 */

export interface HourForecast {
  /** Начало часа, ISO в UTC */
  time: string;
  temp: number;
  precipProb: number;
  precipMm: number;
  windKmh: number;
  code: number;
}

export type WeatherKind = "clear" | "cloudy" | "fog" | "drizzle" | "rain" | "snow" | "storm";

export interface WeatherSummary {
  kind: WeatherKind;
  tempMin: number;
  tempMax: number;
  precipProb: number;
  windMs: number;
  /** Плохая погода для игры на улице */
  bad: boolean;
  /** Причины предупреждения: rain | snow | storm | wind | cold | heat */
  reasons: WeatherReason[];
}

export type WeatherReason = "rain" | "snow" | "storm" | "wind" | "cold" | "heat";

export const WEATHER_RULES = {
  precipProb: 60, // %
  precipMm: 0.5, // мм за час
  windKmh: 40, // ≈ 11 м/с
  coldC: -20,
  heatC: 35,
};

export function codeKind(code: number): WeatherKind {
  if (code >= 95) return "storm";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if (code >= 51 && code <= 57) return "drizzle";
  if (code === 45 || code === 48) return "fog";
  if (code >= 2) return "cloudy";
  return "clear";
}

const KIND_ORDER: WeatherKind[] = ["clear", "cloudy", "fog", "drizzle", "rain", "snow", "storm"];

/** Сводка по часам игры (от начала до конца). */
export function assessWeather(hours: HourForecast[], startIso: string, durationMin: number): WeatherSummary | null {
  const start = new Date(startIso).getTime();
  const end = start + durationMin * 60_000;
  const slot = hours.filter((h) => {
    const t = new Date(h.time).getTime();
    return t + 3_600_000 > start && t < end;
  });
  if (!slot.length) return null;

  const reasons = new Set<WeatherReason>();
  let kind: WeatherKind = "clear";
  for (const h of slot) {
    const k = codeKind(h.code);
    if (KIND_ORDER.indexOf(k) > KIND_ORDER.indexOf(kind)) kind = k;
    const wet = h.precipProb >= WEATHER_RULES.precipProb || h.precipMm >= WEATHER_RULES.precipMm;
    if (k === "storm") reasons.add("storm");
    else if (k === "snow" && wet) reasons.add("snow");
    else if (wet && (k === "rain" || k === "drizzle" || h.precipMm >= WEATHER_RULES.precipMm)) reasons.add(h.temp <= 0 ? "snow" : "rain");
    if (h.windKmh >= WEATHER_RULES.windKmh) reasons.add("wind");
    if (h.temp <= WEATHER_RULES.coldC) reasons.add("cold");
    if (h.temp >= WEATHER_RULES.heatC) reasons.add("heat");
  }
  const temps = slot.map((h) => h.temp);
  return {
    kind,
    tempMin: Math.round(Math.min(...temps)),
    tempMax: Math.round(Math.max(...temps)),
    precipProb: Math.max(...slot.map((h) => h.precipProb)),
    windMs: Math.round(Math.max(...slot.map((h) => h.windKmh)) / 3.6),
    bad: reasons.size > 0,
    reasons: [...reasons],
  };
}

const REASON_TEXT: Record<WeatherReason, string> = {
  rain: "дождь",
  snow: "снег",
  storm: "гроза",
  wind: "сильный ветер",
  cold: "сильный мороз",
  heat: "жара",
};

export const KIND_LABEL: Record<WeatherKind, string> = {
  clear: "Ясно",
  cloudy: "Облачно",
  fog: "Туман",
  drizzle: "Морось",
  rain: "Дождь",
  snow: "Снег",
  storm: "Гроза",
};

export function formatTemp(w: Pick<WeatherSummary, "tempMin" | "tempMax">) {
  const t = (n: number) => `${n > 0 ? "+" : ""}${n}°`;
  return w.tempMin === w.tempMax ? t(w.tempMin) : `${t(w.tempMin)}…${t(w.tempMax)}`;
}

/** «дождь (вероятность 80%), сильный ветер 12 м/с, +8°» */
export function describeWeather(w: Pick<WeatherSummary, "reasons" | "precipProb" | "windMs" | "tempMin" | "tempMax">) {
  const parts = w.reasons.map((r) => {
    if (r === "rain" || r === "snow") return `${REASON_TEXT[r]} (вероятность ${w.precipProb}%)`;
    if (r === "wind") return `${REASON_TEXT[r]} ${w.windMs} м/с`;
    return REASON_TEXT[r];
  });
  return [...parts, formatTemp(w)].join(", ");
}

/** Прогноз по часам из Open-Meteo. Кэшируется Next.js на 30 минут. */
export async function fetchHourly(lat: number, lng: number): Promise<HourForecast[] | null> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}` +
    "&hourly=temperature_2m,precipitation_probability,precipitation,wind_speed_10m,weather_code" +
    "&timezone=GMT&forecast_days=16&timeformat=unixtime";
  try {
    const res = await fetch(url, { next: { revalidate: 1800 }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      hourly?: {
        time: number[];
        temperature_2m: number[];
        precipitation_probability: (number | null)[];
        precipitation: (number | null)[];
        wind_speed_10m: number[];
        weather_code: number[];
      };
    };
    const h = data.hourly;
    if (!h?.time?.length) return null;
    return h.time.map((t, i) => ({
      time: new Date(t * 1000).toISOString(),
      temp: h.temperature_2m[i] ?? 0,
      precipProb: h.precipitation_probability[i] ?? 0,
      precipMm: h.precipitation[i] ?? 0,
      windKmh: h.wind_speed_10m[i] ?? 0,
      code: h.weather_code[i] ?? 0,
    }));
  } catch {
    return null;
  }
}

export async function getGameWeather(lat: number, lng: number, startIso: string, durationMin: number) {
  const start = new Date(startIso).getTime();
  // Прогноз есть на 16 дней вперёд; прошедшие игры не показываем
  if (start + durationMin * 60_000 < Date.now() || start > Date.now() + 15 * 86_400_000) return null;
  const hours = await fetchHourly(lat, lng);
  return hours ? assessWeather(hours, startIso, durationMin) : null;
}
