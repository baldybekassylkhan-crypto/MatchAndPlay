// Собирает спортивные площадки 21 города из OpenStreetMap в public/venues/<id города>.json.
// Запуск: npm run venues (уже собранные города пропускаются), npm run venues -- --force (собрать заново).
// Данные © участники OpenStreetMap, лицензия ODbL.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "public", "venues");
const force = process.argv.includes("--force");
const RADIUS_M = 16000;
const MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const sql = readFileSync(path.join(root, "supabase/migrations/0002_cities.sql"), "utf8");
const cities = [...sql.matchAll(/\((\d+),\s*'([a-z]+)',\s*'([^']+)',.*?\],\s*([\d.]+),\s*([\d.]+),\s*\d+\)/g)].map((m) => ({
  id: Number(m[1]),
  slug: m[2],
  name: m[3],
  lat: Number(m[4]),
  lng: Number(m[5]),
}));
if (cities.length !== 21) throw new Error(`Ожидали 21 город, нашли ${cities.length}`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clean = (v, max = 100) =>
  typeof v === "string"
    ? v
        .replace(/[\p{Cc}\p{Cf}]/gu, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, max)
    : "";

const query = ({ lat, lng }) => {
  const a = `(around:${RADIUS_M},${lat},${lng})`;
  return `[out:json][timeout:60];(
    nwr["leisure"="stadium"]${a};
    nwr["leisure"="pitch"]["sport"~"soccer|football|basketball|tennis|ice_hockey"]${a};
    nwr["leisure"~"^(fitness_centre|sports_centre|ice_rink)$"]${a};
    nwr["sport"="ice_hockey"]["leisure"]${a};
  );out tags center;`;
};

async function download(city) {
  for (let round = 0; round < 4; round++) {
    for (const url of MIRRORS) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "venue-data-script/1.0" },
          body: new URLSearchParams({ data: query(city) }),
          signal: AbortSignal.timeout(75000),
        });
        if (!res.ok) continue;
        const json = await res.json();
        if (Array.isArray(json.elements) && !json.remark?.includes("timed out")) return json.elements;
      } catch {
        // Пробуем следующее зеркало
      }
    }
    await sleep(8000 * (round + 1));
  }
  throw new Error("все серверы недоступны");
}

function kindOf(tags) {
  const sports = (tags.sport ?? "").toLowerCase();
  if (tags.leisure === "ice_rink" || sports.includes("ice_hockey") || sports.includes("ice_skating")) return "ice_rink";
  if (tags.leisure === "stadium") return "stadium";
  if (/soccer|football/.test(sports)) return tags.leisure === "sports_centre" ? "gym" : "football";
  if (sports.includes("basketball")) return tags.leisure === "sports_centre" ? "gym" : "basketball";
  if (sports.includes("tennis") && !sports.includes("table_tennis")) return tags.leisure === "sports_centre" ? "gym" : "tennis";
  if (tags.leisure === "fitness_centre" || tags.leisure === "sports_centre") return "gym";
  return null;
}

function convert(elements) {
  const rows = [];
  for (const e of elements) {
    const tags = e.tags ?? {};
    if (["private", "no"].includes(tags.access) || tags.disused === "yes" || tags.abandoned === "yes") continue;
    const lat = e.lat ?? e.center?.lat;
    const lng = e.lon ?? e.center?.lon;
    const kind = kindOf(tags);
    if (!kind || typeof lat !== "number" || typeof lng !== "number") continue;
    const street = clean(tags["addr:street"], 60);
    const house = clean(tags["addr:housenumber"], 12);
    rows.push({
      id: `${e.type[0]}${e.id}`,
      k: kind,
      n: clean(tags["name:ru"]) || clean(tags.name),
      a: street ? `${street}${house ? `, ${house}` : ""}` : "",
      lat: Math.round(lat * 1e5) / 1e5,
      lng: Math.round(lng * 1e5) / 1e5,
    });
  }

  // С именем — первыми, затем убираем дубли одного типа ближе ~35 м (здание и поле внутри него)
  rows.sort((a, b) => Number(Boolean(b.n)) - Number(Boolean(a.n)) || a.id.localeCompare(b.id));
  const kept = [];
  for (const r of rows) {
    const cos = Math.cos((r.lat * Math.PI) / 180);
    const close = kept.some(
      (x) => x.k === r.k && Math.hypot((x.lat - r.lat) * 111320, (x.lng - r.lng) * 111320 * cos) < 35,
    );
    if (!close) kept.push(r);
  }
  return kept;
}

mkdirSync(outDir, { recursive: true });
const failed = [];
for (const city of cities) {
  const file = path.join(outDir, `${city.id}.json`);
  if (!force && existsSync(file)) {
    console.log(`${city.slug}: уже собран`);
    continue;
  }
  try {
    const venues = convert(await download(city));
    writeFileSync(file, JSON.stringify(venues));
    const counts = {};
    for (const v of venues) counts[v.k] = (counts[v.k] ?? 0) + 1;
    console.log(`${city.slug}: ${venues.length}`, JSON.stringify(counts));
  } catch (e) {
    failed.push(city.slug);
    console.log(`${city.slug}: ОШИБКА ${e.message}`);
  }
  await sleep(2500);
}
if (failed.length) {
  console.log(`Не собраны: ${failed.join(", ")}. Запустите скрипт ещё раз.`);
  process.exit(1);
}
console.log("Готово");
