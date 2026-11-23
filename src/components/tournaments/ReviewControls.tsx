"use client";

import { Check, Loader2, X } from "lucide-react";
import { useState, useTransition } from "react";
import { reviewTournament } from "@/app/actions/tournaments";

export function ReviewControls({ tournamentId }: { tournamentId: string }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const decide = (approve: boolean) =>
    startTransition(async () => {
      setError(null);
      const res = await reviewTournament(tournamentId, approve, approve ? "" : reason);
      if (!res.ok) setError(res.error);
    });

  return (
    <div className="space-y-2">
      {rejecting ? (
        <>
          <textarea
            className="input h-24 resize-none py-3"
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 300))}
            placeholder="Что нужно исправить? Организатор увидит этот текст"
            aria-label="Причина отказа"
            autoFocus
          />
          <div className="flex gap-2">
            <button type="button" className="btn flex-1 bg-danger text-white" disabled={pending || !reason.trim()} onClick={() => decide(false)}>
              {pending && <Loader2 className="size-4 animate-spin" />} Отклонить
            </button>
            <button type="button" className="btn-secondary flex-1" onClick={() => setRejecting(false)}>
              Назад
            </button>
          </div>
        </>
      ) : (
        <div className="flex gap-2">
          <button type="button" className="btn-secondary flex-1 text-danger" disabled={pending} onClick={() => setRejecting(true)}>
            <X className="size-4" /> Отклонить
          </button>
          <button type="button" className="btn-primary flex-1" disabled={pending} onClick={() => decide(true)}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Одобрить
          </button>
        </div>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
