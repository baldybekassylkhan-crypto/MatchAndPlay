import { Check } from "lucide-react";
import Link from "next/link";
import { LobbyCard } from "@/components/lobby/LobbyCard";
import type { LobbyWithMeta } from "@/lib/types";

/** Конец ленты: ближайшие игры и приглашение выйти играть вместо бесконечной прокрутки. */
export function FeedEnd({ games, hasPosts }: { games: LobbyWithMeta[]; hasPosts: boolean }) {
  return (
    <div className="space-y-8 px-4 pt-5 pb-10">
      {games.length > 0 && (
        <section className="space-y-2">
          <h2 className="px-1 text-[20px] font-semibold">Игры рядом</h2>
          {games.map((lobby) => (
            <LobbyCard key={lobby.id} lobby={lobby} />
          ))}
        </section>
      )}

      <section className="flex flex-col items-center px-6 py-4 text-center">
        <span className="flex size-11 items-center justify-center rounded-full bg-surface-2 text-muted">
          <Check className="size-5" strokeWidth={2.2} aria-hidden />
        </span>
        <h2 className="mt-3 text-[20px] font-semibold">{hasPosts ? "Вы всё посмотрели" : "Пока здесь тихо"}</h2>
        <p className="mt-1 text-[15px] text-muted">
          {hasPosts ? "Кто играет сегодня вечером?" : "Сыграйте с кем-нибудь, и их посты появятся здесь."}
        </p>
        <Link href="/search?day=today&times=evening" className="mt-2 inline-flex h-11 items-center px-3 text-[17px] text-accent active:opacity-60">
          Найти игру
        </Link>
      </section>
    </div>
  );
}
