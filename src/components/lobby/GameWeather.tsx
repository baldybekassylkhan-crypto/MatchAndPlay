import { getT } from "@/lib/i18n/server";
import clsx from "clsx";
import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, Sun, TriangleAlert, Wind } from "lucide-react";
import { KIND_LABEL, describeWeather, formatTemp, getGameWeather, type WeatherKind } from "@/lib/weather";

const ICONS: Record<WeatherKind, typeof Sun> = {
  clear: Sun,
  cloudy: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  snow: CloudSnow,
  storm: CloudLightning,
};

/** Прогноз на время игры на улице. Ничего не показывает, если прогноза нет. */
export async function GameWeather({ lat, lng, start, duration }: { lat: number; lng: number; start: string; duration: number }) {
  const t = await getT();
  const w = await getGameWeather(lat, lng, start, duration);
  if (!w) return null;
  const Icon = w.bad ? TriangleAlert : ICONS[w.kind];
  return (
    <section
      className={clsx("flex items-center gap-3 rounded-2xl p-4", w.bad ? "bg-danger/10 text-danger" : "bg-surface-2")}
      aria-label={t("Прогноз погоды на время игры")}
    >
      <Icon className="size-6 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          {w.bad ? t("Погода может помешать") : KIND_LABEL[w.kind]} · {formatTemp(w)}
        </p>
        <p className={clsx("text-sm", w.bad ? "" : "text-muted")}>
          {w.bad ? `Ожидается ${describeWeather(w)}` : `Осадки ${w.precipProb}%`}
          {!w.bad && (
            <>
              {" · "}
              <Wind className="inline size-3.5 align-[-2px]" aria-hidden /> {w.windMs} м/с
            </>
          )}
        </p>
      </div>
    </section>
  );
}
