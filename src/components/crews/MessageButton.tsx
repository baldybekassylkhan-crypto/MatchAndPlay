"use client";

import { Loader2, MessageCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { openDirectChat } from "@/app/actions/crews";

export function MessageButton({ userId }: { userId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex-1">
      <button
        type="button"
        className="btn-secondary h-10 w-full text-sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const res = await openDirectChat(userId);
            if (res && !res.ok) setError(res.error ?? "Ошибка");
          })
        }
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <MessageCircle className="size-4" />} Написать
      </button>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
