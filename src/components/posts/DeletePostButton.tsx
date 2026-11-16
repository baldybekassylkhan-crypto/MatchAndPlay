"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { deletePost } from "@/app/actions/posts";

export function DeletePostButton({ postId }: { postId: string }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirm) {
    return (
      <button type="button" onClick={() => setConfirm(true)} className="flex size-10 items-center justify-center" aria-label="Удалить пост">
        <Trash2 className="size-5" />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => void (await deletePost(postId)))}
        className="rounded-full bg-danger px-3 py-1.5 text-sm font-semibold text-white"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : "Удалить навсегда"}
      </button>
      <button type="button" onClick={() => setConfirm(false)} className="px-2 text-sm text-muted">
        Нет
      </button>
    </div>
  );
}
