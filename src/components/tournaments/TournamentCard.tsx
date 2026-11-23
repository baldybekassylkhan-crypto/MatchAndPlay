import { CalendarDays, MapPin, Users } from "lucide-react";
import Link from "next/link";
import { formatDayTime } from "@/lib/time";
import type { Tournament, TournamentStatus } from "@/lib/tournaments";
import { SportIcon } from "@/components/ui/SportIcon";

export const STATUS_LABELS: Record<TournamentStatus, { label: string; className: string }> = {
  pending: { label: "На модерации", className: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  rejected: { label: "Отклонён", className: "bg-danger/15 text-danger" },
  registration: { label: "Регистрация", className: "bg-accent/12 text-accent" },
  in_progress: { label: "Идёт", className: "bg-green-500/15 text-green-700 dark:text-green-400" },
  finished: { label: "Завершён", className: "bg-surface-2 text-muted" },
  cancelled: { label: "Отменён", className: "bg-surface-2 text-muted" },
};

export function TournamentStatusBadge({ status }: { status: TournamentStatus }) {
  const s = STATUS_LABELS[status];
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${s.className}`}>{s.label}</span>;
}

export function TournamentCard({ tournament: t }: { tournament: Tournament }) {
  const teams = t.teams?.[0]?.count ?? 0;
  return (
    <Link href={`/tournaments/${t.id}`} className="card block p-4 transition active:opacity-60">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2" aria-hidden>
          <SportIcon sport={t.sport} className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 font-bold break-words">{t.name}</p>
            <TournamentStatusBadge status={t.status} />
          </div>
          <p className="mt-1 flex items-center gap-1 text-sm text-muted">
            <CalendarDays className="size-3.5 shrink-0" /> {formatDayTime(t.starts_at)}
          </p>
          <p className="flex items-center gap-1 text-sm text-muted">
            <MapPin className="size-3.5 shrink-0" />
            <span className="truncate">
              {t.location_name}
              {t.city && `, ${t.city.name_ru}`}
            </span>
          </p>
          <p className="flex items-center gap-1 text-sm text-muted">
            <Users className="size-3.5 shrink-0" /> {teams} из {t.max_teams} команд
          </p>
        </div>
      </div>
    </Link>
  );
}
