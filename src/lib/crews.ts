import { cache } from "react";
import type { SportId } from "@/lib/sports";
import { createClient } from "@/lib/supabase/server";
import type { MiniProfile } from "@/lib/types";

export interface Crew {
  id: string;
  name: string;
  description: string | null;
  sport: SportId;
  city_id: number;
  captain_id: string;
  is_open: boolean;
  member_count: number;
  created_at: string;
  city?: { name_ru: string } | null;
}

export type MemberStatus = "pending" | "active" | "removed";

export interface CrewMember {
  crew_id: string;
  user_id: string;
  role: "captain" | "member";
  status: MemberStatus;
  joined_at: string;
  user: MiniProfile | null;
}

export interface CrewChallenge {
  id: string;
  from_crew_id: string;
  to_crew_id: string;
  sport: SportId;
  start_time: string;
  location_name: string;
  team_size: number;
  message: string | null;
  status: "pending" | "accepted" | "declined" | "cancelled";
  lobby_id: string | null;
  from_crew: { id: string; name: string } | null;
  to_crew: { id: string; name: string } | null;
}

export interface ConversationRow {
  id: string;
  kind: "crew" | "direct";
  crew: { id: string; name: string; sport: SportId; member_count: number } | null;
  other: MiniProfile | null;
  last_text: string | null;
  last_user_id: string | null;
  last_at: string;
  unread: number;
}

const CREW_SELECT = "*, city:cities(name_ru)";
const MEMBER_SELECT = "*, user:profiles!crew_members_user_id_fkey(id, username, full_name, avatar_url)";
const CHALLENGE_SELECT =
  "*, from_crew:crews!crew_challenges_from_crew_id_fkey(id, name), to_crew:crews!crew_challenges_to_crew_id_fkey(id, name)";

export const isUuid = (id: string) => /^[0-9a-f-]{36}$/i.test(id);

export const getCrew = cache(async (id: string): Promise<Crew | null> => {
  if (!isUuid(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("crews").select(CREW_SELECT).eq("id", id).maybeSingle();
  return (data as Crew | null) ?? null;
});

/** Команды, в которых я состою. */
export async function getMyCrews(userId: string): Promise<Crew[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("crew_members")
    .select(`crew:crews!inner(${CREW_SELECT})`)
    .eq("user_id", userId)
    .eq("status", "active")
    .order("joined_at", { ascending: false });
  return ((data as unknown as { crew: Crew | null }[] | null) ?? []).map((r) => r.crew).filter((c): c is Crew => c !== null);
}

/** Другие команды моего города, самые большие сверху. */
export async function getCityCrews(cityId: number, excludeIds: string[]): Promise<Crew[]> {
  const supabase = await createClient();
  let query = supabase.from("crews").select(CREW_SELECT).eq("city_id", cityId).order("member_count", { ascending: false }).limit(30);
  if (excludeIds.length) query = query.not("id", "in", `(${excludeIds.join(",")})`);
  const { data } = await query;
  return (data as Crew[] | null) ?? [];
}

/** Состав команды. Заявки в закрытую команду видит только капитан и сам заявитель (RLS). */
export async function getCrewMembers(crewId: string): Promise<CrewMember[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("crew_members")
    .select(MEMBER_SELECT)
    .eq("crew_id", crewId)
    .in("status", ["active", "pending", "removed"])
    .order("joined_at");
  return (data as CrewMember[] | null) ?? [];
}

export async function getCrewChallenges(crewId: string): Promise<CrewChallenge[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("crew_challenges")
    .select(CHALLENGE_SELECT)
    .or(`from_crew_id.eq.${crewId},to_crew_id.eq.${crewId}`)
    .in("status", ["pending", "accepted"])
    .gt("start_time", new Date(Date.now() - 3 * 3_600_000).toISOString())
    .order("start_time")
    .limit(20);
  return (data as CrewChallenge[] | null) ?? [];
}

/** Команды, от имени которых я могу бросить вызов. */
export async function getCaptainCrews(userId: string): Promise<Crew[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("crews").select(CREW_SELECT).eq("captain_id", userId).order("created_at");
  return (data as Crew[] | null) ?? [];
}

export async function getConversations(): Promise<ConversationRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_my_conversations");
  return (data as ConversationRow[] | null) ?? [];
}

/** Матч команд: кто играет и может ли текущий игрок подтвердить участие. */
export async function getCrewMatch(challengeId: string, userId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("crew_challenges").select(CHALLENGE_SELECT).eq("id", challengeId).maybeSingle();
  const challenge = data as CrewChallenge | null;
  if (!challenge) return null;
  const { count } = await supabase
    .from("crew_members")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "active")
    .in("crew_id", [challenge.from_crew_id, challenge.to_crew_id]);
  return { challenge, canJoin: (count ?? 0) > 0 };
}
