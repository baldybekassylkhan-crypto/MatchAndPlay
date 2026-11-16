"use client";

import clsx from "clsx";
import { Heart } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { setSaved } from "@/app/actions/swipe";

export function SaveButton({
  lobbyId,
  initialSaved,
  className,
}: {
  lobbyId: string;
  initialSaved: boolean;
  className?: string;
}) {
  const [saved, setOptimistic] = useOptimistic(initialSaved);
  const [, startTransition] = useTransition();

  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={saved ? "Убрать из сохранённых" : "Сохранить"}
      onClick={() =>
        startTransition(async () => {
          setOptimistic(!saved);
          await setSaved(lobbyId, !saved);
        })
      }
      className={clsx("flex size-10 items-center justify-center rounded-full", className)}
    >
      <Heart key={String(saved)} className={clsx("size-5", saved && "animate-pop fill-danger text-danger")} />
    </button>
  );
}
