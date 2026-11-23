"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthUserId } from "@/lib/supabase/auth-user";
import { createClient } from "@/lib/supabase/server";

const UUID_RE = /^[0-9a-f-]{36}$/i;

const MESSAGES: Record<string, string> = {
  bad_code: "Код не подошёл. Попросите организатора показать новый.",
  too_many: "Слишком много попыток. Подождите минуту.",
  closed: "Отметка открыта за 30 минут до начала и до 30 минут после конца игры.",
  not_member: "Отметиться могут только принятые игроки.",
};

async function requireUser() {
  const supabase = await createClient();
  if (!(await getAuthUserId(supabase))) redirect("/login");
  return supabase;
}

export async function getCheckinCode(lobbyId: string) {
  if (!UUID_RE.test(lobbyId)) return { ok: false as const, error: "Игра не найдена" };
  const supabase = await requireUser();
  const { data, error } = await supabase.rpc("get_checkin_code", { p_lobby_id: lobbyId });
  if (error || !data) {
    return {
      ok: false as const,
      error: error?.message.includes("checkin_closed") ? MESSAGES.closed : "Не удалось получить код. Попробуйте ещё раз.",
    };
  }
  const info = data as { code: string; expires_at: string; count: number };
  return { ok: true as const, code: info.code, expiresAt: info.expires_at, count: info.count };
}

export async function submitCheckin(lobbyId: string, code: string) {
  if (!UUID_RE.test(lobbyId) || !/^\d{6}$/.test(code)) return { ok: false, error: "Введите 6 цифр" };
  const supabase = await requireUser();
  const { data, error } = await supabase.rpc("check_in", { p_lobby_id: lobbyId, p_code: code });
  if (error) return { ok: false, error: "Не удалось отметиться. Попробуйте ещё раз." };
  if (data !== "ok" && data !== "already") return { ok: false, error: MESSAGES[data as string] ?? MESSAGES.bad_code };
  revalidatePath(`/lobby/${lobbyId}`);
  return { ok: true };
}
