"use client";

import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { joinCrewMatch } from "@/app/actions/crews";

export function CrewMatchJoin({ lobbyId, full }: { lobbyId: string; full: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-2">
      <button
        type="button"
        className="btn-primary w-full"
        disabled={pending || full}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const res = await joinCrewMatch(lobbyId);
            if (!res.ok) setError(res.error ?? "Ошибка");
          })
        }
      >
        {pending && <Loader2 className="size-4 animate-spin" />} {full ? "Все места заняты" : "Я играю"}
      </button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
