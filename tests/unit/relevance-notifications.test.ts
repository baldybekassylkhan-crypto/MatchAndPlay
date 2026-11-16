import { describe, expect, it } from "vitest";
import { EMPTY_FILTERS } from "@/lib/filters";
import { renderNotification } from "@/lib/notifications";
import { matchReason, rankLobbies, relaxFilters } from "@/lib/relevance";
import { lobbySlots } from "@/lib/types";
import { lobby } from "./fixtures";

describe("заполненность лобби", () => {
  it("6 своих + 1 принят из 2 нужных → 7/8, 1 место", () => {
    expect(lobbySlots(lobby({ accepted_count: 1 }))).toEqual({ total: 8, joined: 7, free: 1 });
  });
});

describe("релевантность", () => {
  it("ключевое слово поднимает игру выше, при равенстве — по времени", () => {
    const a = lobby({ id: "a", description: "Обычная игра", start_time: "2026-11-21T10:00:00Z" });
    const b = lobby({ id: "b", description: "Дружеский матч", start_time: "2026-11-21T12:00:00Z" });
    const c = lobby({ id: "c", description: "Ещё игра", start_time: "2026-11-21T09:00:00Z" });
    expect(rankLobbies([a, b, c], { ...EMPTY_FILTERS, kw: ["дружеская"] }).map((l) => l.id)).toEqual(["b", "c", "a"]);
  });

  it("пометка «почему подходит»", () => {
    const reason = matchReason(lobby({ accepted_count: 0 }), { ...EMPTY_FILTERS, kw: ["дружеская"] });
    expect(reason).toMatch(/19:00 · 8 игроков · 2 места · #дружеская$/);
  });

  it("смягчение: ±2 часа, ±1 день, без лимита игроков", () => {
    const r = relaxFilters({ ...EMPTY_FILTERS, day: "2030-06-15", hours: { from: 18, to: 21 }, maxp: 10, free: 3 })!;
    expect(r.day).toBe("2030-06-14_2030-06-16");
    expect(r.hours).toEqual({ from: 16, to: 23 });
    expect(r.maxp).toBeNull();
    expect(r.free).toBe(1);
  });

  it("если смягчать нечего — похожих вариантов нет", () => {
    expect(relaxFilters({ ...EMPTY_FILTERS, sports: ["football"] })).toBeNull();
  });
});

describe("тексты уведомлений", () => {
  const base = { lobby_id: "L1", sport: "football" as const, start_time: "2026-11-21T14:00:00Z", actor: "aidos", location: "Поле" };

  it.each([
    ["application_new", "/lobby/L1"],
    ["application_accepted", "/lobby/L1"],
    ["application_rejected", "/search"],
    ["player_left", "/lobby/L1"],
    ["lobby_cancelled", "/lobby/L1"],
    ["lobby_updated", "/lobby/L1"],
    ["reminder_2h", "/lobby/L1"],
    ["reminder_30m", "/lobby/L1"],
    ["follow", "/u/aidos"],
  ])("%s ведёт на %s", (type, href) => {
    const r = renderNotification({ type, payload: base });
    expect(r.href).toBe(href);
    expect(r.title.length).toBeGreaterThan(3);
    expect(r.body).not.toMatch(/undefined|null/);
  });

  it("напоминание за 2 часа называет крайний срок отмены", () => {
    expect(renderNotification({ type: "reminder_2h", payload: base }).body).toContain("до 18:30");
  });

  it("изменения перечислены по-русски", () => {
    expect(renderNotification({ type: "lobby_updated", payload: { ...base, changes: ["time", "place"] } }).body).toContain(
      "изменено время, место",
    );
  });

  it("комментарий ведёт к комментариям поста", () => {
    expect(renderNotification({ type: "comment", payload: { post_id: "P1", actor: "dana", text: "Класс" } }).href).toBe(
      "/p/P1#comments",
    );
  });

  it("неизвестный тип не падает", () => {
    expect(renderNotification({ type: "something_new", payload: {} }).href).toBe("/notifications");
  });
});
