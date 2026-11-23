import Link from "next/link";
import { SlotsBar } from "@/components/lobby/SlotsBar";
import { SportIcon } from "@/components/ui/SportIcon";
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
    <Link href={`/lobby/${lobby.id}`} className="card block animate-fade-up p-4 transition active:opacity-60">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink" aria-hidden>
          <SportIcon sport={lobby.sport} className="size-[22px]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-[17px] font-semibold">{sport?.label ?? lobby.sport}</p>
            {badge}
          </div>
          <p className="text-[15px] text-muted">{formatDayTime(lobby.start_time)}</p>
          <p className="truncate text-[15px] text-muted">
            {lobby.location_name}
            {lobby.city && `, ${lobby.city.name_ru}`}
          </p>
        </div>
      </div>

      {reason && <p className="mt-2 pl-[52px] text-[13px] font-medium text-accent">{reason}</p>}

      <div className="mt-3 pl-[52px]">
        <SlotsBar lobby={lobby} compact />
        <div className="mt-2 flex items-center justify-between text-[13px] text-muted">
          {lobby.organizer ? <span className="truncate">@{lobby.organizer.username}</span> : <span />}
          <span className="shrink-0">{formatPrice(lobby.price_kzt).replace(" с человека", "")}</span>
        </div>
      </div>
    </Link>
  );
}

export function StatusBadge({ tone, children }: { tone: "accent" | "muted" | "danger" | "ink"; children: React.ReactNode }) {
  const cls = {
    accent: "bg-accent/12 text-accent",
    muted: "bg-surface-2 text-muted",
    danger: "bg-danger/12 text-danger",
    ink: "bg-surface-2 text-ink",
  }[tone];
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${cls}`}>{children}</span>;
}
