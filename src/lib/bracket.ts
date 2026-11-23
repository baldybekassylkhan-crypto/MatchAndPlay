export interface BracketTeam {
  id: string;
  name: string;
  captain_id: string;
}

export interface BracketMatch {
  id: string;
  round: number;
  position: number;
  team_a_id: string | null;
  team_b_id: string | null;
  score_a: number | null;
  score_b: number | null;
  winner_id: string | null;
  status: "waiting" | "ready" | "finished" | "bye";
}

/** Название раунда: считаем от финала, потому что размер сетки бывает разным. */
export function roundName(round: number, totalRounds: number) {
  const fromEnd = totalRounds - round;
  if (fromEnd === 0) return "Финал";
  if (fromEnd === 1) return "Полуфинал";
  if (fromEnd === 2) return "1/4 финала";
  return `1/${2 ** fromEnd} финала`;
}

/** Матчи по раундам, внутри раунда — по позиции в сетке. */
export function groupRounds(matches: BracketMatch[]) {
  const rounds = new Map<number, BracketMatch[]>();
  for (const m of matches) rounds.set(m.round, [...(rounds.get(m.round) ?? []), m]);
  return [...rounds.entries()]
    .sort(([a], [b]) => a - b)
    .map(([round, list]) => ({ round, matches: [...list].sort((a, b) => a.position - b.position) }));
}

/** Пары матчей, победители которых встречаются в следующем раунде. */
export function pairMatches<T>(matches: T[]) {
  const pairs: T[][] = [];
  for (let i = 0; i < matches.length; i += 2) pairs.push(matches.slice(i, i + 2));
  return pairs;
}
