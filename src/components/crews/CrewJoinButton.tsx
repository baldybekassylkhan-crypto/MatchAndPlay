"use client";

import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { joinCrew, leaveCrew } from "@/app/actions/crews";
import type { MemberStatus } from "@/lib/crews";

export function CrewJoinButton({
  crewId,
  status,
  isOpen,
  isCaptain,
  memberCount,
}: {
  crewId: string;
  status: MemberStatus | null;
  isOpen: boolean;
  isCaptain: boolean;
  memberCount: number;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      setError(null);
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Ошибка");
      setConfirming(false);
    });

  if (status === "removed") return <p className="rounded-2xl bg-surface-2 p-3 text-center text-sm text-muted">Вступить в эту команду нельзя</p>;

  const member = status === "active";
  const waiting = status === "pending";

  if (confirming) {
    const note = isCaptain
      ? memberCount > 1
        ? "Капитаном станет самый давний участник."
        : "Вы единственный участник, поэтому команда и её чат будут удалены."
      : "Вы потеряете доступ к чату команды.";
    return (
      <div className="animate-fade-up space-y-2 rounded-2xl border border-line p-4">
        <p className="text-sm">Выйти из команды? {note}</p>
        <div className="flex gap-2">
          <button type="button" className="btn flex-1 bg-danger text-white" disabled={pending} onClick={() => run(() => leaveCrew(crewId))}>
            {pending && <Loader2 className="size-4 animate-spin" />} Выйти
          </button>
          <button type="button" className="btn-secondary flex-1" onClick={() => setConfirming(false)}>
            Отмена
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {member ? (
        <button type="button" className="btn-secondary w-full text-danger" onClick={() => setConfirming(true)}>
          Выйти из команды
        </button>
      ) : waiting ? (
        <button type="button" className="btn-secondary w-full" disabled={pending} onClick={() => run(() => leaveCrew(crewId))}>
          {pending && <Loader2 className="size-4 animate-spin" />} Отменить заявку
        </button>
      ) : (
        <button type="button" className="btn-primary w-full" disabled={pending} onClick={() => run(() => joinCrew(crewId))}>
          {pending && <Loader2 className="size-4 animate-spin" />} {isOpen ? "Вступить в команду" : "Подать заявку"}
        </button>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
