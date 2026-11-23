"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isUuid } from "@/lib/crews";
import { SPORT_IDS } from "@/lib/sports";
import { getAuthUserId } from "@/lib/supabase/auth-user";
import { createClient } from "@/lib/supabase/server";
import { fromKzInputs } from "@/lib/time";
import { fieldErrors } from "@/lib/validation";

export interface CrewFormState {
  error: string | null;
  fields?: Record<string, string>;
}

const DB_ERRORS: Record<string, string> = {
  too_many_crews: "Можно быть капитаном не больше чем в 5 командах",
  crew_name_taken: "Такое название уже занято",
  crew_not_found: "Команда не найдена",
  crew_removed: "Капитан убрал вас из этой команды",
  crew_full: "В команде уже 50 игроков",
  user_blocked: "Это действие недоступно",
  not_captain: "Это может сделать только капитан",
  already_decided: "Решение уже принято",
  cannot_remove_captain: "Капитана убрать нельзя",
  same_crew: "Нельзя вызвать свою команду",
  bad_challenge_time: "Матч можно назначить не раньше чем через час и не дальше чем на 60 дней",
  challenge_exists: "Вы уже отправили вызов этой команде",
  challenge_not_found: "Вызов не найден",
  lobby_started: "Время матча уже прошло",
  lobby_cancelled: "Матч отменён",
  lobby_full: "В матче уже нет мест",
  was_rejected: "Организатор убрал вас из этого матча",
  crew_match_only: "В этот матч могут вступить только игроки двух команд",
  cannot_message: "Написать можно тем, кто подписан на вас, или с кем вы играли либо состоите в команде",
  too_many_messages: "Слишком много сообщений. Подождите минуту.",
};

function dbError(message: string | undefined) {
  const code = Object.keys(DB_ERRORS).find((k) => message?.includes(k));
  return code ? DB_ERRORS[code] : "Что-то пошло не так. Попробуйте ещё раз.";
}

async function requireUser() {
  const supabase = await createClient();
  const userId = await getAuthUserId(supabase);
  if (!userId) redirect("/login");
  return { supabase, userId };
}

const text = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");

const crewSchema = z.object({
  name: z.string().min(3, "Минимум 3 символа").max(30, "Не больше 30 символов"),
  description: z.string().max(200, "Не больше 200 символов"),
  sport: z.enum(SPORT_IDS, { message: "Выберите вид спорта" }),
  city_id: z.coerce.number().int().min(1, "Выберите город"),
  is_open: z.boolean(),
});

export async function createCrew(_prev: CrewFormState, formData: FormData): Promise<CrewFormState> {
  const { supabase } = await requireUser();
  const parsed = crewSchema.safeParse({
    name: text(formData.get("name")),
    description: text(formData.get("description")),
    sport: text(formData.get("sport")),
    city_id: text(formData.get("city_id")),
    is_open: text(formData.get("is_open")) !== "closed",
  });
  if (!parsed.success) return { error: "Проверьте выделенные поля", fields: fieldErrors(parsed.error) };

  const { data, error } = await supabase.rpc("create_crew", {
    p_name: parsed.data.name,
    p_description: parsed.data.description,
    p_sport: parsed.data.sport,
    p_city_id: parsed.data.city_id,
    p_is_open: parsed.data.is_open,
  });
  if (error || !data) return { error: dbError(error?.message) };
  revalidatePath("/crews");
  redirect(`/crews/${data}`);
}

async function crewRpc(fn: string, args: Record<string, unknown>, crewId: string) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { ok: false as const, error: dbError(error.message) };
  revalidatePath(`/crews/${crewId}`);
  revalidatePath("/crews");
  return { ok: true as const, data };
}

export async function joinCrew(crewId: string) {
  if (!isUuid(crewId)) return { ok: false as const, error: DB_ERRORS.crew_not_found };
  return crewRpc("join_crew", { p_crew_id: crewId }, crewId);
}

export async function leaveCrew(crewId: string) {
  if (!isUuid(crewId)) return { ok: false as const, error: DB_ERRORS.crew_not_found };
  return crewRpc("leave_crew", { p_crew_id: crewId }, crewId);
}

export async function decideCrewMember(crewId: string, userId: string, accept: boolean) {
  if (!isUuid(crewId) || !isUuid(userId)) return { ok: false as const, error: DB_ERRORS.crew_not_found };
  return crewRpc("decide_crew_member", { p_crew_id: crewId, p_user_id: userId, p_accept: accept }, crewId);
}

