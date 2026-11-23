"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUserId } from "@/lib/supabase/auth-user";
import { createClient } from "@/lib/supabase/server";

const UUID_RE = /^[0-9a-f-]{36}$/i;
const REPORT_REASONS = ["harassment", "spam", "fake", "dangerous", "inappropriate", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

async function requireUser() {
  const supabase = await createClient();
  const userId = await getAuthUserId(supabase);
  if (!userId) redirect("/login");
  return { supabase, userId };
}

export async function blockUser(targetId: string) {
  if (!UUID_RE.test(targetId)) return { ok: false, error: "Пользователь не найден" };
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("block_user", { p_user_id: targetId });
  if (error) return { ok: false, error: "Не удалось заблокировать. Попробуйте ещё раз." };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function unblockUser(targetId: string) {
  if (!UUID_RE.test(targetId)) return { ok: false, error: "Пользователь не найден" };
  const { supabase, userId } = await requireUser();
  const { error } = await supabase.from("blocks").delete().eq("blocker_id", userId).eq("blocked_id", targetId);
  if (error) return { ok: false, error: "Не удалось снять блокировку. Попробуйте ещё раз." };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function reportUser(targetId: string, reason: ReportReason, details: string) {
  if (!UUID_RE.test(targetId) || !REPORT_REASONS.includes(reason)) return { ok: false, error: "Проверьте данные жалобы" };
  const { supabase, userId } = await requireUser();
  if (userId === targetId) return { ok: false, error: "Нельзя пожаловаться на себя" };
  const { error } = await supabase.from("reports").insert({
    reporter_id: userId,
    target_user_id: targetId,
    reason,
    details: details.trim().slice(0, 500) || null,
  });
  // Открытая жалоба уже есть — для пользователя это тоже успех.
  if (error && error.code !== "23505") return { ok: false, error: "Жалоба не отправлена. Попробуйте ещё раз." };
  return { ok: true };
}

/** Удаляет все файлы пользователя из бакета (файлы лежат в папке с его id). */
async function removeUserFiles(admin: NonNullable<ReturnType<typeof createAdminClient>>, bucket: string, userId: string) {
  for (;;) {
    const { data, error } = await admin.storage.from(bucket).list(userId, { limit: 1000 });
    if (error) throw error;
    if (!data?.length) return;
    const { error: removeError } = await admin.storage.from(bucket).remove(data.map((f) => `${userId}/${f.name}`));
    if (removeError) throw removeError;
  }
}

export async function deleteAccount(confirmUsername: string) {
  const { supabase, userId } = await requireUser();
  const { data: profile } = await supabase.from("profiles").select("username").eq("id", userId).maybeSingle();
  if (!profile || confirmUsername.trim().toLowerCase() !== profile.username.toLowerCase()) {
    return { ok: false, error: "Ник введён неверно" };
  }

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Удаление аккаунта сейчас недоступно. Напишите в поддержку." };

  const { error: prepareError } = await supabase.rpc("prepare_account_deletion");
  if (prepareError) return { ok: false, error: "Не удалось удалить аккаунт. Попробуйте ещё раз." };

  try {
    await removeUserFiles(admin, "avatars", userId);
    await removeUserFiles(admin, "posts", userId);
  } catch {
    return { ok: false, error: "Не удалось удалить файлы. Попробуйте ещё раз." };
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { ok: false, error: "Не удалось удалить аккаунт. Попробуйте ещё раз." };

  await supabase.auth.signOut();
  redirect("/login");
}
