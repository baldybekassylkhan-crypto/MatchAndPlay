"use client";

import clsx from "clsx";
import { Loader2, Pencil, Trophy, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { reportMatch } from "@/app/actions/tournaments";
import { groupRounds, pairMatches, roundName, type BracketMatch, type BracketTeam } from "@/lib/bracket";
import { createClient } from "@/lib/supabase/client";

/** Высота одного матча в первом раунде: от неё считается высота всей сетки. */
const SLOT_HEIGHT = 92;

export function TournamentBracket({
  tournamentId,
  matches,
  teams,
  canEdit,
  myTeamId,
  championId,
}: {
  tournamentId: string;
  matches: BracketMatch[];
  teams: BracketTeam[];
  canEdit: boolean;
  myTeamId: string | null;
  championId: string | null;
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const rounds = useMemo(() => groupRounds(matches), [matches]);
  const names = useMemo(() => new Map(teams.map((t) => [t.id, t.name])), [teams]);
  const editing = matches.find((m) => m.id === editingId) ?? null;
  const height = (rounds[0]?.matches.length ?? 1) * SLOT_HEIGHT;

  // Результаты появляются у всех зрителей без обновления страницы
  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout>;
    const channel = supabase
      .channel(`tournament-${tournamentId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "tournament_matches", filter: `tournament_id=eq.${tournamentId}` },
        () => {
          clearTimeout(timer);
          timer = setTimeout(() => router.refresh(), 400);
        },
      )
      .subscribe();
    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [tournamentId, router]);

  const champion = championId ? names.get(championId) : null;

  return (
    <section aria-label="Турнирная сетка">
      <h2 className="mb-2 px-5 font-bold">Сетка чемпионата</h2>
      {champion && (
        <p className="card mx-5 mb-3 flex items-center gap-2 p-3.5 font-semibold">
          <Trophy className="size-5 shrink-0 text-accent" /> <span className="min-w-0 break-words">Чемпион: {champion}</span>
        </p>
      )}
      {canEdit && !champion && <p className="mb-3 px-5 text-sm text-muted">Нажмите на матч, чтобы ввести счёт.</p>}

      <div className="no-scrollbar overflow-x-auto px-5 pb-3" tabIndex={0} aria-label="Сетка, прокрутите в сторону">
        <div className="flex w-max gap-7">
          {rounds.map(({ round, matches: list }, roundIndex) => {
            const last = roundIndex === rounds.length - 1;
            return (
              <div key={round} className="w-44 shrink-0">
                <h3 className="mb-2 truncate text-center text-xs font-bold tracking-wide text-muted uppercase">{roundName(round, rounds.length)}</h3>
                <div className="flex flex-col" style={{ height }}>
                  {pairMatches(list).map((pair) => (
                    <div key={pair[0].id} className="relative flex min-h-0 flex-1 flex-col">
                      {pair.map((m) => (
                        <div key={m.id} className="flex min-h-0 flex-1 items-center">
                          <MatchCard
                            match={m}
                            names={names}
                            myTeamId={myTeamId}
                            editable={canEdit && (m.status === "ready" || m.status === "finished")}
                            onEdit={() => setEditingId(m.id)}
                          />
                        </div>
                      ))}
                      {!last && pair.length === 2 && (
                        <>
                          <span className="pointer-events-none absolute top-1/4 -right-3.5 bottom-1/4 w-3.5 rounded-r-md border-y border-r border-line" aria-hidden />
                          <span className="pointer-events-none absolute top-1/2 -right-7 w-3.5 border-t border-line" aria-hidden />
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {editing && (
        <ScoreSheet
          key={editing.id}
          match={editing}
          tournamentId={tournamentId}
          nameA={names.get(editing.team_a_id ?? "") ?? "Команда A"}
          nameB={names.get(editing.team_b_id ?? "") ?? "Команда B"}
          onClose={() => setEditingId(null)}
        />
      )}
    </section>
  );
}

function MatchCard({
  match: m,
  names,
  myTeamId,
  editable,
  onEdit,
}: {
  match: BracketMatch;
  names: Map<string, string>;
  myTeamId: string | null;
  editable: boolean;
  onEdit: () => void;
}) {
  const nameA = m.team_a_id ? names.get(m.team_a_id) ?? "Команда" : null;
  const nameB = m.team_b_id ? names.get(m.team_b_id) ?? "Команда" : null;
  const body = (
    <>
      <Row name={nameA} score={m.score_a} winner={m.winner_id != null && m.winner_id === m.team_a_id} mine={m.team_a_id === myTeamId && !!myTeamId} bye={m.status === "bye"} />
      <div className="h-px bg-line" />
      <Row name={nameB} score={m.score_b} winner={m.winner_id != null && m.winner_id === m.team_b_id} mine={m.team_b_id === myTeamId && !!myTeamId} bye={m.status === "bye"} />
    </>
  );
  const className = clsx(
    "card block w-full overflow-hidden border text-left text-sm",
    m.status === "ready" ? "border-accent" : "border-transparent",
    m.status === "bye" && "opacity-70",
  );
  if (!editable) return <div className={className}>{body}</div>;
  return (
    <button
      type="button"
      onClick={onEdit}
      className={clsx(className, "active:scale-[0.98]")}
      aria-label={`${m.status === "finished" ? "Исправить счёт" : "Ввести счёт"}: ${nameA} против ${nameB}`}
    >
      {body}
    </button>
  );
}

function Row({ name, score, winner, mine, bye }: { name: string | null; score: number | null; winner: boolean; mine: boolean; bye: boolean }) {
  return (
    <span className={clsx("flex h-8 items-center gap-1.5 px-2.5", winner && "bg-accent/10 font-bold", mine && "text-accent")}>
      <span className={clsx("min-w-0 flex-1 truncate", !name && "text-muted")}>{name ?? (bye ? "Проход" : "Ожидается")}</span>
      {score != null && <span className="shrink-0 font-bold tabular-nums">{score}</span>}
    </span>
  );
}

function ScoreSheet({
  match,
  tournamentId,
  nameA,
  nameB,
  onClose,
}: {
  match: BracketMatch;
  tournamentId: string;
  nameA: string;
  nameB: string;
  onClose: () => void;
}) {
  const [scoreA, setScoreA] = useState(String(match.score_a ?? ""));
  const [scoreB, setScoreB] = useState(String(match.score_b ?? ""));
  const [winner, setWinner] = useState<string | null>(match.winner_id);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const filled = scoreA !== "" && scoreB !== "";
  const tie = filled && Number(scoreA) === Number(scoreB);
  const ready = filled && (!tie || (winner !== null && [match.team_a_id, match.team_b_id].includes(winner)));

  const save = () =>
    startTransition(async () => {
      setError(null);
      const res = await reportMatch(match.id, tournamentId, Number(scoreA), Number(scoreB), tie ? winner : null);
      if (res.ok) onClose();
      else setError(res.error);
    });

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Счёт матча"
        onClick={(e) => e.stopPropagation()}
        className="animate-fade-up w-full max-w-lg space-y-4 rounded-t-3xl bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
      >
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-bold">
            <Pencil className="size-4" /> Счёт матча
          </h2>
          <button type="button" onClick={onClose} className="flex size-10 items-center justify-center" aria-label="Закрыть">
            <X className="size-5" />
          </button>
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
          <ScoreInput label={nameA} value={scoreA} onChange={setScoreA} />
          <span className="pb-3 text-xl font-bold text-muted">:</span>
          <ScoreInput label={nameB} value={scoreB} onChange={setScoreB} />
        </div>
        {tie && (
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-semibold">Ничья. Кто прошёл дальше?</legend>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: match.team_a_id, name: nameA },
                { id: match.team_b_id, name: nameB },
              ].map((team) => (
                <button
                  key={team.id}
                  type="button"
                  aria-pressed={winner === team.id}
                  onClick={() => setWinner(team.id)}
                  className={clsx("min-h-11 truncate rounded-xl border px-3 text-sm font-semibold", winner === team.id ? "border-accent bg-accent/12 text-accent" : "border-transparent bg-surface-2")}
                >
                  {team.name}
                </button>
              ))}
            </div>
          </fieldset>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
        <button type="button" className="btn-primary w-full" disabled={!ready || pending} onClick={save}>
          {pending && <Loader2 className="size-4 animate-spin" />} Сохранить результат
        </button>
      </div>
    </div>
  );
}

function ScoreInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block truncate text-center text-sm font-semibold">{label}</span>
      <input
        className="input h-14 text-center text-2xl font-extrabold tabular-nums"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 3))}
        placeholder="0"
      />
    </label>
  );
}
