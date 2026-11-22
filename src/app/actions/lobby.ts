"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthUserId } from "@/lib/supabase/auth-user";
import { createClient } from "@/lib/supabase/server";
import { fromKzInputs } from "@/lib/time";
import { fieldErrors, lobbySchema } from "@/lib/validation";

export interface LobbyFormState {
  error: string | null;
  fields?: Record<string, string>;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
}

/** Коды ошибок из SQL-функций → понятный текст. */
const DB_ERRORS: Record<string, string> = {
  not_authenticated: "Войдите в аккаунт",
  lobby_not_found: "Игра не найдена",
  own_lobby: "Это ваша игра",
  lobby_cancelled: "Игра отменена организатором",
  lobby_started: "Игра уже началась",
  lobby_full: "Все места уже заняты",
  already_applied: "Вы уже подали заявку",
  was_rejected: "Организатор уже отклонил вашу заявку",
  message_too_long: "Сообщение слишком длинное",
  application_not_found: "Заявка не найдена",
  not_organizer: "Это может сделать только организатор",
  already_decided: "По заявке уже есть решение",
  too_late_to_leave: "Отменить участие можно не позднее чем за 30 минут до начала игры",
  lobby_locked: "Эту игру уже нельзя изменить",
  start_in_past: "Время начала уже прошло",
  needed_below_accepted: "Нельзя искать меньше игроков, чем уже принято",
};

function dbError(message: string | undefined) {
  const code = Object.keys(DB_ERRORS).find((k) => message?.includes(k));
  return code ? DB_ERRORS[code] : "Что-то пошло не так. Попробуйте ещё раз.";
}

const text = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");
const numOrNull = (v: FormDataEntryValue | null) => {
  const s = text(v);
  if (s === "") return null;
  const n = Number(s.replace(/\s/g, ""));
  return Number.isFinite(n) ? n : NaN;
};

function parseLobbyForm(formData: FormData) {
  const start = fromKzInputs(text(formData.get("date")), text(formData.get("time")));
  const level = text(formData.get("level"));
  return lobbySchema.safeParse({
    sport: text(formData.get("sport")),
    description: text(formData.get("description")),
    players_current: text(formData.get("players_current")),
    players_needed: text(formData.get("players_needed")),
    start_time: start ?? undefined,
    duration_min: text(formData.get("duration_min")) || 90,
    city_id: text(formData.get("city_id")),
    location_name: text(formData.get("location_name")),
    lat: numOrNull(formData.get("lat")),
    lng: numOrNull(formData.get("lng")),
    level: level === "" ? null : level,
    price_kzt: numOrNull(formData.get("price_kzt")),
  });
}

async function requireUser() {
  const supabase = await createClient();
  const userId = await getAuthUserId(supabase);
  const user = userId ? { id: userId } : null;
  if (!user) redirect("/login");
  return { supabase, user };
}

export async function saveLobby(_prev: LobbyFormState, formData: FormData): Promise<LobbyFormState> {
  const { supabase, user } = await requireUser();
  const parsed = parseLobbyForm(formData);
  if (!parsed.success) {
    const fields = fieldErrors(parsed.error);
    return { error: "Проверьте выделенные поля", fields };
  }

  const row = { ...parsed.data, start_time: parsed.data.start_time.toISOString() };
  const lobbyId = text(formData.get("lobby_id"));

  if (lobbyId) {
    const { error } = await supabase.from("lobbies").update(row).eq("id", lobbyId).eq("organizer_id", user.id);
    if (error) return { error: dbError(error.message) };
    revalidatePath(`/lobby/${lobbyId}`);
    revalidatePath("/games");
    redirect(`/lobby/${lobbyId}`);
  }

  const { data, error } = await supabase
    .from("lobbies")
    .insert({ ...row, organizer_id: user.id })
    .select("id")
    .single();
  if (error || !data) return { error: dbError(error?.message) };

  revalidatePath("/search");
  revalidatePath("/games");
  redirect(`/lobby/${data.id}?created=1`);
}

async function rpc(fn: string, args: Record<string, unknown>, lobbyId: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, error: dbError(error.message) };
  revalidatePath(`/lobby/${lobbyId}`);
  revalidatePath("/games");
  revalidatePath("/search");
  return { ok: true };
}

export async function applyToLobby(lobbyId: string, message: string) {
  return rpc("apply_to_lobby", { p_lobby_id: lobbyId, p_message: message.slice(0, 200) }, lobbyId);
}

export async function decideApplication(applicationId: string, accept: boolean, lobbyId: string) {
  return rpc("decide_application", { p_application_id: applicationId, p_accept: accept }, lobbyId);
}

export async function cancelApplication(applicationId: string, lobbyId: string) {
  return rpc("cancel_application", { p_application_id: applicationId }, lobbyId);
}

export async function cancelLobby(lobbyId: string) {
  return rpc("cancel_lobby", { p_lobby_id: lobbyId }, lobbyId);
}
