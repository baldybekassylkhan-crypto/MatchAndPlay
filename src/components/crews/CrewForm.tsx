"use client";

import { Loader2 } from "lucide-react";
import { useActionState } from "react";
import { createCrew, type CrewFormState } from "@/app/actions/crews";
import { SPORT_IDS, SPORTS, type SportId } from "@/lib/sports";
import type { City } from "@/lib/types";

const initial: CrewFormState = { error: null };

export function CrewForm({ cities, cityId, sport }: { cities: City[]; cityId: number; sport: SportId }) {
  const [state, action, pending] = useActionState(createCrew, initial);

  return (
    <form action={action} className="space-y-4">
      <Field label="Название" error={state.fields?.name}>
        <input name="name" className="input" maxLength={30} required placeholder="Например, Алматы Юнайтед" />
      </Field>
      <Field label="О команде" error={state.fields?.description}>
        <textarea name="description" className="input h-24 resize-none py-3" maxLength={200} placeholder="Когда и где играете, кого ищете" />
      </Field>
      <Field label="Вид спорта" error={state.fields?.sport}>
        <select name="sport" className="input" defaultValue={sport}>
          {SPORT_IDS.map((id) => (
            <option key={id} value={id}>
              {SPORTS[id].label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Город" error={state.fields?.city_id}>
        <select name="city_id" className="input" defaultValue={cityId}>
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name_ru}
            </option>
          ))}
        </select>
      </Field>
      <fieldset className="space-y-2">
        <legend className="mb-1.5 text-sm font-semibold">Кто может вступить</legend>
        <label className="flex items-center gap-3 rounded-2xl border border-line px-4 py-3 text-sm">
          <input type="radio" name="is_open" value="open" defaultChecked /> Любой игрок
        </label>
        <label className="flex items-center gap-3 rounded-2xl border border-line px-4 py-3 text-sm">
          <input type="radio" name="is_open" value="closed" /> Только по заявке, вы одобряете
        </label>
      </fieldset>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      <button className="btn-primary w-full" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" />} Создать команду
      </button>
    </form>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      {children}
      {error && <span className="mt-1 block text-sm text-danger">{error}</span>}
    </label>
  );
}
