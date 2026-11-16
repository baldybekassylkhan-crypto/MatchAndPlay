import { describe, expect, it } from "vitest";
import { lobbySchema, profileSchema, safeNext } from "@/lib/validation";

const validProfile = {
  username: "Aidos_10",
  full_name: "",
  bio: "",
  city_id: "1",
  sports: ["football"],
  level: "amateur",
  avatar_url: null,
};

describe("профиль", () => {
  it("ник приводится к нижнему регистру, пустые поля → null", () => {
    const p = profileSchema.parse(validProfile);
    expect(p.username).toBe("aidos_10");
    expect(p.full_name).toBeNull();
    expect(p.city_id).toBe(1);
  });

  it.each(["ab", "очень_длинный", "with space", "a".repeat(21)])("ник «%s» не проходит", (username) => {
    expect(profileSchema.safeParse({ ...validProfile, username }).success).toBe(false);
  });

  it("без вида спорта и города — ошибка", () => {
    expect(profileSchema.safeParse({ ...validProfile, sports: [] }).success).toBe(false);
    expect(profileSchema.safeParse({ ...validProfile, city_id: "" }).success).toBe(false);
  });
});

describe("лобби", () => {
  const valid = {
    sport: "football",
    description: "Нас 4, нужны ещё 2",
    players_current: "4",
    players_needed: "2",
    start_time: new Date(Date.now() + 3 * 3_600_000),
    duration_min: 90,
    city_id: "1",
    location_name: "Стадион",
    lat: null,
    lng: null,
    level: null,
    price_kzt: null,
  };

  it("корректная игра проходит", () => expect(lobbySchema.safeParse(valid).success).toBe(true));
  it("игра раньше чем через 15 минут — ошибка", () => {
    expect(lobbySchema.safeParse({ ...valid, start_time: new Date(Date.now() + 5 * 60_000) }).success).toBe(false);
  });
  it("игра дальше 60 дней — ошибка", () => {
    expect(lobbySchema.safeParse({ ...valid, start_time: new Date(Date.now() + 61 * 86_400_000) }).success).toBe(false);
  });
  it("отрицательная цена — ошибка", () => {
    expect(lobbySchema.safeParse({ ...valid, price_kzt: -100 }).success).toBe(false);
  });
});

describe("безопасный редирект после входа", () => {
  it.each([
    ["/games", "/games"],
    [null, "/"],
    ["https://evil.example", "/"],
    ["//evil.example", "/"],
  ])("%s → %s", (input, expected) => expect(safeNext(input)).toBe(expected));
});
