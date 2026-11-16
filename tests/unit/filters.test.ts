import { describe, expect, it } from "vitest";
import {
  countActiveFilters,
  dayRange,
  EMPTY_FILTERS,
  filterChips,
  filtersToQuery,
  matchesTime,
  parseFilters,
} from "@/lib/filters";
import { MONDAY_2PM } from "./fixtures";

const fromQuery = (q: string) => parseFilters(Object.fromEntries(new URLSearchParams(q)));

describe("фильтры в адресной строке", () => {
  it("туда и обратно без потерь", () => {
    const q =
      "?ai=%D1%84%D1%83%D1%82%D0%B1%D0%BE%D0%BB&city=4&day=2026-11-21_2026-11-22&sports=football,basketball&times=evening&hours=18-21&dist=5&level=amateur&maxp=10&free=2&kw=%D0%B7%D0%B0%D0%BB&mode=swipe";
    const f = fromQuery(q);
    expect(f.city).toBe(4);
    expect(f.sports).toEqual(["football", "basketball"]);
    expect(f.hours).toEqual({ from: 18, to: 21 });
    // URLSearchParams кодирует запятую как %2C — сравниваем смысл, а не строку
    const again = filtersToQuery(f, "swipe");
    expect(again).toContain("mode=swipe");
    expect(fromQuery(again)).toEqual(f);
  });

  it("мусор отбрасывается", () => {
    const f = fromQuery("city=abc&day=вчера&sports=chess,football&times=night&dist=7&level=pro&maxp=1&free=0&hours=22-20");
    expect(f).toEqual({ ...EMPTY_FILTERS, sports: ["football"] });
  });

  it("счётчик активных фильтров не учитывает город и текст", () => {
    expect(countActiveFilters({ ...EMPTY_FILTERS, city: 2, q: "мяч", ai: "x" })).toBe(0);
    expect(countActiveFilters({ ...EMPTY_FILTERS, day: "today", sports: ["football", "tennis"], dist: 2 })).toBe(4);
  });

  it("чип убирает ровно своё значение", () => {
    const f = { ...EMPTY_FILTERS, sports: ["football" as const, "tennis" as const], day: "today" };
    const football = filterChips(f).find((c) => c.key === "s-football")!;
    expect(football.without.sports).toEqual(["tennis"]);
    expect(football.without.day).toBe("today");
  });
});

describe("интервалы дат", () => {
  it("«выходные» в понедельник — ближайшие суббота и воскресенье", () => {
    const r = dayRange("weekend", MONDAY_2PM);
    expect(r.from.toISOString()).toBe("2026-11-20T19:00:00.000Z"); // Сб 00:00 KZ
    expect(r.to.toISOString()).toBe("2026-11-22T19:00:00.000Z"); // Пн 00:00 KZ
  });

  it("«выходные» в субботу — с текущего момента", () => {
    const saturday = new Date("2026-11-21T06:00:00Z");
    expect(dayRange("weekend", saturday).from).toEqual(saturday);
  });

  it("«сегодня» начинается с текущего момента, а не с полуночи", () => {
    expect(dayRange("today", MONDAY_2PM).from).toEqual(MONDAY_2PM);
  });

  it("прошедшая дата не показывает прошедшие игры", () => {
    expect(dayRange("2026-11-16", MONDAY_2PM).from).toEqual(MONDAY_2PM);
  });
});

describe("время суток", () => {
  const at = (h: number) => `2026-11-21T${String(h - 5).padStart(2, "0")}:30:00Z`; // h:30 по KZ
  it("вечер 17–23", () => {
    expect(matchesTime(at(19), { times: ["evening"], hours: null })).toBe(true);
    expect(matchesTime(at(16), { times: ["evening"], hours: null })).toBe(false);
  });
  it("точный интервал часов", () => {
    expect(matchesTime(at(20), { times: [], hours: { from: 18, to: 21 } })).toBe(true);
    expect(matchesTime(at(21), { times: [], hours: { from: 18, to: 21 } })).toBe(false);
  });
});
