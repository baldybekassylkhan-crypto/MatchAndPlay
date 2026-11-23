"use client";

import { Clock, Loader2, MapPin, Swords, Users } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { cancelChallenge, respondChallenge } from "@/app/actions/crews";
import type { CrewChallenge } from "@/lib/crews";
import { formatDayTime } from "@/lib/time";

export function ChallengeCard({
  challenge,
  crewId,
  isCaptain,
}: {
  challenge: CrewChallenge;
  crewId: string;
  isCaptain: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const incoming = challenge.to_crew_id === crewId;
  const isPending = challenge.status === "pending";

  const run = (fn: () => Promise<{ ok: boolean; error?: string } | undefined>) =>
    startTransition(async () => {
      setError(null);
      const res = await fn();
      if (res && !res.ok) setError(res.error ?? "Ошибка");
    });

  return (
    <article className="space-y-2 card p-4">
      <p className="flex items-center gap-2 font-bold">
        <Swords className="size-4 shrink-0" />
        <span className="truncate">
          {challenge.from_crew?.name} — {challenge.to_crew?.name}
        </span>
      </p>
      <p className="flex items-center gap-1.5 text-sm text-muted">
        <Clock className="size-3.5 shrink-0" /> {formatDayTime(challenge.start_time)}
      </p>
      <p className="flex items-center gap-1.5 text-sm text-muted">
        <MapPin className="size-3.5 shrink-0" /> <span className="truncate">{challenge.location_name}</span>
      </p>
      <p className="flex items-center gap-1.5 text-sm text-muted">
        <Users className="size-3.5 shrink-0" /> {challenge.team_size} на {challenge.team_size}
      </p>
      {challenge.message && <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm">{challenge.message}</p>}

      {challenge.status === "accepted" && challenge.lobby_id && (
        <Link href={`/lobby/${challenge.lobby_id}`} className="btn-primary mt-1 w-full">
          Открыть матч
        </Link>
      )}
      {isPending && !isCaptain && <p className="text-sm font-semibold text-muted">Ждём ответа капитана</p>}
      {isPending && isCaptain && incoming && (
        <div className="flex gap-2 pt-1">
          <button type="button" className="btn-secondary flex-1" disabled={pending} onClick={() => run(() => respondChallenge(challenge.id, false, crewId))}>
            Отклонить
          </button>
          <button type="button" className="btn-primary flex-1" disabled={pending} onClick={() => run(() => respondChallenge(challenge.id, true, crewId))}>
            {pending && <Loader2 className="size-4 animate-spin" />} Принять
          </button>
        </div>
      )}
      {isPending && isCaptain && !incoming && (
        <button type="button" className="btn-secondary mt-1 w-full" disabled={pending} onClick={() => run(() => cancelChallenge(challenge.id, crewId))}>
          {pending && <Loader2 className="size-4 animate-spin" />} Отменить вызов
        </button>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
    </article>
  );
}
