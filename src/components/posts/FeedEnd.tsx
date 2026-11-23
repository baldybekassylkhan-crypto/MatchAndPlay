import { LobbyCard } from "@/components/lobby/LobbyCard";
import { FeedEndMessage } from "@/components/posts/FeedEndMessage";
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

      <FeedEndMessage hasPosts={hasPosts} />
    </div>
  );
}
