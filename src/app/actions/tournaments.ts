"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { SPORT_IDS } from "@/lib/sports";
import { getAuthUserId } from "@/lib/supabase/auth-user";
import { createClient } from "@/lib/supabase/server";
import { fromKzInputs } from "@/lib/time";
import { fieldErrors } from "@/lib/validation";

export interface TournamentFormState {
  error: string | null;
  fields?: Record<string, string>;
}

const DB_ERRORS: Record<string, string> = {
  registration_in_past: "Конец регистрации должен быть в будущем",
  registration_after_start: "Регистрация должна закончиться до начала турнира",
  start_too_far: "Турнир можно назначить не дальше чем на 180 дней",
  too_many_pending: "У вас уже 3 турнира на модерации. Дождитесь решения",
  not_organizer: "Это может сделать только организатор",
  tournament_locked: "Этот турнир уже нельзя изменить",
  not_admin: "Это может сделать только модератор",
  tournament_not_found: "Турнир не найден",
  already_reviewed: "По этому турниру уже есть решение",
  reason_required: "Напишите причину отказа",
  registration_closed: "Регистрация закрыта",
  user_blocked: "Это действие недоступно",
  already_registered: "Вы уже записали команду",
  tournament_full: "Все места в турнире заняты",
  not_captain: "Записать команду может только её капитан",
  team_name_taken: "Команда с таким названием уже записана",
  team_not_found: "Команда не найдена",
  not_enough_teams: "Для старта нужно минимум 2 команды",
  match_not_found: "Матч не найден",
  match_not_ready: "В этом матче ещё нет двух соперников",
  bad_score: "Проверьте счёт",
  winner_required: "При ничьей выберите победителя",
  next_match_played: "Следующий матч уже сыгран, поэтому победителя изменить нельзя",
};

function dbError(message: string | undefined) {
  const code = Object.keys(DB_ERRORS).find((k) => message?.includes(k));
  return code ? DB_ERRORS[code] : "Что-то пошло не так. Попробуйте ещё раз.";
}

