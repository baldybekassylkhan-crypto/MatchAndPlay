import type { LobbyWithMeta } from "@/lib/types";

const WINDOW_MS = 30 * 60_000;

/** Окно отметки: за 30 минут до начала и до 30 минут после конца игры. Итоговую проверку делает база. */
export function isCheckinOpen(lobby: Pick<LobbyWithMeta, "status" | "start_time" | "duration_min">, now = Date.now()) {
  if (lobby.status === "cancelled") return false;
  const start = new Date(lobby.start_time).getTime();
  return now >= start - WINDOW_MS && now <= start + lobby.duration_min * 60_000 + WINDOW_MS;
}

/** Достаёт код из QR, только если он относится к этой игре. */
export function codeFromQr(data: string, lobbyId: string) {
  try {
    const url = new URL(data);
    if (url.pathname !== `/lobby/${lobbyId}`) return null;
    const code = url.searchParams.get("checkin") ?? "";
    return /^\d{6}$/.test(code) ? code : null;
  } catch {
    return null;
  }
}
