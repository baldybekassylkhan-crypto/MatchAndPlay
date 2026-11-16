import { WifiOff } from "lucide-react";

export const metadata = { title: "Нет сети" };
export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex size-16 items-center justify-center rounded-3xl bg-surface-2">
        <WifiOff className="size-8 text-muted" />
      </div>
      <h1 className="text-2xl font-bold">Нет подключения</h1>
      <p className="text-muted">Проверьте интернет. Как только сеть появится, обновите страницу.</p>
    </main>
  );
}