const isUuid = (id: string) => /^[0-9a-f-]{36}$/i.test(id);
const text = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");
const numOrNull = (v: FormDataEntryValue | null) => {
  const s = text(v);
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

async function requireUser() {
  const supabase = await createClient();
  if (!(await getAuthUserId(supabase))) redirect("/login");
  return supabase;
}

const schema = z.object({
  name: z.string().min(3, "Минимум 3 символа").max(60, "Не больше 60 символов"),
  description: z.string().min(10, "Опишите турнир подробнее").max(1000, "Не больше 1000 символов"),
  rules: z.string().max(1000, "Не больше 1000 символов"),
  sport: z.enum(SPORT_IDS, { message: "Выберите вид спорта" }),
  city_id: z.coerce.number().int().min(1, "Выберите город"),
  location_name: z.string().min(2, "Укажите площадку").max(120, "Не больше 120 символов"),
  starts_at: z.date({ message: "Укажите дату и время начала" }),
  registration_ends_at: z.date({ message: "Укажите конец регистрации" }),
  max_teams: z.coerce.number().refine((n) => [4, 8, 16, 32].includes(n), "Выберите размер сетки"),
  team_size: z.coerce.number().int().min(1, "Минимум 1").max(25, "Не больше 25"),
  entry_fee: z.coerce.number().int().min(0, "Не может быть меньше 0").max(1_000_000, "Слишком большая сумма"),
  prize: z.string().max(200, "Не больше 200 символов"),
  contact: z.string().min(3, "Укажите телефон или Telegram").max(100, "Не больше 100 символов"),
});

export async function saveTournament(_prev: TournamentFormState, formData: FormData): Promise<TournamentFormState> {
  const supabase = await requireUser();
  const parsed = schema.safeParse({
    name: text(formData.get("name")),
    description: text(formData.get("description")),
    rules: text(formData.get("rules")),
    sport: text(formData.get("sport")),
    city_id: text(formData.get("city_id")),
    location_name: text(formData.get("location_name")),
    starts_at: fromKzInputs(text(formData.get("start_date")), text(formData.get("start_time"))) ?? undefined,
    registration_ends_at: fromKzInputs(text(formData.get("reg_date")), text(formData.get("reg_time"))) ?? undefined,
    max_teams: text(formData.get("max_teams")),
    team_size: text(formData.get("team_size")),
    entry_fee: text(formData.get("entry_fee")) || 0,
    prize: text(formData.get("prize")),
    contact: text(formData.get("contact")),
  });
  if (!parsed.success) return { error: "Проверьте выделенные поля", fields: fieldErrors(parsed.error) };

  const id = text(formData.get("id"));
  if (id && !isUuid(id)) return { error: DB_ERRORS.tournament_not_found };
  const d = parsed.data;
  const { data, error } = await supabase.rpc("save_tournament", {
    p_id: id || null,
    p_name: d.name,
    p_description: d.description,
    p_rules: d.rules,
    p_sport: d.sport,
    p_city_id: d.city_id,
    p_location: d.location_name,
    p_lat: numOrNull(formData.get("lat")),
    p_lng: numOrNull(formData.get("lng")),
    p_starts_at: d.starts_at.toISOString(),
    p_registration_ends_at: d.registration_ends_at.toISOString(),
    p_max_teams: d.max_teams,
    p_team_size: d.team_size,
    p_entry_fee: d.entry_fee,
    p_prize: d.prize,
    p_contact: d.contact,
  });
  if (error || !data) return { error: dbError(error?.message) };
  revalidatePath("/tournaments");
  revalidatePath("/admin/tournaments");
  redirect(`/tournaments/${data}?sent=1`);
}

async function call(fn: string, args: Record<string, unknown>, tournamentId: string) {
  const supabase = await requireUser();
  const { error } = await supabase.rpc(fn, args);
  if (error) return { ok: false as const, error: dbError(error.message) };
  revalidatePath(`/tournaments/${tournamentId}`);
  revalidatePath("/tournaments");
  revalidatePath("/admin/tournaments");
  return { ok: true as const };
}

export async function reviewTournament(id: string, approve: boolean, reason: string) {
  if (!isUuid(id)) return { ok: false as const, error: DB_ERRORS.tournament_not_found };
  return call("review_tournament", { p_id: id, p_approve: approve, p_reason: reason.slice(0, 300) }, id);
}

export async function registerTeam(id: string, name: string, crewId: string | null) {
  const clean = name.trim();
  if (!isUuid(id) || (crewId && !isUuid(crewId))) return { ok: false as const, error: DB_ERRORS.tournament_not_found };
  if (clean.length < 2 || clean.length > 40) return { ok: false as const, error: "Название команды: от 2 до 40 символов" };
  return call("register_tournament_team", { p_tournament_id: id, p_name: clean, p_crew_id: crewId }, id);
}

export async function withdrawTeam(teamId: string, tournamentId: string) {
  if (!isUuid(teamId) || !isUuid(tournamentId)) return { ok: false as const, error: DB_ERRORS.team_not_found };
  return call("withdraw_tournament_team", { p_team_id: teamId }, tournamentId);
}

export async function startTournament(id: string) {
  if (!isUuid(id)) return { ok: false as const, error: DB_ERRORS.tournament_not_found };
  return call("start_tournament", { p_id: id }, id);
}

export async function cancelTournament(id: string) {
  if (!isUuid(id)) return { ok: false as const, error: DB_ERRORS.tournament_not_found };
  return call("cancel_tournament", { p_id: id }, id);
}

export async function reportMatch(matchId: string, tournamentId: string, scoreA: number, scoreB: number, winnerId: string | null) {
  if (!isUuid(matchId) || !isUuid(tournamentId)) return { ok: false as const, error: DB_ERRORS.match_not_found };
  if (![scoreA, scoreB].every((n) => Number.isInteger(n) && n >= 0 && n <= 999)) return { ok: false as const, error: DB_ERRORS.bad_score };
  return call("report_tournament_match", { p_match_id: matchId, p_score_a: scoreA, p_score_b: scoreB, p_winner: winnerId }, tournamentId);
}
