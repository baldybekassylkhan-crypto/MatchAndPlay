"use client";

import { Ban, Flag, Loader2, MoreHorizontal, X } from "lucide-react";
import { useState, useTransition } from "react";
import { blockUser, reportUser, unblockUser, type ReportReason } from "@/app/actions/safety";

const REASONS: { id: ReportReason; label: string }[] = [
  { id: "harassment", label: "Оскорбления или травля" },
  { id: "dangerous", label: "Угрозы или опасное поведение" },
  { id: "spam", label: "Спам или реклама" },
  { id: "fake", label: "Фейковый профиль или игра" },
  { id: "inappropriate", label: "Неприемлемый контент" },
  { id: "other", label: "Другое" },
];

type View = "menu" | "block" | "report" | "done";

export function UserSafetyMenu({
  targetId,
  username,
  initialBlocked,
}: {
  targetId: string;
  username: string;
  initialBlocked: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("menu");
  const [blocked, setBlocked] = useState(initialBlocked);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const close = () => {
    setOpen(false);
    setView("menu");
    setReason(null);
    setDetails("");
    setError(null);
  };

  const toggleBlock = () =>
    startTransition(async () => {
      setError(null);
      const res = blocked ? await unblockUser(targetId) : await blockUser(targetId);
      if (!res.ok) {
        setError(res.error ?? "Ошибка");
        return;
      }
      setBlocked(!blocked);
      close();
    });

  const sendReport = () => {
    if (!reason) return;
    startTransition(async () => {
      setError(null);
      const res = await reportUser(targetId, reason, details);
      if (!res.ok) setError(res.error ?? "Ошибка");
      else setView("done");
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex size-10 items-center justify-center"
        aria-label="Действия с профилем"
      >
        <MoreHorizontal className="size-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50" onClick={close}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Действия с @${username}`}
            onClick={(e) => e.stopPropagation()}
            className="animate-fade-up max-h-[85dvh] w-full max-w-lg space-y-3 overflow-y-auto rounded-t-3xl bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-bold">@{username}</h2>
              <button type="button" onClick={close} className="flex size-10 items-center justify-center" aria-label="Закрыть">
                <X className="size-5" />
              </button>
            </div>

            {view === "menu" && (
              <div className="space-y-2">
                <button type="button" className="btn-secondary w-full" onClick={() => setView("report")}>
                  <Flag className="size-4" /> Пожаловаться
                </button>
                <button
                  type="button"
                  className="btn-secondary w-full text-danger"
                  disabled={pending}
                  onClick={() => (blocked ? toggleBlock() : setView("block"))}
                >
                  {pending ? <Loader2 className="size-4 animate-spin" /> : <Ban className="size-4" />}
                  {blocked ? "Разблокировать" : "Заблокировать"}
                </button>
              </div>
            )}

            {view === "block" && (
              <div className="space-y-3">
                <p className="text-sm">
                  Вы перестанете видеть посты и сообщения друг друга. Подписки исчезнут, а из ваших будущих игр этот игрок
                  будет убран. Он не получит уведомления о блокировке.
                </p>
                <button type="button" className="btn w-full bg-danger text-white" disabled={pending} onClick={toggleBlock}>
                  {pending && <Loader2 className="size-4 animate-spin" />} Заблокировать
                </button>
              </div>
            )}

            {view === "report" && (
              <div className="space-y-2">
                <p className="text-sm text-muted">Что случилось? Игрок не узнает, кто отправил жалобу.</p>
                {REASONS.map((r) => (
                  <label key={r.id} className="flex items-center gap-3 rounded-2xl border border-line px-4 py-3 text-sm">
                    <input type="radio" name="report-reason" checked={reason === r.id} onChange={() => setReason(r.id)} />
                    {r.label}
                  </label>
                ))}
                <textarea
                  className="input h-24 resize-none py-3"
                  value={details}
                  onChange={(e) => setDetails(e.target.value.slice(0, 500))}
                  placeholder="Подробности (необязательно)"
                  aria-label="Подробности жалобы"
                />
                <button type="button" className="btn-primary w-full" disabled={!reason || pending} onClick={sendReport}>
                  {pending && <Loader2 className="size-4 animate-spin" />} Отправить жалобу
                </button>
              </div>
            )}

            {view === "done" && (
              <div className="space-y-3">
                <p className="text-sm">Спасибо, жалоба отправлена. Если этот игрок вам мешает, его также можно заблокировать.</p>
                <button type="button" className="btn-secondary w-full" onClick={close}>
                  Готово
                </button>
              </div>
            )}

            {error && <p className="text-sm text-danger">{error}</p>}
          </div>
        </div>
      )}
    </>
  );
}
