"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fieldErrors, profileSchema } from "@/lib/validation";

export interface ProfileFormState {
  error: string | null;
  fields?: Record<string, string>;
}

const text = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

export async function saveProfile(_prev: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parsed = profileSchema.safeParse({
    username: text(formData.get("username")),
    full_name: text(formData.get("full_name")),
    bio: text(formData.get("bio")),
    city_id: text(formData.get("city_id")),
    sports: formData.getAll("sports").map(text),
    level: text(formData.get("level")),
    avatar_url: text(formData.get("avatar_url")) || null,
  });

  if (!parsed.success) {
    return { error: "Проверьте выделенные поля", fields: fieldErrors(parsed.error) };
  }

  const { error } = await supabase.from("profiles").upsert({ id: user.id, ...parsed.data });

  if (error) {
    if (error.code === "23505") {
      return { error: "Этот ник уже занят", fields: { username: "Ник уже занят — придумайте другой" } };
    }
    return { error: `Не удалось сохранить профиль: ${error.message}` };
  }

  revalidatePath("/", "layout");
  redirect(text(formData.get("mode")) === "onboarding" ? "/" : `/u/${parsed.data.username}`);
}

export async function toggleFollow(targetId: string, follow: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (user.id === targetId) return { ok: false };

  const { error } = follow
    ? await supabase.from("follows").insert({ follower_id: user.id, following_id: targetId })
    : await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", targetId);

  // Повторная подписка (23505) — не ошибка для пользователя.
  if (error && error.code !== "23505") return { ok: false };
  revalidatePath("/u/[username]", "page");
  return { ok: true };
}
