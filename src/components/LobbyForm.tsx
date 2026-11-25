"use client";

import { useT } from "@/components/I18nProvider";
import clsx from "clsx";
import { Building2, Loader2, MapPin, Sun, Venus, X } from "lucide-react";
import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { saveLobby, type LobbyFormState } from "@/app/actions/lobby";
import { CityPicker } from "@/components/CityPicker";
import { MapView, type LatLng } from "@/components/map/Map";
import { Stepper } from "@/components/Stepper";
import { DateTimeInput } from "@/components/ui/DateTimeInput";
import { SportGrid } from "@/components/ui/SportGrid";
import type { SportId } from "@/lib/sports";
import { toKzInputs } from "@/lib/time";
import { LEVELS, type City, type Lobby, type SkillLevel } from "@/lib/types";
import { useMapAddress } from "@/lib/use-map-address";
import type { VenuePrefill } from "@/lib/venues";

const DEFAULT_DURATION_MIN = 90;
const initialState: LobbyFormState = { error: null };

function FieldError({ message }: { message?: string }) {
  return message ? <p className="mt-1.5 text-sm text-danger">{message}</p> : null;
}

/** Ближайшее «круглое» время через 2+ часа — как значение по умолчанию. */
function defaultStart() {
  const d = new Date(Date.now() + 2 * 3_600_000);
  d.setUTCMinutes(d.getUTCMinutes() < 30 ? 30 : 60, 0, 0);
  return toKzInputs(d);
}

