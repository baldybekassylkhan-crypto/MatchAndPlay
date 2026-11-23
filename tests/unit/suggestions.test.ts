import { describe, expect, it } from "vitest";
import { rankSuggestions, suggestionSlots, type SuggestionCandidate } from "@/lib/suggestions";

const person = (id: string, city_id: number, sports: SuggestionCandidate["sports"] = []): SuggestionCandidate => ({
  id,
  username: id,
  full_name: null,
  avatar_url: null,
  city_id,
  sports,
});
const me = { id: "me", city_id: 1, sports: ["football"] as SuggestionCandidate["sports"] };

describe("rankSuggestions", () => {
  it("ставит выше тех, с кем играли, затем общий спорт в городе", () => {
    const result = rankSuggestions(
      [person("far", 2), person("city", 1), person("sport", 1, ["football"]), person("played", 2)],
      me,
      new Set(),
      new Set(["played"]),
      "2026-11-24",
    );
    expect(result.map((p) => p.id)).toEqual(["played", "sport", "city", "far"]);
    expect(result[0].reason).toBe("Играли вместе");
  });

  it("не предлагает себя, подписки, заблокированных и дубли", () => {
    const result = rankSuggestions([person("me", 1), person("x", 1), person("ok", 1), person("ok", 1)], me, new Set(["x"]), new Set(), "d");
    expect(result.map((p) => p.id)).toEqual(["ok"]);
  });
});

describe("suggestionSlots", () => {
  it("ждёт, пока лента не загрузит нужный пост", () => {
    expect(suggestionSlots(2, 0, false, 2).size).toBe(0);
  });

  it("в короткой законченной ленте показывает первую группу после последнего поста", () => {
    expect([...suggestionSlots(2, 1, true, 2)]).toEqual([[1, 0]]);
    expect([...suggestionSlots(1, 0, true, 0)]).toEqual([[0, 0]]);
  });

  it("в длинной ленте разводит группы по разным местам", () => {
    const slots = [...suggestionSlots(2, 40, true, 7).keys()];
    expect(slots).toHaveLength(2);
    expect(slots[1] - slots[0]).toBeGreaterThanOrEqual(6);
  });
});
