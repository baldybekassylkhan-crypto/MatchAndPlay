"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { checkinMessage, type ShakeStatus } from "@/lib/checkin";
import { getAuthUserId } from "@/lib/supabase/auth-user";
import { createClient } from "@/lib/supabase/server";

const UUID_RE = /^[0-9a-f-]{36}$/i;

interface Position {
  lat: number;
  lng: number;
  accuracy: number;
}

async function requireUser() {
  const supabase = await createClient();
  if (!(await getAuthUserId(supabase))) redirect("/login");
  return supabase;
}

const validPosition = (p: Position) =>
  [p.lat, p.lng, p.accuracy].every(Number.isFinite) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;

/** Отметка встряхиванием: база сама проверяет расстояние до точки игры или до организатора. */
export async function shakeCheckIn(lobbyId: string, pos: Position) {
  if (!UUID_RE.test(lobbyId) || !validPosition(pos)) return { ok: false as const, error: "Не удалось определить место" };
  const supabase = await requireUser();
  const { data, error } = await supabase.rpc("shake_check_in", {
    p_lobby_id: lobbyId,
    p_lat: pos.lat,
    p_lng: pos.lng,
    p_accuracy: pos.accuracy,
  });
  if (error || !data) return { ok: false as const, error: "Не удалось отметиться. Попробуйте ещё раз." };
  const r = data as { status: ShakeStatus; method?: string; distance?: number | null; accuracy?: number | null; host?: boolean };
  if (r.status === "ok" || r.status === "already") {
    revalidatePath(`/lobby/${lobbyId}`);
    return { ok: true as const, method: r.method ?? null, distance: r.distance ?? null };
  }
  return { ok: false as const, error: checkinMessage(r) ?? "Не удалось отметиться", host: Boolean(r.host) };
}

/** Организатор держит отметку открытой: обновляем его точку, возвращаем число отметившихся. */
export async function updateOrganizerPosition(lobbyId: string, pos: Position) {
  if (!UUID_RE.test(lobbyId) || !validPosition(pos)) return { ok: false as const };
  const supabase = await requireUser();
  const { data, error } = await supabase.rpc("update_organizer_position", {
    p_lobby_id: lobbyId,
    p_lat: pos.lat,
    p_lng: pos.lng,
    p_accuracy: pos.accuracy,
  });
  if (error) return { ok: false as const };
  return { ok: true as const, count: Number(data) };
}
