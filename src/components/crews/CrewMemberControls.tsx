"use client";

import { Check, Loader2, UserMinus, X } from "lucide-react";
import { useState, useTransition } from "react";
import { decideCrewMember, removeCrewMember } from "@/app/actions/crews";

export function RequestControls({ crewId, userId, username }: { crewId: string; userId: string; username: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const decide = (accept: boolean) =>
    startTransition(async () => {
      setError(null);
      const res = await decideCrewMember(crewId, userId, accept);
      if (!res.ok) setError(res.error ?? "Ошибка");
    });

  if (error) return <span className="pr-3 text-xs text-danger">{error}</span>;

  return (
    <span className="flex shrink-0 items-center gap-2 pr-3">
      <button type="button" onClick={() => decide(false)} disabled={pending} className="flex size-10 items-center justify-center rounded-xl border border-line" aria-label={`Отклонить @${username}`}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <X className="size-5" />}
      </button>
      <button type="button" onClick={() => decide(true)} disabled={pending} className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-ink" aria-label={`Принять @${username}`}>
        <Check className="size-5" />
      </button>
    </span>
  );
}

export function RemoveMemberButton({ crewId, userId, username }: { crewId: string; userId: string; username: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const remove = () =>
    startTransition(async () => {
      setError(null);
      const res = await removeCrewMember(crewId, userId);
      if (!res.ok) setError(res.error ?? "Ошибка");
      setConfirming(false);
    });

  if (error) return <span className="pr-3 text-xs text-danger">{error}</span>;

  if (confirming) {
    return (
      <span className="flex shrink-0 items-center gap-1 pr-3">
        <button type="button" onClick={remove} disabled={pending} className="h-9 rounded-xl bg-danger px-3 text-sm font-semibold text-white">
          {pending ? <Loader2 className="size-4 animate-spin" /> : "Убрать"}
        </button>
        <button type="button" onClick={() => setConfirming(false)} className="h-9 rounded-xl border border-line px-3 text-sm">
          Нет
        </button>
      </span>
    );
  }

  return (
    <button type="button" onClick={() => setConfirming(true)} className="mr-2 flex size-10 shrink-0 items-center justify-center text-muted" aria-label={`Убрать @${username} из команды`}>
      <UserMinus className="size-5" />
    </button>
  );
}