export function LobbyForm({
  cities,
  defaultCityId,
  defaultSport,
  lobby,
  venue,
  canWomenOnly = false,
}: {
  /** У организатора в профиле указан женский пол */
  canWomenOnly?: boolean;
  cities: City[];
  defaultCityId: number;
  defaultSport?: SportId;
  lobby?: Lobby;
  /** Игра собирается с площадки на карте: место и точка уже заполнены */
  venue?: VenuePrefill | null;
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(saveLobby, initialState);
  const start = useMemo(() => (lobby ? toKzInputs(lobby.start_time) : defaultStart()), [lobby]);

  const [sport, setSport] = useState<SportId | null>(lobby?.sport ?? defaultSport ?? null);
  const [playersCurrent, setPlayersCurrent] = useState(lobby?.players_current ?? 4);
  const [playersNeeded, setPlayersNeeded] = useState(lobby?.players_needed ?? 2);
  // Длительность в форме не выбирается: новые игры — 1,5 часа, у существующих сохраняется прежняя.
  // Нужна базе, чтобы автоматически завершать прошедшие игры.
  const duration = lobby?.duration_min ?? DEFAULT_DURATION_MIN;
  const [cityId, setCityId] = useState<number>(lobby?.city_id ?? defaultCityId);
  const [point, setPoint] = useState<LatLng | null>(
    lobby?.lat != null && lobby?.lng != null ? { lat: lobby.lat, lng: lobby.lng } : venue ? { lat: venue.lat, lng: venue.lng } : null,
  );
  const [level, setLevel] = useState<SkillLevel | null>(lobby?.level ?? null);
  // Где играем: для игр на улице за 3 часа приходит предупреждение о плохой погоде
  const [womenOnly, setWomenOnly] = useState(lobby?.women_only ?? false);
  const [outdoor, setOutdoor] = useState<boolean | null>(lobby?.is_outdoor ?? null);
  const address = useMapAddress(lobby?.location_name ?? venue?.place ?? "");
  const f = state.fields ?? {};
  const pickPoint = (p: LatLng) => {
    setPoint(p);
    address.lookup(p);
  };
  const removePoint = () => {
    setPoint(null);
    address.clearAuto();
  };

  const city = cities.find((c) => c.id === cityId);
  const mapCenter = point ?? (city ? { lat: city.lat, lng: city.lng } : { lat: 48.0, lng: 67.0 });
  const minAccepted = lobby?.accepted_count ?? 0;

  return (
    <form action={formAction} className="space-y-6">
      {lobby && <input type="hidden" name="lobby_id" value={lobby.id} />}
      <input type="hidden" name="sport" value={sport ?? ""} />
      <input type="hidden" name="duration_min" value={duration} />
      <input type="hidden" name="level" value={level ?? ""} />
      <input type="hidden" name="women_only" value={womenOnly ? "1" : ""} />
      <input type="hidden" name="is_outdoor" value={outdoor === null ? "" : outdoor ? "1" : "0"} />
      <input type="hidden" name="lat" value={point?.lat ?? ""} />
      <input type="hidden" name="lng" value={point?.lng ?? ""} />

      {venue && !lobby && (
        <p className="flex items-start gap-2 rounded-2xl bg-surface-2 p-3 text-sm">
          <MapPin className="mt-0.5 size-4 shrink-0" />
          <span>
            Игра на площадке <b>{venue.place}</b>. Место и точка на карте уже заполнены.
          </span>
        </p>
      )}

      <div>
        <span className="label">{t("Вид спорта")}</span>
        <SportGrid selected={sport ? [sport] : []} onToggle={setSport} ariaLabel={t("Вид спорта")} />
        <FieldError message={f.sport} />
      </div>

      <div>
        <label className="label" htmlFor="description">
          {t("Описание")}
        </label>
        <textarea
          id="description"
          name="description"
          className="input h-24 resize-none py-3"
          defaultValue={lobby?.description ?? ""}
          placeholder={t("Нас 4, нужны ещё 2. Играем дружески, мяч есть.")}
          maxLength={300}
          required
        />
        <FieldError message={f.description} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <span className="label">{t("Нас уже")}</span>
          <Stepper name="players_current" value={playersCurrent} onChange={setPlayersCurrent} min={1} max={50} />
          <FieldError message={f.players_current} />
        </div>
        <div>
          <span className="label">{t("Нужно ещё")}</span>
          <Stepper
            name="players_needed"
            value={playersNeeded}
            onChange={setPlayersNeeded}
            min={Math.max(1, minAccepted)}
            max={50}
          />
          <FieldError message={f.players_needed} />
        </div>
      </div>

      <div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="date">
              {t("Дата")}
            </label>
            <DateTimeInput id="date" name="date" type="date" defaultValue={start.date} required />
          </div>
          <div>
            <label className="label" htmlFor="time">
              {t("Начало")}
            </label>
            <DateTimeInput id="time" name="time" type="time" step={300} defaultValue={start.time} required />
          </div>
        </div>
        <p className="mt-1.5 text-xs text-muted">{t("Время Казахстана (UTC+5)")}</p>
        <FieldError message={f.start_time} />
      </div>

      <div>
        <span className="label">{t("Город")}</span>
        <CityPicker
          cities={cities}
          value={cityId}
          onChange={(id) => {
            setCityId(id);
            removePoint();
          }}
        />
        <FieldError message={f.city_id} />
      </div>

      <div>
        <label className="label" htmlFor="location_name">
          {t("Площадка или адрес")}
        </label>
        <input
          id="location_name"
          name="location_name"
          className="input"
          value={address.place}
          onChange={(e) => address.typePlace(e.target.value)}
          placeholder={address.loading ? t("Определяем адрес…") : t("Стадион «Динамо», поле №2")}
          maxLength={120}
          required
        />
        <FieldError message={f.location_name} />
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-sm font-medium text-muted">
            <MapPin className="mr-1 inline size-3.5" />
            {point ? t("Точка на карте выбрана") : t("Нажмите на карту, чтобы отметить место")}
          </span>
          {point && (
            <button type="button" onClick={removePoint} className="flex items-center gap-1 text-sm text-muted">
              <X className="size-3.5" /> Убрать
            </button>
          )}
        </div>
        <div className="h-56 overflow-hidden rounded-2xl border border-line">
          <MapView center={mapCenter} marker={point} zoom={point ? 15 : 12} onPick={pickPoint} className="h-full w-full" />
        </div>
      </div>

      <div>
        <span className="label">{t("Где играем")}</span>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: true, label: "На улице", icon: Sun },
            { value: false, label: "В зале", icon: Building2 },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              aria-pressed={outdoor === o.value}
              onClick={() => setOutdoor(outdoor === o.value ? null : o.value)}
              className={clsx("chip justify-center gap-1.5", outdoor === o.value && "chip-active")}
            >
              <o.icon className="size-4" aria-hidden /> {o.label}
            </button>
          ))}
        </div>
        {outdoor && <p className="mt-1.5 text-sm text-muted">{t("За 3 часа до начала предупредим игроков, если ожидается дождь, снег или сильный ветер.")}</p>}
      </div>

      <div>
        <button
          type="button"
          role="switch"
          aria-checked={womenOnly}
          disabled={!canWomenOnly && !womenOnly}
          onClick={() => setWomenOnly((v) => !v)}
          className="card flex w-full items-center gap-3 p-3.5 text-left disabled:opacity-60"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#ff2d92]/15 text-[#ff2d92]" aria-hidden>
            <Venus className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{t("Только для девушек")}</span>
            <span className="block text-sm text-muted">{t("Вступить смогут только девушки")}</span>
          </span>
          <span className={clsx("relative h-7 w-12 shrink-0 rounded-full transition", womenOnly ? "bg-[#ff2d92]" : "bg-surface-2")} aria-hidden>
            <span className={clsx("absolute top-0.5 size-6 rounded-full bg-white shadow transition-all", womenOnly ? "left-[22px]" : "left-0.5")} />
          </span>
        </button>
        {!canWomenOnly && !womenOnly && (
          <p className="mt-1.5 text-sm text-muted">
            Доступно, если в <Link href="/profile/edit" className="underline">{t("профиле")}</Link> указан женский пол.
          </p>
        )}
      </div>

      <div>
        <span className="label">
          Уровень игроков <span className="font-normal">{t("(необязательно)")}</span>
        </span>
        <div className="grid grid-cols-3 gap-2">
          {LEVELS.map((l) => (
            <button
              key={l.id}
              type="button"
              aria-pressed={level === l.id}
              onClick={() => setLevel(level === l.id ? null : l.id)}
              className={clsx("chip min-w-0 justify-center truncate px-1.5! text-[14px]!", level === l.id && "chip-active")}
            >
              {t(l.label)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label" htmlFor="price_kzt">
          Стоимость с человека, ₸ <span className="font-normal">{t("(необязательно)")}</span>
        </label>
        <input
          id="price_kzt"
          name="price_kzt"
          inputMode="numeric"
          pattern="[0-9 ]*"
          className="input"
          defaultValue={lobby?.price_kzt ?? ""}
          placeholder={t("Например, 2000 за аренду поля")}
        />
        <FieldError message={f.price_kzt} />
      </div>

      {state.error && <p className="rounded-2xl bg-danger/10 p-3 text-sm text-danger">{state.error}</p>}

      <button className="btn-primary w-full" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        {lobby ? t("Сохранить изменения") : t("Опубликовать игру")}
      </button>
    </form>
  );
}
