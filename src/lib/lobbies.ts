import { cache } from "react";
import { dayRange, matchesTime, type LobbyFilters, type SearchMode } from "@/lib/filters";
import { rankLobbies, relaxFilters } from "@/lib/relevance";
import { createClient } from "@/lib/supabase/server";
import { lobbySlots, type ApplicationWithLobby, type ApplicationWithUser, type LobbyWithMeta } from "@/lib/types";

export const LOBBY_SELECT =
  "*, organizer:profiles!lobbies_organizer_id_fkey(id, username, full_name, avatar_url), city:cities(name_ru)";

const APP_USER_SELECT = "*, user:profiles!lobby_applications_user_id_fkey(id, username, full_name, avatar_url)";

/** Текст для ilike: экранируем спецсимволы и убираем то, что ломает синтаксис фильтра PostgREST. */
function likePattern(q: string) {
  const clean = q.replace(/[,()*:"\\]/g, " ").replace(/[%_]/g, (m) => `\\${m}`).trim();
  return clean ? `%${clean}%` : null;
}

/**
 * Поиск игр по фильтрам.
 * mode = "swipe": только лобби со свободными местами, без уже просмотренных карточек и своих игр.
 * Фильтр по расстоянию применяется на устройстве (координаты пользователя не уходят на сервер).
 */
export async function searchLobbies(
  filters: LobbyFilters,
  cityId: number,
  opts: { mode: SearchMode; userId: string; limit?: number },
): Promise<LobbyWithMeta[]> {
  const supabase = await createClient();
  const { from, to } = dayRange(filters.day);

  const swipe = opts.mode === "swipe";
  let query = supabase
    .from("lobbies")
    // В свайпах сразу подтягиваем мои свайпы и заявки (отфильтрованы по мне ниже) — без второго запроса
    .select(swipe ? `${LOBBY_SELECT}, my_swipe:swipes(user_id), my_app:lobby_applications(user_id)` : LOBBY_SELECT)
    .eq("city_id", cityId)
    .in("status", opts.mode === "swipe" ? ["active"] : ["active", "full"])
    .gt("start_time", from.toISOString())
    .lt("start_time", to.toISOString())
    .order("start_time")
    .limit(opts.limit ?? 200);

  if (filters.sports.length) query = query.in("sport", filters.sports);
  if (filters.level) query = query.or(`level.is.null,level.eq.${filters.level}`);
  const pattern = likePattern(filters.q);
  if (pattern) query = query.or(`description.ilike.${pattern},location_name.ilike.${pattern}`);
  if (swipe) {
    query = query
      .neq("organizer_id", opts.userId)
      .eq("my_swipe.user_id", opts.userId)
      .eq("my_app.user_id", opts.userId);
  }

  const { data } = await query;
  let lobbies = ((data as LobbyWithMeta[] | null) ?? []).filter((l) => {
    if (!matchesTime(l.start_time, filters)) return false;
    const { total, free } = lobbySlots(l);
    if (filters.maxp && total > filters.maxp) return false;
    if (filters.free && free < filters.free) return false;
    return true;
  });

  if (opts.mode === "swipe") {
    // Мои свайпы и заявки пришли вместе с лобби (см. select выше) — убираем уже просмотренные
    lobbies = lobbies.filter((l) => {
      const seen = l as LobbyWithMeta & { my_swipe?: unknown[]; my_app?: unknown[] };
      return !seen.my_swipe?.length && !seen.my_app?.length;
    });
  }

  return lobbies.map((l) => {
    const { my_swipe: _s, my_app: _a, ...rest } = l as LobbyWithMeta & { my_swipe?: unknown; my_app?: unknown };
    void _s;
    void _a;
    return rest as LobbyWithMeta;
  });
}

/**
 * Поиск с ранжированием по релевантности.
 * Если точных совпадений меньше трёх, добавляем «Похожие варианты» со смягчёнными условиями.
 */
export async function rankedSearch(
  filters: LobbyFilters,
  cityId: number,
  opts: { mode: SearchMode; userId: string },
): Promise<{ main: LobbyWithMeta[]; similar: LobbyWithMeta[] }> {
  const main = rankLobbies(await searchLobbies(filters, cityId, opts), filters);
  if (main.length >= 3) return { main, similar: [] };

  const relaxed = relaxFilters(filters);
  if (!relaxed) return { main, similar: [] };
  const ids = new Set(main.map((l) => l.id));
  const similar = rankLobbies(
    (await searchLobbies(relaxed, cityId, opts)).filter((l) => !ids.has(l.id)),
    filters,
  ).slice(0, 20);
  return { main, similar };
}

/** Сохранённые лобби: только будущие и со свободными местами. */
export async function getSavedLobbies(userId: string): Promise<LobbyWithMeta[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("saved_lobbies")
    .select(`created_at, lobby:lobbies!inner(${LOBBY_SELECT})`)
    .eq("user_id", userId)
    .eq("lobby.status", "active")
    .gt("lobby.start_time", new Date().toISOString())
    .limit(200);
  const rows = (data as unknown as { lobby: LobbyWithMeta | null }[] | null) ?? [];
  return rows
    .map((r) => r.lobby)
    .filter((l): l is LobbyWithMeta => l !== null)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
}

export async function isLobbySaved(userId: string, lobbyId: string) {
  const supabase = await createClient();
  const { count } = await supabase
    .from("saved_lobbies")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("lobby_id", lobbyId);
  return (count ?? 0) > 0;
}

export const getLobby = cache(async (id: string): Promise<LobbyWithMeta | null> => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("lobbies").select(LOBBY_SELECT).eq("id", id).maybeSingle();
  return (data as LobbyWithMeta | null) ?? null;
});

/** Заявки лобби, видимые текущему пользователю (RLS: организатор видит все, остальные — принятых и свою). */
export async function getLobbyApplications(lobbyId: string): Promise<ApplicationWithUser[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lobby_applications")
    .select(APP_USER_SELECT)
    .eq("lobby_id", lobbyId)
    .order("created_at");
  return (data as ApplicationWithUser[] | null) ?? [];
}

/** Мои заявки на будущие игры. */
export async function getMyApplications(userId: string): Promise<ApplicationWithLobby[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lobby_applications")
    .select(`*, lobby:lobbies!inner(${LOBBY_SELECT})`)
    .eq("user_id", userId)
    .in("status", ["pending", "accepted", "rejected"])
    .gt("lobby.start_time", new Date(Date.now() - 3 * 3_600_000).toISOString())
    .order("created_at", { ascending: false })
    .limit(100);
  const rows = (data as ApplicationWithLobby[] | null) ?? [];
  return rows.sort((a, b) => (a.lobby?.start_time ?? "").localeCompare(b.lobby?.start_time ?? ""));
}

/** Мои будущие лобби + число заявок, ожидающих решения. */
export async function getMyLobbies(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lobbies")
    .select(LOBBY_SELECT)
    .eq("organizer_id", userId)
    .in("status", ["active", "full", "cancelled"])
    .gt("start_time", new Date(Date.now() - 3 * 3_600_000).toISOString())
    .order("start_time")
    .limit(100);
  const lobbies = (data as LobbyWithMeta[] | null) ?? [];
  if (lobbies.length === 0) return [];

  const { data: pending } = await supabase
    .from("lobby_applications")
    .select("lobby_id")
    .in(
      "lobby_id",
      lobbies.map((l) => l.id),
    )
    .eq("status", "pending");
  const counts = new Map<string, number>();
  for (const row of pending ?? []) counts.set(row.lobby_id, (counts.get(row.lobby_id) ?? 0) + 1);

  return lobbies.map((l) => ({ ...l, pendingCount: counts.get(l.id) ?? 0 }));
}

/** Игры за последние 30 дней, которые уже начались и в которых я участвовал, — для хайлайтов. */
export async function getRecentPlayedGames(userId: string): Promise<LobbyWithMeta[]> {
  const supabase = await createClient();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const nowIso = new Date().toISOString();
  const [organized, joined] = await Promise.all([
    supabase
      .from("lobbies")
      .select(LOBBY_SELECT)
      .eq("organizer_id", userId)
      .neq("status", "cancelled")
      .gt("start_time", since)
      .lte("start_time", nowIso)
      .limit(30),
    supabase
      .from("lobby_applications")
      .select(`lobby:lobbies!inner(${LOBBY_SELECT})`)
      .eq("user_id", userId)
      .eq("status", "accepted")
      .neq("lobby.status", "cancelled")
      .gt("lobby.start_time", since)
      .lte("lobby.start_time", nowIso)
      .limit(30),
  ]);
  const list = [
    ...((organized.data as LobbyWithMeta[] | null) ?? []),
    ...(((joined.data as unknown as { lobby: LobbyWithMeta | null }[] | null) ?? [])
      .map((r) => r.lobby)
      .filter(Boolean) as LobbyWithMeta[]),
  ];
  return list.sort((a, b) => b.start_time.localeCompare(a.start_time));
}

/** Сыгранные игры: где я был организатором или принятым игроком. */
export async function getGameHistory(userId: string): Promise<LobbyWithMeta[]> {
  const supabase = await createClient();
  const [organized, joined] = await Promise.all([
    supabase.from("lobbies").select(LOBBY_SELECT).eq("organizer_id", userId).eq("status", "finished").limit(50),
    supabase
      .from("lobby_applications")
      .select(`lobby:lobbies!inner(${LOBBY_SELECT})`)
      .eq("user_id", userId)
      .eq("status", "accepted")
      .eq("lobby.status", "finished")
      .limit(50),
  ]);
  const list = [
    ...((organized.data as LobbyWithMeta[] | null) ?? []),
    ...(((joined.data as unknown as { lobby: LobbyWithMeta | null }[] | null) ?? [])
      .map((r) => r.lobby)
      .filter(Boolean) as LobbyWithMeta[]),
  ];
  return list.sort((a, b) => b.start_time.localeCompare(a.start_time));
}
