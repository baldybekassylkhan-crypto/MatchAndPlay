import { conversationItem, lobbyItems, mergeChats, type ChatListItem, type LobbyChatMessage, type LobbyChatSource } from "@/lib/chat-list";
import { getConversations } from "@/lib/crews";
import { createClient } from "@/lib/supabase/server";

const LOBBY_FIELDS = "id, sport, start_time, status, created_at";
/** Чат прошедшей игры остаётся в списке две недели. */
const KEEP_DAYS = 14;

async function getLobbyChats(userId: string): Promise<ChatListItem[]> {
  const supabase = await createClient();
  const since = new Date(Date.now() - KEEP_DAYS * 86_400_000).toISOString();
  const [hosted, joined] = await Promise.all([
    supabase.from("lobbies").select(LOBBY_FIELDS).eq("organizer_id", userId).gte("start_time", since).limit(40),
    supabase
      .from("lobby_applications")
      .select(`lobby:lobbies!inner(${LOBBY_FIELDS})`)
      .eq("user_id", userId)
      .eq("status", "accepted")
      .gte("lobby.start_time", since)
      .limit(40),
  ]);

  const lobbies = [
    ...((hosted.data as LobbyChatSource[] | null) ?? []),
    ...((joined.data as unknown as { lobby: LobbyChatSource | null }[] | null) ?? []).flatMap((r) => (r.lobby ? [r.lobby] : [])),
  ];
  if (lobbies.length === 0) return [];
  const ids = [...new Set(lobbies.map((l) => l.id))];

  const [messages, unread] = await Promise.all([
    supabase
      .from("lobby_messages")
      .select("lobby_id, user_id, text, created_at")
      .in("lobby_id", ids)
      .order("created_at", { ascending: false })
      .limit(400),
    supabase.from("notifications").select("payload").eq("user_id", userId).eq("type", "chat_message").eq("read", false).limit(100),
  ]);
  const unreadIds = new Set(
    ((unread.data as { payload: { lobby_id?: string } | null }[] | null) ?? []).flatMap((n) => (n.payload?.lobby_id ? [n.payload.lobby_id] : [])),
  );
  return lobbyItems(lobbies, (messages.data as LobbyChatMessage[] | null) ?? [], unreadIds, userId);
}

/** Все разговоры игрока: личные, команды и игры. */
export async function getAllChats(userId: string): Promise<ChatListItem[]> {
  const [conversations, lobbies] = await Promise.all([getConversations(), getLobbyChats(userId)]);
  return mergeChats(conversations.map((c) => conversationItem(c, userId)), lobbies);
}
