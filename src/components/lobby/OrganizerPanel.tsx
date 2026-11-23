"use client";

import { Check, Loader2, Pencil, X } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { cancelLobby, decideApplication } from "@/app/actions/lobby";
import { Avatar } from "@/components/Avatar";
import type { ApplicationWithUser } from "@/lib/types";

export function OrganizerPanel({
  lobbyId,
  editable,
  full,
  pendingApps,
}: {
  lobbyId: string;
  editable: boolean;
  full: boolean;
  pendingApps: ApplicationWithUser[];
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [pending, startTransition] = useTransition();

  const decide = (appId: string, accept: boolean) =>
    startTransition(async () => {
      setBusyId(appId);
      setError(null);
      const res = await decideApplication(appId, accept, lobbyId);
      if (!res.ok) setError(res.error ?? "Ошибка");
      setBusyId(null);
    });

  const cancel = () =>
    startTransition(async () => {
      setError(null);
      const res = await cancelLobby(lobbyId);
      if (!res.ok) setError(res.error ?? "Ошибка");
      setConfirmCancel(false);
    });

  return (
    <section className="space-y-4">
      {editable && (
        <div>
          <h2 className="mb-2 font-bold">
            Заявки{pendingApps.length > 0 && <span className="ml-1.5 text-muted">{pendingApps.length}</span>}
          </h2>
          {pendingApps.length === 0 ? (
            <p className="rounded-2xl bg-surface-2 p-4 text-sm text-muted">
              Новых заявок пока нет. Как только кто-то захочет сыграть, заявка появится здесь.
            </p>
          ) : (
            <ul className="space-y-2">
              {pendingApps.map((app) => (
                <li key={app.id} className="animate-fade-up card p-3">
                  <div className="flex items-center gap-3">
                    <Link href={`/u/${app.user?.username}`} className="flex min-w-0 flex-1 items-center gap-3">
                      <Avatar src={app.user?.avatar_url} name={app.user?.username ?? "?"} size={40} />
                      <div className="min-w-0">
                        <p className="truncate font-semibold">@{app.user?.username}</p>
                        {app.user?.full_name && <p className="truncate text-sm text-muted">{app.user.full_name}</p>}
                      </div>
                    </Link>
                    <button
                      onClick={() => decide(app.id, false)}
                      disabled={pending}
                      className="flex size-10 items-center justify-center rounded-xl border border-line"
                      aria-label="Отклонить"
                    >
                      {busyId === app.id ? <Loader2 className="size-4 animate-spin" /> : <X className="size-5" />}
                    </button>
                    <button
                      onClick={() => decide(app.id, true)}
                      disabled={pending || full}
                      className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-ink disabled:opacity-40"
                      aria-label="Принять"
                    >
                      <Check className="size-5" />
                    </button>
                  </div>
                  {app.message && <p className="mt-2 rounded-xl bg-surface-2 px-3 py-2 text-sm">{app.message}</p>}
                </li>
              ))}
            </ul>
          )}
          {full && pendingApps.length > 0 && (
            <p className="mt-2 text-sm text-muted">Все места заняты. Увеличьте число игроков, чтобы принять ещё.</p>
          )}
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      {editable && (
        <div className="flex gap-2">
          <Link href={`/lobby/${lobbyId}/edit`} className="btn-secondary flex-1">
            <Pencil className="size-4" /> Изменить
          </Link>
          {!confirmCancel && (
            <button className="btn-secondary flex-1 text-danger" onClick={() => setConfirmCancel(true)}>
              Отменить игру
            </button>
          )}
        </div>
      )}
      {confirmCancel && (
        <div className="animate-fade-up space-y-2 rounded-2xl border border-line p-4">
          <p className="text-sm">Отменить игру? Все участники увидят, что она не состоится. Это действие нельзя вернуть.</p>
          <div className="flex gap-2">
            <button className="btn flex-1 bg-danger text-white" disabled={pending} onClick={cancel}>
              {pending && <Loader2 className="size-4 animate-spin" />} Да, отменить
            </button>
            <button className="btn-secondary flex-1" onClick={() => setConfirmCancel(false)}>
              Нет
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