export async function removeCrewMember(crewId: string, userId: string) {
  if (!isUuid(crewId) || !isUuid(userId)) return { ok: false as const, error: DB_ERRORS.crew_not_found };
  return crewRpc("remove_crew_member", { p_crew_id: crewId, p_user_id: userId }, crewId);
}

const challengeSchema = z.object({
  from_crew: z.uuid("Выберите свою команду"),
  to_crew: z.uuid(),
  start: z.date({ message: "Укажите дату и время" }),
  location: z.string().min(2, "Укажите площадку").max(120, "Не больше 120 символов"),
  team_size: z.coerce.number().int().min(1, "Минимум 1").max(25, "Не больше 25"),
  message: z.string().max(200, "Не больше 200 символов"),
});

export async function createChallenge(_prev: CrewFormState, formData: FormData): Promise<CrewFormState> {
  const { supabase } = await requireUser();
  const parsed = challengeSchema.safeParse({
    from_crew: text(formData.get("from_crew")),
    to_crew: text(formData.get("to_crew")),
    start: fromKzInputs(text(formData.get("date")), text(formData.get("time"))) ?? undefined,
    location: text(formData.get("location")),
    team_size: text(formData.get("team_size")),
    message: text(formData.get("message")),
  });
  if (!parsed.success) return { error: "Проверьте выделенные поля", fields: fieldErrors(parsed.error) };

  const { error } = await supabase.rpc("create_crew_challenge", {
    p_from_crew: parsed.data.from_crew,
    p_to_crew: parsed.data.to_crew,
    p_start: parsed.data.start.toISOString(),
    p_location: parsed.data.location,
    p_team_size: parsed.data.team_size,
    p_message: parsed.data.message,
  });
  if (error) return { error: dbError(error.message) };
  revalidatePath(`/crews/${parsed.data.to_crew}`);
  revalidatePath(`/crews/${parsed.data.from_crew}`);
  redirect(`/crews/${parsed.data.to_crew}?challenged=1`);
}

export async function respondChallenge(challengeId: string, accept: boolean, crewId: string) {
  if (!isUuid(challengeId) || !isUuid(crewId)) return { ok: false as const, error: DB_ERRORS.challenge_not_found };
  const res = await crewRpc("respond_crew_challenge", { p_challenge_id: challengeId, p_accept: accept }, crewId);
  if (res.ok && res.data) redirect(`/lobby/${res.data}`);
  return res;
}

export async function cancelChallenge(challengeId: string, crewId: string) {
  if (!isUuid(challengeId) || !isUuid(crewId)) return { ok: false as const, error: DB_ERRORS.challenge_not_found };
  return crewRpc("cancel_crew_challenge", { p_challenge_id: challengeId }, crewId);
}

export async function joinCrewMatch(lobbyId: string) {
  if (!isUuid(lobbyId)) return { ok: false as const, error: "Матч не найден" };
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("join_crew_match", { p_lobby_id: lobbyId });
  if (error) return { ok: false as const, error: dbError(error.message) };
  revalidatePath(`/lobby/${lobbyId}`);
  revalidatePath("/games");
  return { ok: true as const };
}

export async function openDirectChat(userId: string) {
  if (!isUuid(userId)) return { ok: false as const, error: "Игрок не найден" };
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("start_direct_chat", { p_user_id: userId });
  if (error || !data) return { ok: false as const, error: dbError(error?.message) };
  redirect(`/messages/${data}`);
}

export async function sendChatMessage(conversationId: string, value: string) {
  if (!isUuid(conversationId)) return { ok: false as const, error: "Чат не найден" };
  const clean = value.trim();
  if (!clean) return { ok: false as const, error: "Пустое сообщение" };
  if (clean.length > 1000) return { ok: false as const, error: "Не больше 1000 символов" };

  const { supabase, userId } = await requireUser();
  const { data, error } = await supabase
    .from("chat_messages")
    .insert({ conversation_id: conversationId, user_id: userId, text: clean })
    .select("id, conversation_id, user_id, text, created_at")
    .single();
  if (error || !data) {
    return { ok: false as const, error: error?.message.includes("row-level") ? "Вы больше не участник этого чата" : dbError(error?.message) };
  }
  return { ok: true as const, message: data };
}

export async function markConversationRead(conversationId: string) {
  if (!isUuid(conversationId)) return;
  const { supabase } = await requireUser();
  await supabase.rpc("mark_conversation_read", { p_conversation_id: conversationId });
}
