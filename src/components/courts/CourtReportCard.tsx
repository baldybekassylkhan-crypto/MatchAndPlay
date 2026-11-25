"use client";

import { useT } from "@/components/I18nProvider";
import clsx from "clsx";
import { MapPin, ThumbsUp } from "lucide-react";
import { useState, useTransition } from "react";
import { voteCourtReport } from "@/app/actions/courts";
import { COURT_ISSUES, OPEN_STATUSES, STATUS_INFO, type CourtReport } from "@/lib/courts";
import { mediaUrl } from "@/lib/media";
import { timeAgo } from "@/lib/time";

const TONE = { muted: "bg-surface-2 text-muted", warn: "bg-[#ff9f0a]/15 text-[#c77700]", ok: "bg-accent/15 text-accent", bad: "bg-danger/10 text-danger" };

export function StatusPill({ status }: { status: CourtReport["status"] }) {
  const s = STATUS_INFO[status];
  const t = useT();
  return <span className={clsx("shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold", TONE[s.tone])}>{t(s.label)}</span>;
}

export function CourtReportCard({ report: r, voted, children }: { report: CourtReport; voted: boolean; children?: React.ReactNode }) {
  const t = useT();
  const [votes, setVotes] = useState(r.votes);
  const [mine, setMine] = useState(voted);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const open = OPEN_STATUSES.includes(r.status);

  return (
    <article className="card space-y-2.5 p-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold">{t(COURT_ISSUES[r.kind].label)}</h3>
          <a
            href={`https://www.openstreetmap.org/?mlat=${r.lat}&mlon=${r.lng}#map=18/${r.lat}/${r.lng}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-sm text-muted"
          >
            <MapPin className="size-3.5 shrink-0" /> <span className="truncate">{r.venue_name}</span>
          </a>
        </div>
        <StatusPill status={r.status} />
      </header>
      {r.comment && <p className="text-[15px]">{r.comment}</p>}
      {r.photo_path && (
        // eslint-disable-next-line @next/next/no-img-element -- фото уже сжато при загрузке
        <img src={mediaUrl(r.photo_path)} alt={t("Фото проблемы")} loading="lazy" className="max-h-64 w-full rounded-xl object-cover" />
      )}
      {r.admin_note && <p className="rounded-xl bg-surface-2 p-2.5 text-sm">Ответ: {r.admin_note}</p>}
      <footer className="flex items-center justify-between gap-2 text-sm text-muted">
        <span>{r.status === "fixed" && r.resolved_at ? `Исправлено ${t.d(timeAgo(r.resolved_at))}` : t.d(timeAgo(r.created_at))}</span>
        <button
          type="button"
          disabled={!open || mine || pending}
          onClick={() =>
            start(async () => {
              const res = await voteCourtReport(r.id);
              if (res.ok) {
                setVotes(res.votes);
                setMine(true);
              } else setError(res.error);
            })
          }
          className={clsx("chip gap-1.5", mine && "chip-active")}
          aria-label={mine ? `Вы поддержали, голосов: ${votes}` : `Поддержать, голосов: ${votes}`}
        >
          <ThumbsUp className="size-4" /> {mine ? t("У меня тоже") : t("Поддержать")} · {votes}
        </button>
      </footer>
      {error && <p className="text-sm text-danger">{error}</p>}
      {children}
    </article>
  );
}
