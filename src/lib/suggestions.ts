import { SPORTS, type SportId } from "@/lib/sports";

export interface SuggestionCandidate {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  city_id: number;
  sports: SportId[];
}

export interface SuggestedPerson {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  reason: string;
}

export const SUGGESTION_GROUP = 6;

/** Простое устойчивое число из строки: порядок не прыгает при каждом обновлении. */
export function hashText(text: string) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Сначала те, с кем играли, затем общий спорт и город. Равных перемешиваем на день. */
export function rankSuggestions(
  candidates: SuggestionCandidate[],
  me: { id: string; city_id: number; sports: SportId[] },
  excluded: Set<string>,
  playedWith: Set<string>,
  daySeed: string,
): SuggestedPerson[] {
  const seen = new Set<string>();
  return candidates
    .filter((c) => {
      if (c.id === me.id || excluded.has(c.id) || seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    })
    .map((c) => {
      const played = playedWith.has(c.id);
      const sameCity = c.city_id === me.city_id;
      const shared = (c.sports ?? []).filter((s) => me.sports.includes(s));
      const sport = shared[0] ? SPORTS[shared[0]]?.label : null;
      const reason = played
        ? "Играли вместе"
        : sameCity && sport
          ? `${sport}, ваш город`
          : sameCity
            ? "Ваш город"
            : sport
              ? `Тоже играет: ${sport.toLowerCase()}`
              : "Новый игрок";
      const score = (played ? 100 : 0) + (sameCity ? 20 : 0) + Math.min(shared.length, 3) * 10;
      const { id, username, full_name, avatar_url } = c;
      return { person: { id, username, full_name, avatar_url, reason }, score, tie: hashText(daySeed + c.id) };
    })
    .sort((a, b) => b.score - a.score || a.tie - b.tie)
    .map((x) => x.person);
}

/**
 * После какого поста показать каждую группу людей.
 * Место выглядит случайным, но не меняется при подгрузке ленты.
 */
export function suggestionSlots(groups: number, postCount: number, done: boolean, seed: number) {
  const slots = new Map<number, number>();
  let after = 1 + (seed % 3);
  for (let group = 0; group < groups; group++) {
    if (after <= postCount) slots.set(after, group);
    else if (group === 0 && done) slots.set(postCount, group);
    else break;
    after += 6 + ((seed >>> (group + 2)) % 4);
  }
  return slots;
}
