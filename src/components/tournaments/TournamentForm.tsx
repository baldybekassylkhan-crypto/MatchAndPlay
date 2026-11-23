"use client";

import clsx from "clsx";
import { Loader2, MapPin, ShieldCheck, X } from "lucide-react";
import { useActionState, useMemo, useState } from "react";
import { saveTournament, type TournamentFormState } from "@/app/actions/tournaments";
import { MapView, type LatLng } from "@/components/map/Map";
import { SPORT_IDS, SPORTS, type SportId } from "@/lib/sports";
import { toKzInputs } from "@/lib/time";
import type { Tournament } from "@/lib/tournaments";
import type { City } from "@/lib/types";
import { useMapAddress } from "@/lib/use-map-address";

const initial: TournamentFormState = { error: null };
const SIZES = [4, 8, 16, 32];

export function TournamentForm({
  cities,
  cityId,
  sport,
  tournament,
  contact,
}: {
  cities: City[];
  cityId: number;
  sport: SportId;
  tournament?: Tournament;
  contact?: string | null;
}) {
  const [state, action, pending] = useActionState(saveTournament, initial);
  const [size, setSize] = useState(tournament?.max_teams ?? 8);
  const [selectedCity, setSelectedCity] = useState(tournament?.city_id ?? cityId);
  const [point, setPoint] = useState<LatLng | null>(
    tournament?.lat != null && tournament?.lng != null ? { lat: tournament.lat, lng: tournament.lng } : null,
  );
  const dates = useMemo(() => {
    const start = tournament ? new Date(tournament.starts_at) : new Date(Date.now() + 14 * 86_400_000);
    const reg = tournament ? new Date(tournament.registration_ends_at) : new Date(Date.now() + 11 * 86_400_000);
    return { start: toKzInputs(start), reg: toKzInputs(reg) };
  }, [tournament]);
  const address = useMapAddress(tournament?.location_name ?? "");
  const pickPoint = (p: LatLng) => {
    setPoint(p);
    address.lookup(p);
  };
  const removePoint = () => {
    setPoint(null);
    address.clearAuto();
  };
  const f = state.fields ?? {};
  const city = cities.find((c) => c.id === selectedCity);
  const center = point ?? (city ? { lat: city.lat, lng: city.lng } : { lat: 48, lng: 67 });

  return (
    <form action={action} className="space-y-5">
      {tournament && <input type="hidden" name="id" value={tournament.id} />}
      <input type="hidden" name="max_teams" value={size} />
      <input type="hidden" name="lat" value={point?.lat ?? ""} />
      <input type="hidden" name="lng" value={point?.lng ?? ""} />

      <p className="flex items-start gap-2 rounded-2xl bg-surface-2 p-3 text-sm">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" />
        Турнир появится для всех после проверки модератором.
      </p>

      <Field label="Название" error={f.name}>
        <input name="name" className="input" maxLength={60} required defaultValue={tournament?.name} placeholder="Кубок Алматы 2027" />
      </Field>
      <Field label="Описание" error={f.description}>
        <textarea name="description" className="input h-28 resize-none py-3" maxLength={1000} required defaultValue={tournament?.description} placeholder="Для кого турнир, формат игр, что ждёт участников" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Вид спорта" error={f.sport}>
          <select name="sport" className="input" defaultValue={tournament?.sport ?? sport}>
            {SPORT_IDS.map((id) => (
              <option key={id} value={id}>
                {SPORTS[id].label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Город" error={f.city_id}>
          <select
            name="city_id"
            className="input"
            value={selectedCity}
            onChange={(e) => {
              setSelectedCity(Number(e.target.value));
              removePoint();
            }}
          >
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name_ru}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Площадка или адрес" error={f.location_name}>
        <input name="location_name" className="input" maxLength={120} required value={address.place} onChange={(e) => address.typePlace(e.target.value)} placeholder={address.loading ? "Определяем адрес…" : "Стадион, зал или адрес"} />
      </Field>
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-sm font-medium text-muted">
            <MapPin className="mr-1 inline size-3.5" />
            {point ? "Точка на карте выбрана" : "Отметьте место на карте"}
          </span>
          {point && (
            <button type="button" onClick={removePoint} className="flex items-center gap-1 text-sm text-muted">
              <X className="size-3.5" /> Убрать
            </button>
          )}
        </div>
        <div className="h-48 overflow-hidden rounded-2xl border border-line">
          <MapView center={center} marker={point} zoom={point ? 15 : 12} onPick={pickPoint} className="h-full w-full" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Дата начала" error={f.starts_at}>
          <input type="date" name="start_date" className="input" required defaultValue={dates.start.date} />
        </Field>
        <Field label="Время начала">
          <input type="time" name="start_time" className="input" required defaultValue={dates.start.time} />
        </Field>
        <Field label="Регистрация до" error={f.registration_ends_at}>
          <input type="date" name="reg_date" className="input" required defaultValue={dates.reg.date} />
        </Field>
        <Field label="Время">
          <input type="time" name="reg_time" className="input" required defaultValue={dates.reg.time} />
        </Field>
      </div>

      <div>
        <span className="mb-1.5 block text-sm font-semibold">Сетка на выбывание, команд</span>
        <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Размер сетки">
          {SIZES.map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={size === n}
              onClick={() => setSize(n)}
              className={clsx("h-11 rounded-xl border text-[17px] font-semibold", size === n ? "border-accent bg-accent/12 text-accent" : "border-transparent bg-surface-2")}
            >
              {n}
            </button>
          ))}
        </div>
        {f.max_teams && <p className="mt-1 text-sm text-danger">{f.max_teams}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Игроков в команде" error={f.team_size}>
          <input type="number" name="team_size" className="input" min={1} max={25} required inputMode="numeric" defaultValue={tournament?.team_size ?? 5} />
        </Field>
        <Field label="Взнос с команды, ₸" error={f.entry_fee}>
          <input type="number" name="entry_fee" className="input" min={0} inputMode="numeric" defaultValue={tournament?.entry_fee_kzt ?? 0} />
        </Field>
      </div>
      <Field label="Призы (необязательно)" error={f.prize}>
        <input name="prize" className="input" maxLength={200} defaultValue={tournament?.prize ?? ""} placeholder="Кубок и медали" />
      </Field>
      <Field label="Правила (необязательно)" error={f.rules}>
        <textarea name="rules" className="input h-24 resize-none py-3" maxLength={1000} defaultValue={tournament?.rules ?? ""} placeholder="Длительность матчей, замены, что при ничьей" />
      </Field>
      <Field label="Ваш контакт для модератора" error={f.contact} hint="Телефон или Telegram. Другие игроки его не увидят.">
        <input name="contact" className="input" maxLength={100} required defaultValue={contact ?? ""} placeholder="@telegram или +7…" />
      </Field>

      {state.error && <p className="rounded-2xl bg-danger/10 p-3 text-sm text-danger">{state.error}</p>}
      <button className="btn-primary w-full" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" />} Отправить на модерацию
      </button>
    </form>
  );
}

function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
      {error && <span className="mt-1 block text-sm text-danger">{error}</span>}
    </label>
  );
}
