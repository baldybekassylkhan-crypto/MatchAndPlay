import Link from "next/link";
import { Logo } from "@/components/Logo";

export const metadata = { title: "Не найдено" };

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-6 text-center">
      <Logo className="text-2xl" />
      <p className="text-7xl" aria-hidden>
        🥅
      </p>
      <h1 className="text-2xl font-bold">Мимо ворот</h1>
      <p className="text-muted">Такой страницы нет. Возможно, игру удалили или ссылка устарела.</p>
      <div className="flex gap-2">
        <Link href="/search" className="btn-primary">
          Найти игру
        </Link>
        <Link href="/" className="btn-secondary">
          На главную
        </Link>
      </div>
    </main>
  );
}
