import { describe, expect, it } from "vitest";
import { conversationItem, lobbyItems, mergeChats, type LobbyChatSource } from "@/lib/chat-list";
import type { ConversationRow } from "@/lib/crews";

const lobby = (id: string, status = "active"): LobbyChatSource => ({
  id,
  sport: "football",
  start_time: "2026-11-26T13:30:00Z",
  status,
  created_at: "2026-11-20T10:00:00Z",
});

describe("lobbyItems", () => {
  it("берёт последнее сообщение и помечает своё", () => {
    const [item] = lobbyItems(
      [lobby("a")],
      [
        { lobby_id: "a", user_id: "x", text: "старое", created_at: "2026-11-21T10:00:00Z" },
        { lobby_id: "a", user_id: "me", text: "новое", created_at: "2026-11-22T10:00:00Z" },
      ],
      new Set(["a"]),
      "me",
    );
    expect(item.preview).toBe("Вы: новое");
    expect(item.href).toBe("/lobby/a/chat");
    expect(item.unread).toBe(1);
  });

  it("убирает дубли и отменённые игры без переписки", () => {
    const items = lobbyItems([lobby("a"), lobby("a"), lobby("b", "cancelled")], [], new Set(), "me");
    expect(items.map((i) => i.key)).toEqual(["lobby-a"]);
  });
});

describe("mergeChats", () => {
  it("складывает все виды чатов в один столбец, свежие сверху", () => {
    const direct = conversationItem(
      {
        id: "d",
        kind: "direct",
        crew: null,
        other: { id: "o", username: "remve", full_name: null, avatar_url: null },
        last_text: "привет",
        last_user_id: "o",
        last_at: "2026-11-23T10:00:00Z",
        unread: 2,
      } as ConversationRow,
      "me",
    );
    const games = lobbyItems(
      [lobby("a")],
      [{ lobby_id: "a", user_id: "x", text: "кто идёт", created_at: "2026-11-24T10:00:00Z" }],
      new Set(),
      "me",
    );
    expect(mergeChats([direct], games).map((c) => c.kind)).toEqual(["lobby", "direct"]);
  });
});
