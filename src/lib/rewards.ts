import type { SportId } from "@/lib/sports";
import { createClient } from "@/lib/supabase/server";

export interface RewardOffer {
  offer_id: string;
  title: string;
  description: string | null;
  games_required: number;
  sport: SportId | null;
  sponsor_name: string;
  sponsor_kind: "store" | "cafe" | "gym" | "services" | "other";
  sponsor_color: string;
  sponsor_address: string | null;
  progress: number;
  code: string | null;
  claimed_at: string | null;
  redeemed_at: string | null;
  sold_out: boolean;
}

export async function getMyRewards(): Promise<RewardOffer[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_my_rewards");
  return (data as RewardOffer[] | null) ?? [];
}

export async function getVerifiedThisMonth(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("verified_games_in_month", { p_user_id: userId });
  return Number(data ?? 0);
}

/** Ближайшая награда, до которой ещё не хватает игр. */
export function nextReward(offers: RewardOffer[]) {
  return offers
    .filter((o) => !o.code && !o.sold_out && o.progress < o.games_required)
    .sort((a, b) => a.games_required - a.progress - (b.games_required - b.progress))[0] ?? null;
}
