"use client";

import { useT } from "@/components/I18nProvider";
import { CheckCircle2, Clock3, Loader2, XCircle } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { applyToLobby, cancelApplication } from "@/app/actions/lobby";
import { canLeaveGame, LEAVE_DEADLINE_MIN } from "@/lib/time";
import type { ApplicationStatus } from "@/lib/types";

/** Обновляет «сейчас» раз в 30 секунд, чтобы кнопка «Отказаться» сама блокировалась за 30 минут. */
function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function PlayerActions({
  lobbyId,
  startTime,
  open,
  full,
  application,
}: {
  lobbyId: string;
  startTime: string;
  /** Лобби активно и игра ещё не началась */
  open: boolean;
  full: boolean;
  application: { id: string; status: ApplicationStatus } | null;
}) {
  const t = useT();
  const now = useNow();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmLeave, setConfirmLeave] = useState(false);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) =>
    startTransition(async () => {
      setError(null);
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Ошибка");
      else after?.();
    });

  const status = application?.status;
  const leaveAllowed = canLeaveGame(startTime, now);

  if (status === "accepted") {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-2xl bg-accent p-4 font-semibold text-accent-ink">
          <CheckCircle2 className="size-5" /> Вы в игре!
        </div>
        {open &&
          (confirmLeave ? (
            <div className="animate-fade-up space-y-2 rounded-2xl border border-line p-4">
              <p className="text-sm">{t("Точно отказаться от игры? Ваше место освободится для других.")}</p>
              <div className="flex gap-2">
                <button
                  className="btn flex-1 bg-danger text-white"
                  disabled={pending || !leaveAllowed}
                  onClick={() => run(() => cancelApplication(application!.id, lobbyId), () => setConfirmLeave(false))}
                >
                  {pending && <Loader2 className="size-4 animate-spin" />} Отказаться
                </button>
                <button className="btn-secondary flex-1" onClick={() => setConfirmLeave(false)}>
                  {t("Остаюсь")}
                </button>
              </div>
            </div>
          ) : (
            <>
              <button className="btn-secondary w-full" disabled={!leaveAllowed} onClick={() => setConfirmLeave(true)}>
                {t("Отказаться от игры")}
              </button>
              {!leaveAllowed && (
                <p className="text-center text-sm text-muted">
                  Отменить участие можно не позднее чем за {LEAVE_DEADLINE_MIN} минут до начала игры.
                </p>
              )}
            </>
          ))}
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    );
  }

  if (status === "pending") {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-2xl bg-surface-2 p-4 font-semibold">
          <Clock3 className="size-5" /> Заявка отправлена — ждём решения организатора
        </div>
        {open && (
          <button
            className="btn-secondary w-full"
            disabled={pending}
            onClick={() => run(() => cancelApplication(application!.id, lobbyId))}
          >
            {pending && <Loader2 className="size-4 animate-spin" />} Отменить заявку
          </button>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    );
  }

  if (status === "rejected") {
    return (
      <div className="flex items-center gap-2 rounded-2xl bg-surface-2 p-4 text-muted">
        <XCircle className="size-5" /> Организатор отклонил заявку. Поищите другую игру!
      </div>
    );
  }

  if (!open) return null;
  if (full) return <div className="rounded-2xl bg-surface-2 p-4 text-center font-semibold text-muted">{t("Все места заняты")}</div>;

  return (
    <div className="space-y-3">
      {composing ? (
        <div className="animate-fade-up space-y-2 card p-4">
          <label className="label" htmlFor="apply-message">
            Сообщение организатору (необязательно)
          </label>
          <textarea
            id="apply-message"
            className="input h-20 resize-none py-3"
            maxLength={200}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t("Привет! Играю в нападении, могу прийти пораньше")}
            autoFocus
          />
          <div className="flex gap-2">
            <button
              className="btn-primary flex-1"
              disabled={pending}
              onClick={() => run(() => applyToLobby(lobbyId, message), () => setComposing(false))}
            >
              {pending && <Loader2 className="size-4 animate-spin" />} Отправить заявку
            </button>
            <button className="btn-secondary" onClick={() => setComposing(false)}>
              {t("Отмена")}
            </button>
          </div>
        </div>
      ) : (
        <button className="btn-primary w-full text-lg" onClick={() => setComposing(true)}>
          {t("Хочу играть")}
        </button>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
