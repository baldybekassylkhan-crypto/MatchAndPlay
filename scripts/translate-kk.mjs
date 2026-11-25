// Собирает строки интерфейса для перевода и дописывает недостающие казахские переводы
// в src/lib/i18n/kk.ts с помощью Gemini (ключ GEMINI_API_KEY из .env.local).
//   node scripts/translate-kk.mjs           — перевести только новые строки
//   node scripts/translate-kk.mjs --list    — показать, чего не хватает, без перевода
// Отправляются только тексты интерфейса, без данных пользователей. Переводы — черновик:
// попросите носителя языка проверить src/lib/i18n/kk.ts.

import { GoogleGenAI, Type } from "@google/genai";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "src/lib/i18n/kk.ts");

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.(tsx?|mjs)$/.test(f) ? [p] : [];
  });
}

const unescape = (s) => JSON.parse(`"${s}"`);
const keys = new Set();
for (const file of walk(path.join(ROOT, "src"))) {
  if (file.includes(`${path.sep}i18n${path.sep}`)) continue;
  const src = readFileSync(file, "utf8");
  for (const m of src.matchAll(/(?<![\w.])t\(\s*"((?:[^"\\]|\\.)*)"/g)) keys.add(unescape(m[1]));
  for (const m of src.matchAll(/t\.n\([^,]+,\s*\["((?:[^"\\]|\\.)*)"/g)) keys.add(unescape(m[1]));
}
// Подписи из справочников: они переводятся при показе через t(label)
const DATA = ["src/lib/sports.ts", "src/lib/types.ts", "src/lib/filters.ts", "src/lib/courts.ts", "src/lib/venues.ts", "src/app/(app)/games/page.tsx", "src/app/(app)/create/page.tsx", "src/app/(app)/crews/page.tsx", "src/components/ui/SportGrid.tsx"];
for (const f of DATA) {
  const src = readFileSync(path.join(ROOT, f), "utf8");
  for (const m of src.matchAll(/\b(?:label|title|text|hint|short): "((?:[^"\\]|\\.)*[А-Яа-яЁё](?:[^"\\]|\\.)*)"/g)) keys.add(unescape(m[1]));
  for (const m of src.matchAll(/table_tennis: "([^"]+)"/g)) keys.add(m[1]);
}

const existing = (() => {
  const src = readFileSync(OUT, "utf8");
  const json = src.slice(src.indexOf("{"), src.lastIndexOf("}") + 1);
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
})();
const missing = [...keys].filter((k) => /[А-Яа-яЁё]/.test(k) && !(k in existing)).sort();
console.log(`Строк: ${keys.size}, переведено: ${Object.keys(existing).length}, нужно перевести: ${missing.length}`);
if (process.argv.includes("--list")) {
  console.log(missing.join("\n"));
  process.exit(0);
}

function save(dict) {
  const sorted = Object.fromEntries(Object.entries(dict).sort(([a], [b]) => a.localeCompare(b, "ru")));
  writeFileSync(
    OUT,
    `/**\n * Казахский перевод интерфейса: ключ — русский текст, значение — перевод.\n * Черновик (Gemini + ручная правка) — нужна вычитка носителем языка.\n * Новые строки: node scripts/translate-kk.mjs\n */\nexport const KK: Record<string, string> = ${JSON.stringify(sorted, null, 2)};\n`,
  );
}

if (!missing.length) process.exit(0);
const env = Object.fromEntries(
  readFileSync(path.join(ROOT, ".env.local"), "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const apiKey = process.env.GEMINI_API_KEY || env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("Нет GEMINI_API_KEY в .env.local");
  process.exit(1);
}
const ai = new GoogleGenAI({ apiKey, apiVersion: "v1beta" });
// Для перевода нужна модель посильнее, чем для разбора запросов
const model = process.env.KK_MODEL || "gemini-flash-latest";

const SYSTEM = `Ты переводишь интерфейс мобильного спортивного приложения Match&Play (Казахстан) с русского на казахский (кириллица).
Правила:
- Короткие, естественные формулировки, как в популярных казахстанских приложениях (Kaspi, Kolesa). Обращение на «сіз».
- Плейсхолдеры в фигурных скобках ({n}, {total}) и эмодзи сохраняй как есть. Не переводи Match&Play, Kaspi, e-Otinish, iKomek, QR, GPS, MVP.
- Спорт: футбол, баскетбол, волейбол, теннис, падел, хоккей, үстел теннисі, бадминтон, жүгіру. Игра — ойын, игрок — ойыншы, площадка — алаң, команда — команда, турнир — турнир, организатор — ұйымдастырушы, заявка — өтінім, лобби — лобби, акимат — әкімдік.
- Если строка — одно слово для числа («игра», «место»), дай форму для числа: «ойын», «орын».
- Сохраняй регистр первой буквы и знаки препинания.`;

// Перегрузка (503) и лимиты (429) бывают часто: повторяем и переключаемся на запасные модели
async function withRetry(call) {
  const models = [model, "gemini-3.5-flash", "gemini-2.5-flash", "gemini-flash-lite-latest"];
  let last;
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      return await call(models[attempt % models.length]);
    } catch (e) {
      last = e;
      if (![429, 500, 503, 404].includes(e?.status)) throw e;
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  throw last;
}

const dict = { ...existing };
for (let i = 0; i < missing.length; i += 60) {
  const batch = missing.slice(i, i + 60);
  const res = await withRetry((m) => ai.models.generateContent({
    model: m,
    contents: JSON.stringify(batch),
    config: {
      systemInstruction: SYSTEM,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.OBJECT, properties: { ru: { type: Type.STRING }, kk: { type: Type.STRING } }, required: ["ru", "kk"] },
      },
      temperature: 0.2,
    },
  }));
  const items = JSON.parse(res.text ?? "[]");
  for (const { ru, kk } of items) if (batch.includes(ru) && kk && kk.trim()) dict[ru] = kk.trim();
  save(dict);
  console.log(`… ${Math.min(i + 60, missing.length)} / ${missing.length}`);
}
console.log("Готово:", path.relative(ROOT, OUT));
