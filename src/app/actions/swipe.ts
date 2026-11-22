"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthUserId } from "@/lib/supabase/auth-user";
import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createClient();
  const userId = await getAuthUserId(supabase);
  const user = userId ? { id: userId } : null;
  if (!user) redirect("/login");
  return { supabase, userId: user.id };
}

const isUuid = (id: string) => /^[0-9a-f-]{36}$/i.test(id);

/** Свайп: влево — «не то», вправо — в сохранённые. */
export async function recordSwipe(lobbyId: string, direction: "left" | "right") {
  if (!isUuid(lobbyId)) return { ok: false };
  const { supabase, userId } = await requireUser();

  const { error } = await supabase
    .from("swipes")
    .upsert({ user_id: userId, lobby_id: lobbyId, direction }, { onConflict: "user_id,lobby_id" });
  if (error) return { ok: false };

  if (direction === "right") {
    await supabase
      .from("saved_lobbies")
      .upsert({ user_id: userId, lobby_id: lobbyId }, { onConflict: "user_id,lobby_id", ignoreDuplicates: true });
    revalidatePath("/games");
  }
  return { ok: true };
}

/** Кнопка ♥ на странице лобби и в сохранённых. */
export async function setSaved(lobbyId: string, saved: boolean) {
  if (!isUuid(lobbyId)) return { ok: false };
  const { supabase, userId } = await requireUser();

  const { error } = saved
    ? await supabase
        .from("saved_lobbies")
        .upsert({ user_id: userId, lobby_id: lobbyId }, { onConflict: "user_id,lobby_id", ignoreDuplicates: true })
    : await supabase.from("saved_lobbies").delete().eq("user_id", userId).eq("lobby_id", lobbyId);
  if (error) return { ok: false };

  revalidatePath("/games");
  revalidatePath(`/lobby/${lobbyId}`);
  return { ok: true };
}

/** «Показать пропущенные снова» — забываем свайпы влево. */
export async function resetSkipped() {
  const { supabase, userId } = await requireUser();
  await supabase.from("swipes").delete().eq("user_id", userId).eq("direction", "left");
  revalidatePath("/search");
  return { ok: true };
}
