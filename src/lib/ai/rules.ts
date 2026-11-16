import { EMPTY_AI_QUERY, type AiQuery } from "@/lib/ai/query";
import type { SportId } from "@/lib/sports";
import { kzParts, toKzInputs } from "@/lib/time";
import type { City } from "@/lib/types";

/**
 * Запасной разбор запроса без ИИ — на правилах.
 * Срабатывает, если Gemini не настроен, недоступен, вернул ошибку или превышен лимит.
 */

const SPORT_RULES: [RegExp, SportId][] = [
  // \w и \b в JS не понимают кириллицу — используем \p{L} с флагом u
  [/настольн\p{L}*\s+теннис|пинг[\s-]?понг|настолк/u, "table_tennis"],
  [/футбол|футзал|футбик|мини[\s-]?футбол/, "football"],
  [/баскет|стритбол/, "basketball"],
  [/волейбол|волик/, "volleyball"],
  [/падел|padel/, "padel"],
  [/теннис|tennis/, "tennis"],
  [/хокке/, "hockey"],
  [/бадминтон/, "badminton"],
  [/(?<!\p{L})бег(?!\p{L})|пробежк|забег|бегать/u, "running"],
];

const WEEKDAY_RULES: [RegExp, number][] = [
  [/понедельник/, 1],
  [/вторник/, 2],
  [/сред[уаы]/, 3],
  [/четверг/, 4],
  [/пятниц/, 5],
  [/суббот/, 6],
  [/воскресень/, 0],
];

const WORD_NUMBERS: Record<string, number> = { двое: 2, трое: 3, четверо: 4, пятеро: 5, шестеро: 6 };

const pad = (n: number) => String(n).padStart(2, "0");

function cityStems(c: City) {
  return [c.name_ru, c.name_kz, ...c.aliases]
    .map((n) => n.toLowerCase().replace(/ё/g, "е"))
    .map((n) => n.slice(0, Math.max(4, n.length - 2)));
}

export function parseWithRules(input: string, cities: City[], now = new Date()): AiQuery {
  const t = ` ${input.toLowerCase().replace(/ё/g, "е")} `;
  const q: AiQuery = { ...EMPTY_AI_QUERY, sports: [], keywords: [] };
  const date = (offset: number) => toKzInputs(new Date(now.getTime() + offset * 86_400_000)).date;

  // Виды спорта
  let rest = t;
  for (const [re, id] of SPORT_RULES) {
    if (re.test(rest)) {
      q.sports.push(id);
      rest = rest.replace(re, " ");
    }
  }

  // Город
  const city = cities.find((c) => cityStems(c).some((s) => s.length >= 4 && t.includes(s)));
  if (city) q.city = city.name_ru;

  // Дата
  const wd = kzParts(now).weekday;
  if (/послезавтра/.test(t)) {
    q.date_from = q.date_to = date(2);
  } else if (/завтра|ертең/.test(t)) {
    q.date_from = q.date_to = date(1);
  } else if (/сегодня|бүгін/.test(t)) {
    q.date_from = q.date_to = date(0);
  } else if (/выходн|демалыс/.test(t)) {
    const toSat = wd === 0 ? 0 : (6 - wd + 7) % 7;
    q.date_from = date(toSat);
    q.date_to = date(wd === 0 ? 0 : toSat + 1);
  } else if (/(эт\p{L}+|на)\s+недел/u.test(t)) {
    q.date_from = date(0);
    q.date_to = date((7 - wd) % 7);
  } else {
    const hit = WEEKDAY_RULES.find(([re]) => re.test(t));
    if (hit) q.date_from = q.date_to = date((hit[1] - wd + 7) % 7);
  }

  // Время
  const range = /с\s*(\d{1,2})(?::\d{2})?\s*до\s*(\d{1,2})/.exec(t);
  const after = /после\s*(\d{1,2})/.exec(t);
  const before = /до\s*(\d{1,2})(?::\d{2})?(?!\s*(человек|чел|игрок|мест|\d))/.exec(t);
  const at = /(?<!\p{L})(?:в|около|к)\s*(\d{1,2})(?::(\d{2}))?\s*(?:час|ч(?!\p{L})|:|$|\s)/u.exec(t);
  const h = (s: string) => Math.min(23, Number(s));
  if (range) {
    q.time_from = `${pad(h(range[1]))}:00`;
    q.time_to = `${pad(Math.min(23, Number(range[2])))}:00`;
  } else if (after) {
    q.time_from = `${pad(h(after[1]))}:00`;
  } else if (before) {
    q.time_to = `${pad(h(before[1]))}:00`;
  } else if (at && Number(at[1]) >= 6) {
    const x = h(at[1]);
    q.time_from = `${pad(Math.max(0, x - 1))}:00`;
    q.time_to = `${pad(Math.min(23, x + 1))}:00`;
  } else if (/утр|таңертең/.test(t)) {
    q.time_from = "06:00";
    q.time_to = "12:00";
  } else if (/(?<!\p{L})дн[её]м(?!\p{L})|обед|түсте/u.test(t)) {
    q.time_from = "12:00";
    q.time_to = "17:00";
  } else if (/вечер|кешке|кеш(?!\p{L})/u.test(t)) {
    q.time_from = "17:00";
    q.time_to = "23:00";
  } else if (/ноч/.test(t)) {
    q.time_from = "21:00";
    q.time_to = "23:59";
  }

  // Игроки
  const maxp = /до\s*(\d{1,3})\s*(человек|чел|игрок)/.exec(t);
  if (maxp) q.max_players = Math.max(2, Math.min(100, Number(maxp[1])));
  const need = /нужн\p{L}*\s*(\d{1,2})\s*мест/u.exec(t);
  const us = /нас\s*(\d{1,2}|двое|трое|четверо|пятеро|шестеро)(?!\p{L})/u.exec(t);
  if (need) q.min_free_slots = Number(need[1]);
  else if (/с\s+друг|вдво[её]м/.test(t)) q.min_free_slots = 2;
  else if (us) q.min_free_slots = WORD_NUMBERS[us[1]] ?? Number(us[1]);
  if (q.min_free_slots !== null && (q.min_free_slots < 1 || q.min_free_slots > 50)) q.min_free_slots = null;

  // Уровень
  if (/новичк|начина/.test(t)) q.level = "beginner";
  else if (/любител|средн\p{L}* уров/u.test(t)) q.level = "amateur";
  else if (/профи|продвинут|сильн/.test(t)) q.level = "advanced";

  // Пара полезных слов
  for (const word of ["дружеск", "бесплатн", "крыт", "зал", "улиц"]) {
    const m = new RegExp(`${word}\\p{L}*`, "u").exec(t);
    if (m) q.keywords.push(m[0]);
  }
  q.keywords = q.keywords.slice(0, 3);

  return q;
}
