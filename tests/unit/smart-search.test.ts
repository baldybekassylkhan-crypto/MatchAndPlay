import { describe, expect, it } from "vitest";
import { aiQuerySchema, aiQueryToFilters, EMPTY_AI_QUERY, findCity, isMeaningful } from "@/lib/ai/query";
import { parseWithRules } from "@/lib/ai/rules";
import { filtersToQuery } from "@/lib/filters";
import { CITIES, MONDAY_2PM } from "./fixtures";

const parse = (text: string) => {
  const q = parseWithRules(text, CITIES, MONDAY_2PM);
  const f = aiQueryToFilters(q, text, CITIES, { city: null, dist: null }, MONDAY_2PM);
  return filtersToQuery({ ...f, ai: "" });
};

describe("разбор запроса по правилам (без ИИ)", () => {
  it.each([
    ["баскетбол в субботу, где-то вечером, желательно до 10 человек", "?day=2026-11-21&sports=basketball&hours=17-23&maxp=10"],
    ["футбол завтра в Караганде после 19:00", "?city=4&day=2026-11-17&sports=football&hours=19-24"],
    ["мини-футбол на выходных, нас двое", "?day=2026-11-21_2026-11-22&sports=football&free=2"],
    ["теннис сегодня с 18 до 21 для новичков", "?day=2026-11-16&sports=tennis&hours=18-21&level=beginner"],
    ["пинг-понг в Өскемен утром", "?city=8&sports=table_tennis&hours=6-12"],
    ["настольный теннис днём, нужно 2 места", "?sports=table_tennis&hours=12-17&free=2"],
    ["пробежка в 7 утра", "?sports=running&hours=6-8"],
    ["волейбол на этой неделе вечером, нас трое", "?day=2026-11-16_2026-11-22&sports=volleyball&hours=17-23&free=3"],
    ["хоккей в Орал послезавтра", "?city=13&day=2026-11-18&sports=hockey"],
  ])("«%s»", (text, expected) => {
    expect(parse(text)).toBe(expected);
  });

  it("ничего не распознано → обычный текстовый поиск", () => {
    expect(isMeaningful(parseWithRules("хочу поиграть", CITIES, MONDAY_2PM))).toBe(false);
  });
});

describe("ответ Gemini", () => {
  it("ошибка в одном поле не ломает остальные", () => {
    const q = aiQuerySchema.parse({
      sports: ["football", "chess"],
      city: "Астана",
      date_from: "завтра",
      time_from: "19:00",
      max_players: "десять",
      keywords: ["Дружеская", "a", "#крытое,"],
    });
    expect(q.sports).toEqual(["football"]);
    expect(q.date_from).toBeNull();
    expect(q.time_from).toBe("19:00");
    expect(q.max_players).toBeNull();
    expect(q.keywords).toEqual(["дружеская", "крытое"]);
  });

  it("совсем пустой ответ — пустой запрос", () => {
    expect(aiQuerySchema.parse({})).toEqual(EMPTY_AI_QUERY);
  });

  it("город по старому и казахскому названию", () => {
    expect(findCity(CITIES, "Нур-Султан")?.id).toBe(1);
    expect(findCity(CITIES, "Қарағанды")?.id).toBe(4);
    expect(findCity(CITIES, "Париж")).toBeNull();
  });

  it("23:59 → до конца дня; даты в прошлом и далёком будущем обрезаются", () => {
    const f = aiQueryToFilters(
      { ...EMPTY_AI_QUERY, time_from: "21:00", time_to: "23:59", date_from: "2026-01-01", date_to: "2027-12-31" },
      "ночью",
      CITIES,
      { city: null, dist: 5 },
      MONDAY_2PM,
    );
    expect(f.hours).toEqual({ from: 21, to: 24 });
    expect(f.day).toBe("2026-11-16_2027-01-15");
    expect(f.dist).toBe(5);
  });

  it("«с 22 до 1 ночи» не ломает интервал", () => {
    const f = aiQueryToFilters({ ...EMPTY_AI_QUERY, time_from: "22:00", time_to: "01:00" }, "x", CITIES, { city: null, dist: null }, MONDAY_2PM);
    expect(f.hours).toEqual({ from: 22, to: 24 });
  });
});
