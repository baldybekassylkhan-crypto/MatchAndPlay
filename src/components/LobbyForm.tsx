"use client";

import clsx from "clsx";
import { Loader2, MapPin, X } from "lucide-react";
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
}: {
  cities: City[];
  defaultCityId: number;
  defaultSport?: SportId;
  lobby?: Lobby;
  /** Игра собирается с площадки на карте: место и точка уже заполнены */
  venue?: VenuePrefill | null;
}) {
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
        <span className="label">Вид спорта</span>
        <SportGrid selected={sport ? [sport] : []} onToggle={setSport} ariaLabel="Вид спорта" />
        <FieldError message={f.sport} />
      </div>

      <div>
        <label className="label" htmlFor="description">
          Описание
        </label>
        <textarea
          id="description"
          name="description"
          className="input h-24 resize-none py-3"
          defaultValue={lobby?.description ?? ""}
          placeholder="Нас 4, нужны ещё 2. Играем дружески, мяч есть."
          maxLength={300}
          required
        />
        <FieldError message={f.description} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <span className="label">Нас уже</span>
          <Stepper name="players_current" value={playersCurrent} onChange={setPlayersCurrent} min={1} max={50} />
          <FieldError message={f.players_current} />
        </div>
        <div>
          <span className="label">Нужно ещё</span>
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
              Дата
            </label>
            <DateTimeInput id="date" name="date" type="date" defaultValue={start.date} required />
          </div>
          <div>
            <label className="label" htmlFor="time">
              Начало
            </label>
            <DateTimeInput id="time" name="time" type="time" step={300} defaultValue={start.time} required />
          </div>
        </div>
        <p className="mt-1.5 text-xs text-muted">Время Казахстана (UTC+5)</p>
        <FieldError message={f.start_time} />
      </div>

      <div>
        <span className="label">Город</span>
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
          Площадка или адрес
        </label>
        <input
          id="location_name"
          name="location_name"
          className="input"
          value={address.place}
          onChange={(e) => address.typePlace(e.target.value)}
          placeholder={address.loading ? "Определяем адрес…" : "Стадион «Динамо», поле №2"}
          maxLength={120}
          required
        />
        <FieldError message={f.location_name} />
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-sm font-medium text-muted">
            <MapPin className="mr-1 inline size-3.5" />
            {point ? "Точка на карте выбрана" : "Нажмите на карту, чтобы отметить место"}
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
        <span className="label">
          Уровень игроков <span className="font-normal">(необязательно)</span>
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
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label" htmlFor="price_kzt">
          Стоимость с человека, ₸ <span className="font-normal">(необязательно)</span>
        </label>
        <input
          id="price_kzt"
          name="price_kzt"
          inputMode="numeric"
          pattern="[0-9 ]*"
          className="input"
          defaultValue={lobby?.price_kzt ?? ""}
          placeholder="Например, 2000 за аренду поля"
        />
        <FieldError message={f.price_kzt} />
      </div>

      {state.error && <p className="rounded-2xl bg-danger/10 p-3 text-sm text-danger">{state.error}</p>}

      <button className="btn-primary w-full" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        {lobby ? "Сохранить изменения" : "Опубликовать игру"}
      </button>
    </form>
  );
}
