"use client";

import { Check, Copy, ExternalLink, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setCourtReportStatus } from "@/app/actions/courts";
import { STATUS_INFO, type CourtReportStatus } from "@/lib/courts";

/** Текст обращения: копируем и отправляем через e-Otinish или iKomek 109. */
export function AppealBox({ text, count }: { text: string; count: number }) {
  const [copied, setCopied] = useState(false);
  return (
    <section className="card space-y-3 p-4">
      <h2 className="font-semibold">Обращение в акимат · {count}</h2>
      <textarea readOnly value={text} className="input h-48 resize-none py-3 font-mono text-xs" aria-label="Текст обращения" />
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          className="btn-primary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              /* Буфер обмена недоступен — текст можно выделить вручную */
            }
          }}
        >
          {copied ? <Check className="size-5" /> : <Copy className="size-5" />} {copied ? "Скопировано" : "Скопировать"}
        </button>
        <a href="https://eotinish.kz/" target="_blank" rel="noreferrer" className="btn-secondary">
          <ExternalLink className="size-5" /> e-Otinish
        </a>
      </div>
      <p className="text-xs text-muted">
        Отправьте текст через e-Otinish или iKomek 109 и переведите обращения в статус «Передано в акимат» — жители получат уведомление.
      </p>
    </section>
  );
}

const NEXT: CourtReportStatus[] = ["sent", "in_progress", "fixed", "rejected"];

export function StatusControls({ id, status }: { id: string; status: CourtReportStatus }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2 border-t border-line pt-3">
      <input className="input h-10 text-sm" placeholder="Комментарий для жителей (необязательно)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
      <div className="flex flex-wrap gap-2">
        {NEXT.filter((s) => s !== status).map((s) => (
          <button
            key={s}
            type="button"
            className="chip"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await setCourtReportStatus(id, s, note);
                if (res.ok) router.refresh();
                else setError(res.error);
              })
            }
          >
            {pending && <Loader2 className="size-3.5 animate-spin" />} {STATUS_INFO[s].label}
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
