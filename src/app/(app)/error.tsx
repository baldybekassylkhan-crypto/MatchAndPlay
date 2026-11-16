"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

/** Ошибка внутри раздела: нижнее меню остаётся, можно повторить или уйти на главную. */
export default function SectionError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const offline = typeof navigator !== "undefined" && !navigator.onLine;

  return (
    <div className="flex flex-col items-center gap-3 px-8 py-20 text-center">
      <div className="flex size-16 items-center justify-center rounded-3xl bg-danger/10">
        <TriangleAlert className="size-8 text-danger" />
      </div>
      <h1 className="text-xl font-bold">{offline ? "Нет подключения" : "Что-то пошло не так"}</h1>
      <p className="text-muted">
        {offline
          ? "Проверьте интернет и попробуйте ещё раз."
          : "Мы не смогли загрузить эту страницу. Попробуйте ещё раз — обычно это помогает."}
      </p>
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={reset} className="btn-primary">
          <RotateCcw className="size-4" /> Повторить
        </button>
        <Link href="/" className="btn-secondary">
          На главную
        </Link>
      </div>
      {error.digest && <p className="mt-4 text-xs text-muted">Код ошибки: {error.digest}</p>}
    </div>
  );
}
