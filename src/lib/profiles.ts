import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { MiniProfile, ProfileWithCity } from "@/lib/types";

export const getProfileByUsername = cache(async (username: string): Promise<ProfileWithCity | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*, city:cities(name_ru)")
    .eq("username", username.toLowerCase())
    .maybeSingle();
  return (data as ProfileWithCity | null) ?? null;
});

export async function getFollowCounts(profileId: string) {
  const supabase = await createClient();
  const [followers, following] = await Promise.all([
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", profileId),
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", profileId),
  ]);
  return { followers: followers.count ?? 0, following: following.count ?? 0 };
}

export async function isFollowing(followerId: string, followingId: string) {
  const supabase = await createClient();
  const { count } = await supabase
    .from("follows")
    .select("*", { count: "exact", head: true })
    .eq("follower_id", followerId)
    .eq("following_id", followingId);
  return (count ?? 0) > 0;
}

/** Список подписчиков (kind = followers) или подписок (kind = following). */
export async function getFollowList(profileId: string, kind: "followers" | "following"): Promise<MiniProfile[]> {
  const supabase = await createClient();
  const relation =
    kind === "followers"
      ? "person:profiles!follows_follower_id_fkey(id, username, full_name, avatar_url)"
      : "person:profiles!follows_following_id_fkey(id, username, full_name, avatar_url)";
  const { data } = await supabase
    .from("follows")
    .select(relation)
    .eq(kind === "followers" ? "following_id" : "follower_id", profileId)
    .order("created_at", { ascending: false })
    .limit(200);
  const rows = (data ?? []) as unknown as { person: MiniProfile | null }[];
  return rows.map((r) => r.person).filter((p): p is MiniProfile => p !== null);
}
