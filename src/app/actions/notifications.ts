"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAuthUserId } from "@/lib/supabase/auth-user";
import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createClient();
  const userId = await getAuthUserId(supabase);
  const user = userId ? { id: userId } : null;
  if (!user) redirect("/login");
  return { supabase, userId: user.id };
}

export async function markAllRead() {
  const { supabase, userId } = await requireUser();
  await supabase.from("notifications").update({ read: true }).eq("user_id", userId).eq("read", false);
  revalidatePath("/", "layout");
}

const subscriptionSchema = z.object({
  endpoint: z.url().startsWith("https://").max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
});

/** Сохраняем push-подписку устройства. Повторная подписка того же устройства переписывает старую. */
export async function savePushSubscription(raw: unknown, userAgent: string) {
  const parsed = subscriptionSchema.safeParse(raw);
  if (!parsed.success) return { ok: false };
  const { supabase } = await requireUser();
  const { endpoint, keys } = parsed.data;
  const { error } = await supabase.rpc("save_push_subscription", {
    p_endpoint: endpoint,
    p_p256dh: keys.p256dh,
    p_auth: keys.auth,
    p_user_agent: userAgent.slice(0, 300),
  });
  return { ok: !error };
}

export async function removePushSubscription(endpoint: string) {
  const { supabase } = await requireUser();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return { ok: true };
}
