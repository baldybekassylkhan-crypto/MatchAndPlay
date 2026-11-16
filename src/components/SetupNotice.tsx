import { Logo } from "@/components/Logo";

/** Показывается, пока не заданы ключи Supabase в .env.local. */
export function SetupNotice() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 px-6 py-10">
      <Logo className="text-3xl" />
      <h1 className="text-xl font-bold">Осталось подключить Supabase</h1>
      <ol className="list-decimal space-y-2 pl-5 text-muted">
        <li>Создайте бесплатный проект на supabase.com.</li>
        <li>
          Выполните SQL из папки <code className="text-ink">supabase/migrations</code> в SQL Editor.
        </li>
        <li>
          Скопируйте <code className="text-ink">.env.example</code> в <code className="text-ink">.env.local</code>{" "}
          и вставьте URL и ключ проекта.
        </li>
        <li>Перезапустите <code className="text-ink">npm run dev</code>.</li>
      </ol>
      <p className="text-sm text-muted">Подробная инструкция — в README.md.</p>
    </main>
  );
}
