"use client";

import { Loader2, Play, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { cancelTournament, registerTeam, startTournament, withdrawTeam } from "@/app/actions/tournaments";

type Result = { ok: boolean; error?: string };

function useAction() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<Result>, done?: () => void) =>
    startTransition(async () => {
      setError(null);
      const res = await fn();
      if (res.ok) done?.();
      else setError(res.error ?? "Ошибка");
    });
  return { error, pending, run };
}

export function RegisterTeamForm({
  tournamentId,
  crews,
  teamSize,
}: {
  tournamentId: string;
  crews: { id: string; name: string }[];
  teamSize: number;
}) {
  const [name, setName] = useState("");
  const [crewId, setCrewId] = useState("");
  const { error, pending, run } = useAction();

  return (
    <form
      className="space-y-3 card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => registerTeam(tournamentId, name, crewId || null));
      }}
    >
      <div>
        <h2 className="font-bold">Записать команду</h2>
        <p className="text-sm text-muted">Вы становитесь капитаном. В команде {teamSize} игроков.</p>
      </div>
      {crews.length > 0 && (
        <select
          className="input"
          aria-label="Моя команда"
          value={crewId}
          onChange={(e) => {
            setCrewId(e.target.value);
            const crew = crews.find((c) => c.id === e.target.value);
            if (crew) setName(crew.name.slice(0, 40));
          }}
        >
          <option value="">Новая команда</option>
          {crews.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}
      <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required placeholder="Название команды" aria-label="Название команды" />
      {error && <p className="text-sm text-danger">{error}</p>}
      <button className="btn-primary w-full" disabled={pending || name.trim().length < 2}>
        {pending && <Loader2 className="size-4 animate-spin" />} Записаться
      </button>
    </form>
  );
}

export function WithdrawTeamButton({ teamId, tournamentId, name }: { teamId: string; tournamentId: string; name: string }) {
  const [confirming, setConfirming] = useState(false);
  const { error, pending, run } = useAction();
  if (error) return <span className="pr-3 text-xs text-danger">{error}</span>;
  if (confirming) {
    return (
      <span className="flex shrink-0 items-center gap-1 pr-3">
        <button type="button" disabled={pending} onClick={() => run(() => withdrawTeam(teamId, tournamentId))} className="h-9 rounded-xl bg-danger px-3 text-sm font-semibold text-white">
          {pending ? <Loader2 className="size-4 animate-spin" /> : "Снять"}
        </button>
        <button type="button" onClick={() => setConfirming(false)} className="h-9 rounded-xl border border-line px-3 text-sm">
          Нет
        </button>
      </span>
    );
  }
  return (
    <button type="button" onClick={() => setConfirming(true)} className="mr-2 flex size-10 shrink-0 items-center justify-center text-muted" aria-label={`Снять команду ${name}`}>
      <Trash2 className="size-4" />
    </button>
  );
}

export function StartTournamentButton({ tournamentId, teams }: { tournamentId: string; teams: number }) {
  const [confirming, setConfirming] = useState(false);
  const { error, pending, run } = useAction();
  return (
    <div className="space-y-2">
      {confirming ? (
        <div className="animate-fade-up space-y-2 rounded-2xl border border-line p-4">
          <p className="text-sm">Закрыть регистрацию и провести жеребьёвку для {teams} команд? Отменить жеребьёвку будет нельзя.</p>
          <div className="flex gap-2">
            <button type="button" className="btn-primary flex-1" disabled={pending} onClick={() => run(() => startTournament(tournamentId))}>
              {pending && <Loader2 className="size-4 animate-spin" />} Начать
            </button>
            <button type="button" className="btn-secondary flex-1" onClick={() => setConfirming(false)}>
              Назад
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn-primary w-full" disabled={teams < 2} onClick={() => setConfirming(true)}>
          <Play className="size-4" /> {teams < 2 ? "Нужно минимум 2 команды" : "Начать турнир и создать сетку"}
        </button>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}

export function CancelTournamentButton({ tournamentId }: { tournamentId: string }) {
  const [confirming, setConfirming] = useState(false);
  const { error, pending, run } = useAction();
  return (
    <div className="space-y-2">
      {confirming ? (
        <div className="animate-fade-up space-y-2 rounded-2xl border border-line p-4">
          <p className="text-sm">Отменить турнир? Капитаны получат уведомление. Это действие нельзя вернуть.</p>
          <div className="flex gap-2">
            <button type="button" className="btn flex-1 bg-danger text-white" disabled={pending} onClick={() => run(() => cancelTournament(tournamentId))}>
              {pending && <Loader2 className="size-4 animate-spin" />} Да, отменить
            </button>
            <button type="button" className="btn-secondary flex-1" onClick={() => setConfirming(false)}>
              Нет
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn-secondary w-full text-danger" onClick={() => setConfirming(true)}>
          Отменить турнир
        </button>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
