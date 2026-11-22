"use server";

import { redirect } from "next/navigation";
import { getAuthUserId } from "@/lib/supabase/auth-user";
import { createClient } from "@/lib/supabase/server";

export async function sendMessage(lobbyId: string, text: string) {
  if (!/^[0-9a-f-]{36}$/i.test(lobbyId)) return { ok: false, error: "Чат не найден" };
  const clean = text.trim();
  if (!clean) return { ok: false, error: "Пустое сообщение" };
  if (clean.length > 1000) return { ok: false, error: "Не больше 1000 символов" };

  const supabase = await createClient();
  const userId = await getAuthUserId(supabase);
  const user = userId ? { id: userId } : null;
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("lobby_messages")
    .insert({ lobby_id: lobbyId, user_id: user.id, text: clean })
    .select("id, lobby_id, user_id, text, created_at")
    .single();
  if (error || !data) return { ok: false, error: "Сообщение не отправлено. Чат доступен только участникам игры." };
  return { ok: true, message: data };
}
