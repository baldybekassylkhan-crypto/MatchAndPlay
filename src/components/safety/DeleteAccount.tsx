"use client";

import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { deleteAccount } from "@/app/actions/safety";

export function DeleteAccount({ username }: { username: string }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () =>
    startTransition(async () => {
      setError(null);
      const res = await deleteAccount(value);
      if (res && !res.ok) setError(res.error ?? "Ошибка");
    });

  if (!open) {
    return (
      <button type="button" className="mt-3 h-11 w-full text-sm font-semibold text-danger" onClick={() => setOpen(true)}>
        Удалить аккаунт
      </button>
    );
  }

  return (
    <div className="animate-fade-up mt-3 space-y-3 rounded-2xl border border-danger/40 p-4">
      <p className="text-sm">
        Профиль, посты, фото, сообщения и история игр будут удалены навсегда. Ваши будущие игры отменятся. Вернуть это нельзя.
      </p>
      <input
        className="input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={`Введите ник: ${username}`}
        autoCapitalize="none"
        autoCorrect="off"
        aria-label="Подтвердите ник"
      />
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          className="btn flex-1 bg-danger text-white disabled:opacity-40"
          disabled={pending || value.trim().toLowerCase() !== username.toLowerCase()}
          onClick={submit}
        >
          {pending && <Loader2 className="size-4 animate-spin" />} Удалить навсегда
        </button>
        <button type="button" className="btn-secondary flex-1" onClick={() => setOpen(false)}>
          Отмена
        </button>
      </div>
    </div>
  );
}
