import { describe, expect, it } from "vitest";
import { groupRounds, pairMatches, roundName, type BracketMatch } from "@/lib/bracket";

const match = (round: number, position: number): BracketMatch => ({
  id: `${round}-${position}`,
  round,
  position,
  team_a_id: null,
  team_b_id: null,
  score_a: null,
  score_b: null,
  winner_id: null,
  status: "waiting",
});

describe("турнирная сетка", () => {
  it("называет раунды от финала", () => {
    expect([1, 2, 3, 4, 5].map((r) => roundName(r, 5))).toEqual(["1/16 финала", "1/8 финала", "1/4 финала", "Полуфинал", "Финал"]);
    expect(roundName(1, 1)).toBe("Финал");
  });

  it("сортирует раунды и матчи", () => {
    const rounds = groupRounds([match(2, 0), match(1, 1), match(1, 0)]);
    expect(rounds.map((r) => r.round)).toEqual([1, 2]);
    expect(rounds[0].matches.map((m) => m.position)).toEqual([0, 1]);
  });

  it("собирает пары для линий сетки", () => {
    expect(pairMatches([1, 2, 3, 4])).toEqual([[1, 2], [3, 4]]);
    expect(pairMatches([1])).toEqual([[1]]);
  });
});
