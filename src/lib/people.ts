import { getFollowingIds } from "@/lib/posts";
import { rankSuggestions, type SuggestedPerson, type SuggestionCandidate } from "@/lib/suggestions";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

const FIELDS = "id, username, full_name, avatar_url, city_id, sports";
const MAX_PEOPLE = 12;

/** «Возможно, знакомы»: без меня, моих подписок и всех, кто связан со мной блокировкой. */
export async function getSuggestedPeople(me: Pick<Profile, "id" | "city_id" | "sports">): Promise<SuggestedPerson[]> {
  const supabase = await createClient();
  const [following, played, city, recent] = await Promise.all([
    getFollowingIds(me.id),
    supabase.rpc("get_played_with_ids"),
    supabase.from("profiles").select(FIELDS).eq("city_id", me.city_id).neq("id", me.id).limit(60),
    supabase.from("profiles").select(FIELDS).neq("id", me.id).order("created_at", { ascending: false }).limit(40),
  ]);

  const playedIds = (played.data as string[] | null) ?? [];
  const { data: teammates } = playedIds.length
    ? await supabase.from("profiles").select(FIELDS).in("id", playedIds.slice(0, 40))
    : { data: [] };

  const ranked = rankSuggestions(
    [...((teammates ?? []) as SuggestionCandidate[]), ...((city.data ?? []) as SuggestionCandidate[]), ...((recent.data ?? []) as SuggestionCandidate[])],
    me,
    new Set(following),
    new Set(playedIds),
    new Date().toISOString().slice(0, 10),
  ).slice(0, MAX_PEOPLE + 6);

  // Заблокировавшего меня видно только через проверку в базе; при ошибке человека не показываем
  const checks = await Promise.all(
    ranked.map((p) => supabase.rpc("is_blocked_between", { p_a: me.id, p_b: p.id })),
  );
  return ranked.filter((_, i) => !checks[i].error && checks[i].data === false).slice(0, MAX_PEOPLE);
}
