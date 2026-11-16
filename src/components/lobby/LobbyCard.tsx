import { Clock, MapPin, Sparkles } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { SlotsBar } from "@/components/lobby/SlotsBar";
import { SPORTS } from "@/lib/sports";
import { formatDayTime, formatPrice } from "@/lib/time";
import type { LobbyWithMeta } from "@/lib/types";

export function LobbyCard({
  lobby,
  badge,
  reason,
}: {
  lobby: LobbyWithMeta;
  badge?: React.ReactNode;
  /** «Почему подходит» — для умного поиска */
  reason?: string;
}) {
  const sport = SPORTS[lobby.sport];
  return (
    <Link
      href={`/lobby/${lobby.id}`}
      className="block animate-fade-up rounded-3xl border border-line bg-surface p-4 transition duration-200 hover:border-muted/40 active:scale-[0.985]"
    >
      <div className="flex items-start gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-2xl" aria-hidden>
          {sport?.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-bold">{sport?.label ?? lobby.sport}</p>
            {badge}
          </div>
          <p className="mt-0.5 flex items-center gap-1 text-sm text-muted">
            <Clock className="size-3.5 shrink-0" />
            {formatDayTime(lobby.start_time)}
          </p>
          <p className="flex items-center gap-1 text-sm text-muted">
            <MapPin className="size-3.5 shrink-0" />
            <span className="truncate">
              {lobby.location_name}
              {lobby.city && `, ${lobby.city.name_ru}`}
            </span>
          </p>
        </div>
      </div>

      {reason && (
        <p className="mt-3 flex items-center gap-1.5 rounded-xl bg-accent/25 px-3 py-1.5 text-sm font-semibold">
          <Sparkles className="size-3.5 shrink-0" />
          {reason}
        </p>
      )}

      <p className="mt-3 line-clamp-2 text-[15px]">{lobby.description}</p>

      <div className="mt-3">
        <SlotsBar lobby={lobby} compact />
      </div>

      <div className="mt-3 flex items-center justify-between text-sm">
        {lobby.organizer && (
          <span className="flex min-w-0 items-center gap-2 text-muted">
            <Avatar src={lobby.organizer.avatar_url} name={lobby.organizer.username} size={22} />
            <span className="truncate">@{lobby.organizer.username}</span>
          </span>
        )}
        <span className="shrink-0 font-medium">{formatPrice(lobby.price_kzt).replace(" с человека", "")}</span>
      </div>
    </Link>
  );
}

export function StatusBadge({ tone, children }: { tone: "accent" | "muted" | "danger" | "ink"; children: React.ReactNode }) {
  const cls = {
    accent: "bg-accent text-accent-ink",
    muted: "bg-surface-2 text-muted",
    danger: "bg-danger/15 text-danger",
    ink: "bg-ink text-bg",
  }[tone];
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{children}</span>;
}
