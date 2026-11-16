import "server-only";

import { GoogleGenAI, ThinkingLevel, Type, type ThinkingConfig } from "@google/genai";
import { aiQuerySchema, type AiQuery } from "@/lib/ai/query";
import { SPORT_IDS, SPORTS } from "@/lib/sports";
import { kzParts, toKzInputs } from "@/lib/time";
import type { City } from "@/lib/types";

const API_KEY = process.env.GEMINI_API_KEY ?? "";
// gemini-2.5-flash с конца 2026 недоступна новым пользователям; псевдоним *-latest
// всегда указывает на актуальную быструю модель.
const MODEL = process.env.GEMINI_MODEL || "gemini-flash-lite-latest";
const TIMEOUT_MS = 7000;

export const geminiConfigured = Boolean(API_KEY);

const WEEKDAYS = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];

/** Ответ модели строго по схеме. */
const responseSchema = {
  type: Type.OBJECT,
  properties: {
    sports: { type: Type.ARRAY, items: { type: Type.STRING, enum: [...SPORT_IDS] } },
    city: { type: Type.STRING, nullable: true },
    date_from: { type: Type.STRING, nullable: true, description: "YYYY-MM-DD" },
    date_to: { type: Type.STRING, nullable: true, description: "YYYY-MM-DD" },
    time_from: { type: Type.STRING, nullable: true, description: "HH:MM, 24 часа" },
    time_to: { type: Type.STRING, nullable: true, description: "HH:MM, 24 часа" },
    max_players: { type: Type.INTEGER, nullable: true },
    min_free_slots: { type: Type.INTEGER, nullable: true },
    level: { type: Type.STRING, nullable: true, enum: ["beginner", "amateur", "advanced"] },
    keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ["sports", "city", "date_from", "date_to", "time_from", "time_to", "max_players", "min_free_slots", "level", "keywords"],
  propertyOrdering: ["sports", "city", "date_from", "date_to", "time_from", "time_to", "max_players", "min_free_slots", "level", "keywords"],
};

const SYSTEM = `Ты — парсер поисковых запросов спортивного приложения Match&Play (Казахстан).
Пользователь ищет игру (лобби), к которой можно присоединиться. Переведи запрос в JSON по схеме.
Запрос может быть на русском, казахском или смеси языков, с опечатками.

Правила:
- sports: id видов спорта из списка ниже. Синонимы: мини-футбол/футзал/футбик → football; стритбол → basketball;
  пинг-понг/настолка → table_tennis; пробежка/забег → running. Если вид спорта не указан — [].
- city: точное русское название города из списка, если он упомянут (учитывай старые названия и казахские варианты). Иначе null.
- Даты — по календарю ниже (время Казахстана, UTC+5).
  «сегодня» → сегодняшняя дата; «завтра» → завтра; «в субботу» → ближайшая суббота (сегодня, если сегодня суббота);
  «на выходных» → ближайшие суббота и воскресенье (date_from — суббота, date_to — воскресенье);
  «на этой неделе» → с сегодня до ближайшего воскресенья; «на следующей неделе» → понедельник–воскресенье следующей недели.
  Один день → date_from = date_to. Дата не указана → оба null.
- Время начала игры: «утро» = 06:00–12:00, «днём» = 12:00–17:00, «вечер» = 17:00–23:00, «ночью» = 21:00–24:00.
  «после 19» → time_from 19:00, time_to null; «до 18» → time_from null, time_to 18:00; «в 19» / «около 19» → 18:00–20:00.
  «где-то вечером» — это тоже вечер. Время не указано → оба null. Используй формат HH:MM, полночь как конец — "24:00" не используй, пиши "23:59".
- max_players: «до 10 человек», «небольшая компания до 6» → максимум игроков в игре. Иначе null.
- min_free_slots: сколько мест нужно пользователю («нас двое», «нужно 3 места», «я с другом» → 2). Один человек — null.
- level: новичок/начинающий → beginner; любитель/средний → amateur; профи/сильный/продвинутый → advanced. Иначе null.
- keywords: 0–3 коротких слова, которые важны, но не попали в поля выше (например «дружеская», «крытое», «бесплатно», название площадки).
  Не повторяй вид спорта, город, дни и время.
- Не выдумывай то, чего нет в запросе.`;

function calendar(now: Date) {
  const lines: string[] = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(now.getTime() + i * 86_400_000);
    const p = kzParts(d);
    lines.push(`${toKzInputs(d).date} — ${WEEKDAYS[p.weekday]}${i === 0 ? " (сегодня)" : i === 1 ? " (завтра)" : ""}`);
  }
  return lines.join("\n");
}

function thinkingFor(model: string): ThinkingConfig | undefined {
  // Для разбора запроса «размышления» не нужны — выключаем ради скорости и лимитов.
  if (/gemini-2\.5-flash/.test(model)) return { thinkingBudget: 0 };
  if (/gemini-3/.test(model)) return { thinkingLevel: ThinkingLevel.MINIMAL };
  return undefined;
}

export class GeminiUnavailableError extends Error {}

export async function parseWithGemini(text: string, cities: City[], userCity: City | null, now = new Date()): Promise<AiQuery> {
  if (!geminiConfigured) throw new GeminiUnavailableError("GEMINI_API_KEY не задан");

  // SDK по умолчанию ходит в v1, а быстрые модели и responseSchema доступны в v1beta
  const ai = new GoogleGenAI({ apiKey: API_KEY, apiVersion: "v1beta" });
  const time = toKzInputs(now).time;
  const prompt = [
    `Сейчас: ${time} (UTC+5). Календарь на 2 недели:\n${calendar(now)}`,
    `Город пользователя: ${userCity?.name_ru ?? "не указан"}.`,
    `Города: ${cities.map((c) => `${c.name_ru} (${[c.name_kz, ...c.aliases].join(", ")})`).join("; ")}.`,
    `Виды спорта: ${SPORT_IDS.map((id) => `${id} — ${SPORTS[id].label}`).join("; ")}.`,
    `Запрос пользователя: """${text.replace(/"""/g, "")}"""`,
  ].join("\n\n");

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
  try {
    const res = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM,
        responseMimeType: "application/json",
        responseSchema,
        temperature: 0,
        maxOutputTokens: 400,
        thinkingConfig: thinkingFor(MODEL),
        // Таймаут только на нашей стороне: httpOptions.timeout уходит в Google как дедлайн,
        // а сервер отклоняет дедлайны короче 10 секунд.
        abortSignal: abort.signal,
      },
    });
    const raw = res.text;
    if (!raw) throw new GeminiUnavailableError("Пустой ответ модели");
    return aiQuerySchema.parse(JSON.parse(raw));
  } finally {
    clearTimeout(timer);
  }
}
