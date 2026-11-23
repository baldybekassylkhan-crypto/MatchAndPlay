"use client";

import { Loader2, UserMinus } from "lucide-react";
import { useState, useTransition } from "react";
import { removePlayer } from "@/app/actions/lobby";

export function RemovePlayerButton({
  applicationId,
  lobbyId,
  username,
}: {
  applicationId: string;
  lobbyId: string;
  username: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const remove = () =>
    startTransition(async () => {
      setError(null);
      const res = await removePlayer(applicationId, lobbyId);
      if (!res.ok) setError(res.error ?? "Ошибка");
      setConfirming(false);
    });

  if (error) return <span className="pr-4 text-xs text-danger">{error}</span>;

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
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="mr-2 flex size-10 shrink-0 items-center justify-center text-muted"
      aria-label={`Убрать @${username} из игры`}
    >
      <UserMinus className="size-5" />
    </button>
  );
}
