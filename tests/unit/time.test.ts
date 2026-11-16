import { describe, expect, it } from "vitest";
import {
  canLeaveGame,
  formatDay,
  formatPrice,
  formatShortDayTime,
  fromKzInputs,
  kzStartOfDay,
  plural,
  timeAgo,
  toKzInputs,
} from "@/lib/time";
import { MONDAY_2PM } from "./fixtures";

describe("время Казахстана (UTC+5)", () => {
  it("поля формы → UTC и обратно", () => {
    const d = fromKzInputs("2026-11-21", "19:00")!;
    expect(d.toISOString()).toBe("2026-11-21T14:00:00.000Z");
    expect(toKzInputs(d)).toEqual({ date: "2026-11-21", time: "19:00" });
  });

  it("полночь по Казахстану — это 19:00 UTC предыдущего дня", () => {
    expect(fromKzInputs("2026-11-21", "00:00")!.toISOString()).toBe("2026-11-20T19:00:00.000Z");
    expect(kzStartOfDay(1, MONDAY_2PM).toISOString()).toBe("2026-11-16T19:00:00.000Z");
  });

  it("неверные поля → null", () => {
    expect(fromKzInputs("21.11.2026", "19:00")).toBeNull();
    expect(fromKzInputs("2026-11-21", "7pm")).toBeNull();
  });

  it("подписи дней", () => {
    expect(formatDay("2026-11-16T15:00:00Z", MONDAY_2PM)).toBe("Сегодня");
    expect(formatDay("2026-11-17T15:00:00Z", MONDAY_2PM)).toBe("Завтра");
    expect(formatDay("2026-11-21T14:00:00Z", MONDAY_2PM)).toBe("Сб, 21 ноября");
    expect(formatShortDayTime("2026-11-21T14:00:00Z", MONDAY_2PM)).toBe("Сб 19:00");
    expect(formatShortDayTime("2026-12-03T14:00:00Z", MONDAY_2PM)).toBe("3 дек 19:00");
  });

  it("поздний вечер по UTC уже следующий день в Казахстане", () => {
    // 20:30 UTC понедельника = 01:30 вторника в Казахстане
    expect(formatDay("2026-11-16T20:30:00Z", MONDAY_2PM)).toBe("Завтра");
  });
});

describe("правило 30 минут", () => {
  const start = new Date(MONDAY_2PM.getTime() + 31 * 60_000);
  it("за 31 минуту отказаться можно", () => expect(canLeaveGame(start, MONDAY_2PM)).toBe(true));
  it("ровно за 30 минут ещё можно", () => {
    expect(canLeaveGame(new Date(MONDAY_2PM.getTime() + 30 * 60_000), MONDAY_2PM)).toBe(true);
  });
  it("за 29 минут уже нельзя", () => {
    expect(canLeaveGame(new Date(MONDAY_2PM.getTime() + 29 * 60_000), MONDAY_2PM)).toBe(false);
  });
});

describe("тексты", () => {
  it("склонения", () => {
    expect([1, 2, 5, 11, 21, 22, 25].map((n) => plural(n, ["игрок", "игрока", "игроков"]))).toEqual([
      "игрок",
      "игрока",
      "игроков",
      "игроков",
      "игрок",
      "игрока",
      "игроков",
    ]);
  });
  it("цена", () => {
    expect(formatPrice(null)).toBe("Бесплатно");
    expect(formatPrice(0)).toBe("Бесплатно");
    expect(formatPrice(2500).replace(/\s/g, " ")).toBe("2 500 ₸ с человека");
  });
  it("«сколько времени назад»", () => {
    expect(timeAgo(new Date(MONDAY_2PM.getTime() - 30_000), MONDAY_2PM)).toBe("только что");
    expect(timeAgo(new Date(MONDAY_2PM.getTime() - 5 * 60_000), MONDAY_2PM)).toBe("5 мин");
    expect(timeAgo(new Date(MONDAY_2PM.getTime() - 3 * 3_600_000), MONDAY_2PM)).toBe("3 ч");
  });
});
