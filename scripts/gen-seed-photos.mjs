// Генерирует фотореалистичные «моменты с игр» для демо-постов через Gemini (ключ из .env.local)
// и сохраняет их в public/seed/photos/<sport>/ (1080×1350, WebP). Люди на фото — вымышленные.
//   node scripts/gen-seed-photos.mjs            — сгенерировать недостающие
//   node scripts/gen-seed-photos.mjs --force    — перегенерировать все
// После этого: node scripts/gen-pitch-seed.mjs

import { GoogleGenAI } from "@google/genai";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public/seed/photos");

const STYLE =
  "Candid smartphone photo, shot on a phone camera, natural light, slight motion blur, realistic skin and fabric, " +
  "amateur players (not professionals) in mismatched casual sportswear and training bibs, Kazakhstan. " +
  "People of Central Asian / Kazakh appearance, some Russian and Korean-Kazakh, mixed ages 18–35. " +
  "No text, no captions, no watermarks, no brand logos, no famous people. Vertical 4:5 Instagram post.";

const SCENES = {
  football: [
    "Evening mini-football on an artificial turf cage pitch in an Almaty residential courtyard, snow-capped Tian Shan mountains in the background at sunset, a player shooting at goal",
    "Group of ten amateur football players posing for a team photo after a game on artificial turf, some kneeling, sweaty and smiling, floodlights on, evening",
    "Goal celebration: two young men hugging and shouting on an indoor futsal court with rubber floor and green walls",
    "Amateur goalkeeper diving to save a ball on a small artificial pitch, blurred players in orange bibs behind, night floodlights",
    "Players resting on a bench after a game, drinking water from plastic bottles, laughing, sports bags on the ground, artificial turf pitch in Astana, modern apartment buildings behind",
    "Close action shot of a dribble between two players in bibs on artificial turf, low angle, evening light",
    "Friends shaking hands after a match on a school football field in Shymkent, warm sunset light, dusty air",
    "Selfie of four smiling amateur footballers after a game, one holding a ball, floodlit pitch behind them",
    "Amateur mini-football tournament: a team in matching cheap jerseys lifting a small trophy, medals around necks, indoor arena",
    "Winter: friends playing football on a snowy outdoor pitch, breath visible, colorful hats",
  ],
  basketball: [
    "Streetball 3x3 game on an outdoor court in Astana, a player going for a layup, apartment blocks behind, golden hour",
    "Group of young basketball players posing under the hoop after a game on an outdoor court, high fives",
    "Women's amateur basketball game in a school gym, a player shooting a free throw",
    "Close-up of hands high-fiving over a basketball on an asphalt court, late evening, street lamps",
    "Players sitting on the edge of an outdoor court resting, a basketball between their feet, talking and laughing",
    "Night streetball under court lights in Almaty, mountains silhouette, a player dribbling",
    "Amateur basketball team huddle in an indoor sports hall with wooden floor, before the game",
    "Slam dunk attempt by an amateur player on an outdoor hoop with a chain net, friends cheering",
  ],
  volleyball: [
    "Indoor amateur volleyball in a school gym, a player spiking over the net, mixed team",
    "Women's amateur volleyball team huddle with hands together in a sports hall, smiling",
    "Beach volleyball on sand at a lake in summer (Kapchagay), friends playing, sunny day",
    "Volleyball players celebrating a point with a group hug in a gym, sweaty, natural light from high windows",
    "Mixed group photo of a recreational volleyball club after training in a sports hall",
  ],
  tennis: [
    "Amateur tennis player serving on an outdoor hard court in Almaty, mountains in the background, morning light",
    "Two friends shaking hands at the net after a tennis match, outdoor court, sunny",
    "Padel doubles game on a glass-walled padel court, four amateur players, evening",
    "Selfie of two women with tennis rackets after a match on a clay court",
  ],
  running: [
    "Group of amateur runners on the Yesil river embankment in Astana at sunrise, city skyline, morning run club",
    "Runners stretching together in a park in Almaty after a morning run, autumn leaves",
    "A young woman running on a park path, wearing earphones, early morning golden light",
    "Run club group photo after a 10 km run, sweaty and smiling, holding phones with run stats",
  ],
  hockey: [
    "Amateur ice hockey on an outdoor rink in winter, snow around, players in mismatched gear, Kazakhstan city",
    "Hockey players in a locker room after a game, laughing, gear everywhere",
    "Night amateur hockey game on an outdoor rink with string lights, puck battle",
  ],
};

const env = Object.fromEntries(
  readFileSync(path.join(ROOT, ".env.local"), "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || env.GEMINI_API_KEY, apiVersion: "v1beta" });
const MODELS = ["gemini-3.1-flash-image", "gemini-2.5-flash-image", "gemini-3-pro-image"];
const force = process.argv.includes("--force");

async function generate(prompt) {
  let last;
  for (let attempt = 0; attempt < 6; attempt++) {
    const model = MODELS[attempt % MODELS.length];
    try {
      const res = await ai.models.generateContent({
        model,
        contents: `${prompt}. ${STYLE}`,
        config: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "4:5" } },
      });
      const part = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
      if (part) return Buffer.from(part.inlineData.data, "base64");
      last = new Error("no image in response");
    } catch (e) {
      last = e;
      if (![429, 500, 503, 404, 400].includes(e?.status)) throw e;
    }
    await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
  }
  throw last;
}

const limit = Number((process.argv.find((a) => a.startsWith("--limit=")) ?? "").split("=")[1]) || Infinity;
let made = 0;
for (const [sport, scenes] of Object.entries(SCENES)) {
  mkdirSync(path.join(OUT, sport), { recursive: true });
  for (const [i, scene] of scenes.entries()) {
    const file = path.join(OUT, sport, `${sport}-${String(i + 1).padStart(2, "0")}.webp`);
    if (existsSync(file) && !force) continue;
    if (made >= limit) break;
    try {
      const raw = await generate(scene);
      await sharp(raw).resize(1080, 1350, { fit: "cover" }).webp({ quality: 78 }).toFile(file);
      made++;
      console.log("✓", path.relative(ROOT, file));
    } catch (e) {
      console.log("✗", sport, i + 1, e?.status ?? "", String(e?.message ?? e).slice(0, 120));
    }
  }
}
console.log(`Готово: ${made} новых фото. Теперь: node scripts/gen-pitch-seed.mjs`);
