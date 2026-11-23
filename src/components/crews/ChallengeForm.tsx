"use client";

import { Loader2, Swords } from "lucide-react";
import { useActionState } from "react";
import { createChallenge, type CrewFormState } from "@/app/actions/crews";
import { DateTimeInput } from "@/components/ui/DateTimeInput";
import type { Crew } from "@/lib/crews";

const initial: CrewFormState = { error: null };

export function ChallengeForm({ target, myCrews, minDate }: { target: Crew; myCrews: Crew[]; minDate: string }) {
  const [state, action, pending] = useActionState(createChallenge, initial);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="to_crew" value={target.id} />
      <Field label="Ваша команда" error={state.fields?.from_crew}>
        <select name="from_crew" className="input" defaultValue={myCrews[0]?.id}>
          {myCrews.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Дата" error={state.fields?.start}>
          <DateTimeInput type="date" name="date" min={minDate} required />
        </Field>
        <Field label="Время">
          <DateTimeInput type="time" name="time" required />
        </Field>
      </div>
      <Field label="Площадка" error={state.fields?.location}>
        <input name="location" className="input" maxLength={120} required placeholder="Стадион, зал или адрес" />
      </Field>
      <Field label="Игроков в каждой команде" error={state.fields?.team_size}>
        <input type="number" name="team_size" className="input" min={1} max={25} defaultValue={5} required inputMode="numeric" />
      </Field>
      <Field label="Сообщение" error={state.fields?.message}>
        <textarea name="message" className="input h-20 resize-none py-3" maxLength={200} placeholder="Необязательно" />
      </Field>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      <button className="btn-primary w-full" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Swords className="size-4" />} Бросить вызов
      </button>
    </form>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      {children}
      {error && <span className="mt-1 block text-sm text-danger">{error}</span>}
    </label>
  );
}
