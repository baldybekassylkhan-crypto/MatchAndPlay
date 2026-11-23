import { cache } from "react";
import type { BracketMatch, BracketTeam } from "@/lib/bracket";
import type { SportId } from "@/lib/sports";
import { createClient } from "@/lib/supabase/server";
import type { MiniProfile } from "@/lib/types";

export type TournamentStatus = "pending" | "rejected" | "registration" | "in_progress" | "finished" | "cancelled";

export interface Tournament {
  id: string;
  organizer_id: string;
  name: string;
  description: string;
  rules: string | null;
  sport: SportId;
  city_id: number;
  location_name: string;
  lat: number | null;
  lng: number | null;
  starts_at: string;
  registration_ends_at: string;
  max_teams: number;
  team_size: number;
  entry_fee_kzt: number;
  prize: string | null;
  status: TournamentStatus;
  rejection_reason: string | null;
  winner_team_id: string | null;
  created_at: string;
  organizer?: MiniProfile | null;
  city?: { name_ru: string } | null;
  teams?: { count: number }[];
}

export type TournamentTeam = BracketTeam & {
  crew_id: string | null;
  captain: { username: string; avatar_url: string | null } | null;
};

const SELECT =
  "*, organizer:profiles!tournaments_organizer_id_fkey(id, username, full_name, avatar_url), city:cities(name_ru), teams:tournament_teams(count)";

const isUuid = (id: string) => /^[0-9a-f-]{36}$/i.test(id);

export const isAppAdmin = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("is_app_admin");
  return data === true;
});

export const getTournament = cache(async (id: string): Promise<Tournament | null> => {
  if (!isUuid(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("tournaments").select(SELECT).eq("id", id).maybeSingle();
  return (data as Tournament | null) ?? null;
});

export async function getTournamentTeams(id: string): Promise<TournamentTeam[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tournament_teams")
    .select("id, name, captain_id, crew_id, captain:profiles!tournament_teams_captain_id_fkey(username, avatar_url)")
    .eq("tournament_id", id)
    .order("created_at");
  return (data as unknown as TournamentTeam[] | null) ?? [];
}

export async function getTournamentMatches(id: string): Promise<BracketMatch[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tournament_matches")
    .select("id, round, position, team_a_id, team_b_id, score_a, score_b, winner_id, status")
    .eq("tournament_id", id)
    .order("round")
    .order("position");
  return (data as BracketMatch[] | null) ?? [];
}

/** Контакт видят только организатор и модератор (RLS). */
export async function getTournamentContact(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("tournament_contacts").select("contact").eq("tournament_id", id).maybeSingle();
  return (data?.contact as string | undefined) ?? null;
}

/** Идущие и открытые турниры города, затем недавно завершённые. */
export async function getCityTournaments(cityId: number): Promise<Tournament[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tournaments")
    .select(SELECT)
    .eq("city_id", cityId)
    .in("status", ["registration", "in_progress", "finished"])
    .gt("starts_at", new Date(Date.now() - 30 * 86_400_000).toISOString())
    .order("starts_at")
    .limit(50);
  const order: Record<string, number> = { in_progress: 0, registration: 1, finished: 2 };
  return ((data as Tournament[] | null) ?? []).sort((a, b) => order[a.status] - order[b.status]);
}

export async function getMyTournaments(userId: string): Promise<Tournament[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tournaments")
    .select(SELECT)
    .eq("organizer_id", userId)
    .order("created_at", { ascending: false })
    .limit(30);
  return (data as Tournament[] | null) ?? [];
}

export async function getPendingTournaments(): Promise<(Tournament & { contact: string | null })[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tournaments")
    .select(`${SELECT}, contact:tournament_contacts(contact)`)
    .eq("status", "pending")
    .order("created_at")
    .limit(100);
  const rows = (data as unknown as (Tournament & { contact: { contact: string } | { contact: string }[] | null })[] | null) ?? [];
  return rows.map((row) => {
    const value = Array.isArray(row.contact) ? row.contact[0] : row.contact;
    return { ...row, contact: value?.contact ?? null };
  });
}
