import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { LobbyCard } from "@/components/lobby/LobbyCard";
import type { LobbyWithMeta } from "@/lib/types";

/** Конец ленты: ближайшие игры и приглашение выйти играть вместо бесконечной прокрутки. */
export function FeedEnd({ games, hasPosts }: { games: LobbyWithMeta[]; hasPosts: boolean }) {
  return (
    <div className="space-y-6 px-4 pt-6 pb-10">
      {games.length > 0 && (
        <section className="space-y-3">
          <h2 className="px-1 text-lg font-bold">Игры рядом с вами</h2>
          {games.map((lobby) => (
            <LobbyCard key={lobby.id} lobby={lobby} />
          ))}
        </section>
      )}

      <section className="flex flex-col items-center gap-3 rounded-3xl bg-surface-2 px-6 py-8 text-center">
        <CheckCircle2 className="size-9 text-accent" aria-hidden />
        <h2 className="text-xl font-extrabold">{hasPosts ? "Вы всё посмотрели" : "Здесь появятся ваши партнёры"}</h2>
        <p className="text-muted">
          {hasPosts ? "Кто играет сегодня вечером?" : "Сыграйте с кем-нибудь, и их посты будут в вашей ленте. Кто играет сегодня вечером?"}
        </p>
        <Link href="/search?day=today&times=evening" className="btn-primary mt-1 w-full">
          Найти игру
        </Link>
      </section>
    </div>
  );
}
