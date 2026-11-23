import type { ConversationRow } from "@/lib/crews";
import { SPORTS, type SportId } from "@/lib/sports";
import { formatShortDayTime } from "@/lib/time";
import type { MiniProfile } from "@/lib/types";

/** Одна строка общего списка: личный чат, чат команды или чат игры. */
export interface ChatListItem {
  key: string;
  kind: "direct" | "crew" | "lobby";
  href: string;
  title: string;
  preview: string;
  mine: boolean;
  at: string;
  /** У чатов игр точное число неизвестно: 1 означает «есть новые» */
  unread: number;
  sport: SportId | null;
  other: MiniProfile | null;
}

export interface LobbyChatSource {
  id: string;
  sport: SportId;
  start_time: string;
  status: string;
  created_at: string;
}

export interface LobbyChatMessage {
  lobby_id: string;
  user_id: string;
  text: string;
  created_at: string;
}

const EMPTY = "Сообщений пока нет";

export function conversationItem(c: ConversationRow, myId: string): ChatListItem {
  const mine = c.last_user_id === myId;
  return {
    key: c.id,
    kind: c.kind,
    href: `/messages/${c.id}`,
    title: (c.kind === "crew" ? c.crew?.name : `@${c.other?.username}`) ?? "Чат",
    preview: c.last_text ? `${mine ? "Вы: " : ""}${c.last_text}` : EMPTY,
    mine,
    at: c.last_at,
    unread: c.unread,
    sport: c.crew?.sport ?? null,
    other: c.other,
  };
}

/** Чаты игр: отменённые без переписки не показываем. */
export function lobbyItems(
  lobbies: LobbyChatSource[],
  messages: LobbyChatMessage[],
  unreadLobbyIds: Set<string>,
  myId: string,
  now: Date = new Date(),
): ChatListItem[] {
  const last = new Map<string, LobbyChatMessage>();
  for (const m of messages) {
    const current = last.get(m.lobby_id);
    if (!current || m.created_at > current.created_at) last.set(m.lobby_id, m);
  }

  const seen = new Set<string>();
  const out: ChatListItem[] = [];
  for (const l of lobbies) {
    if (seen.has(l.id)) continue;
    seen.add(l.id);
    const message = last.get(l.id);
    if (l.status === "cancelled" && !message) continue;
    const mine = message?.user_id === myId;
    out.push({
      key: `lobby-${l.id}`,
      kind: "lobby",
      href: `/lobby/${l.id}/chat`,
      title: `${SPORTS[l.sport]?.label ?? "Игра"} · ${formatShortDayTime(l.start_time, now)}`,
      preview: message ? `${mine ? "Вы: " : ""}${message.text}` : EMPTY,
      mine,
      at: message?.created_at ?? l.created_at,
      unread: unreadLobbyIds.has(l.id) ? 1 : 0,
      sport: l.sport,
      other: null,
    });
  }
  return out;
}

/** Один столбец: свежие разговоры сверху. */
export function mergeChats(...lists: ChatListItem[][]) {
  return lists.flat().sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}
