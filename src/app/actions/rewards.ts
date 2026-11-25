"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthUserId } from "@/lib/supabase/auth-user";
import { createClient } from "@/lib/supabase/server";

const ERRORS: Record<string, string> = {
  not_enough_games: "Пока не хватает подтверждённых игр в этом месяце.",
  sold_out: "Награды на этот месяц закончились.",
  offer_not_found: "Награда больше не доступна.",
  not_admin: "Только для партнёров и модераторов.",
};

async function requireUser() {
  const supabase = await createClient();
  if (!(await getAuthUserId(supabase))) redirect("/login");
  return supabase;
}

export async function claimReward(offerId: string) {
  const supabase = await requireUser();
  const { data, error } = await supabase.rpc("claim_reward", { p_offer_id: offerId });
  if (error || !data) {
    const key = Object.keys(ERRORS).find((k) => error?.message.includes(k));
    return { ok: false as const, error: key ? ERRORS[key] : "Не удалось получить награду. Попробуйте ещё раз." };
  }
  revalidatePath("/rewards");
  return { ok: true as const, code: String(data) };
}

export async function redeemRewardCode(code: string) {
  const supabase = await requireUser();
  const { data, error } = await supabase.rpc("redeem_reward_code", { p_code: code.trim().slice(0, 20) });
  if (error) {
    const key = Object.keys(ERRORS).find((k) => error.message.includes(k));
    return { ok: false as const, error: key ? ERRORS[key] : "Не удалось проверить код." };
  }
  const r = data as { status: "ok" | "used" | "not_found"; redeemed_at?: string };
  return { ok: true as const, status: r.status, redeemedAt: r.redeemed_at ?? null };
}
