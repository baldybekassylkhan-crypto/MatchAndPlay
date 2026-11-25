// Генерирует supabase/seed-pitch.sql — демо-сообщество для презентации:
// 120 человек из городов Казахстана, подписки, команды, игры (прошедшие и будущие),
// отметки, посты и хайлайты, лайки, комментарии, чаты и турниры с рейтингом команд.
//
//   node scripts/gen-pitch-seed.mjs
//
// Данные детерминированы (одинаковый результат при каждом запуске), время считается от now()
// в момент выполнения SQL. Площадки — настоящие, из public/venues (OpenStreetMap).
// Свои фото: положите .jpg/.webp/.png в public/seed/photos/<sport>/ и в public/seed/avatars/ —
// генератор возьмёт их вместо рисунков.

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { avatarSvg } from "./avatar-svg.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "supabase/seed-pitch.sql");

// ───────────── Случайность с зерном ─────────────
let seed = 20261125;
function rnd() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const chance = (p) => rnd() < p;
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const sample = (arr, n) => shuffle(arr).slice(0, Math.max(0, Math.min(n, arr.length)));
const weighted = (pairs) => {
  const total = pairs.reduce((s, [, w]) => s + w, 0);
  let r = rnd() * total;
  for (const [v, w] of pairs) if ((r -= w) <= 0) return v;
  return pairs[pairs.length - 1][0];
};

const q = (s) => (s == null ? "null" : `'${String(s).replace(/'/g, "''")}'`);
const uid = (kind, n) => `d0000000-0000-4000-${kind}-${String(n).padStart(12, "0")}`;
const arr = (xs) => `array[${xs.map(q).join(",")}]::text[]`;

// ───────────── Имена ─────────────
const KZ_M = [
  ["Айдос", "aidos"], ["Ерлан", "erlan"], ["Нурлан", "nurlan"], ["Данияр", "daniyar"], ["Асхат", "askhat"],
  ["Бауыржан", "bauyrzhan"], ["Ерасыл", "yerassyl"], ["Алихан", "alikhan"], ["Санжар", "sanzhar"], ["Мирас", "miras"],
  ["Темирлан", "temirlan"], ["Арман", "arman"], ["Жандос", "zhandos"], ["Дамир", "damir"], ["Ильяс", "ilyas"],
  ["Азамат", "azamat"], ["Ернар", "yernar"], ["Димаш", "dimash"], ["Нурсултан", "nursultan"], ["Аслан", "aslan"],
  ["Олжас", "olzhas"], ["Ержан", "yerzhan"], ["Бекзат", "bekzat"], ["Абылай", "abylai"], ["Адиль", "adil"],
  ["Елдос", "yeldos"], ["Алибек", "alibek"], ["Шынгыс", "shyngys"], ["Канат", "kanat"], ["Рустам", "rustam"],
  ["Галым", "galym"], ["Жасулан", "zhassulan"], ["Нуржан", "nurzhan"], ["Самат", "samat"], ["Еркебулан", "yerkebulan"],
  ["Асет", "asset"], ["Ислам", "islam"], ["Батыр", "batyr"], ["Мади", "madi"], ["Акежан", "akezhan"],
  ["Диас", "dias"], ["Жанибек", "zhanibek"], ["Тамерлан", "tamerlan"], ["Мейрамбек", "meirambek"], ["Арсен", "arsen"],
];
const KZ_F = [
  ["Аружан", "aruzhan"], ["Айгерим", "aigerim"], ["Дана", "dana"], ["Мадина", "madina"], ["Жанель", "zhanel"],
  ["Камила", "kamila"], ["Динара", "dinara"], ["Асель", "assel"], ["Алия", "aliya"], ["Томирис", "tomiris"],
  ["Сабина", "sabina"], ["Айым", "aiym"], ["Акбота", "akbota"], ["Индира", "indira"], ["Жансая", "zhansaya"],
  ["Анель", "anel"], ["Молдир", "moldir"], ["Аяулым", "ayaulym"], ["Дильназ", "dilnaz"], ["Айдана", "aidana"],
  ["Арайлым", "arailym"], ["Балнур", "balnur"], ["Сания", "saniya"], ["Назерке", "nazerke"], ["Карина", "karina"],
];
const KZ_SUR = [
  ["Ахметов", "akhmetov"], ["Серикбаев", "serikbayev"], ["Нурланов", "nurlanov"], ["Жумабаев", "zhumabayev"],
  ["Омаров", "omarov"], ["Касымов", "kassymov"], ["Бекенов", "bekenov"], ["Тулегенов", "tulegenov"], ["Абенов", "abenov"],
  ["Сапаров", "saparov"], ["Исмаилов", "ismailov"], ["Мухамеджанов", "mukhamedzhanov"], ["Есенов", "yessenov"],
  ["Жаксыбеков", "zhaksybekov"], ["Утепов", "utepov"], ["Карибаев", "karibayev"], ["Айтжанов", "aitzhanov"],
  ["Кенжебаев", "kenzhebayev"], ["Байжанов", "baizhanov"], ["Сыздыков", "syzdykov"], ["Оспанов", "ospanov"],
  ["Муратов", "muratov"], ["Ермеков", "yermekov"], ["Садыков", "sadykov"], ["Нургалиев", "nurgaliyev"],
  ["Толеуов", "toleuov"], ["Смагулов", "smagulov"], ["Абдрахманов", "abdrakhmanov"], ["Бектуров", "bekturov"],
  ["Темирбеков", "temirbekov"], ["Мукашев", "mukashev"], ["Жунусов", "zhunussov"], ["Искаков", "iskakov"],
  ["Таскынов", "taskynov"], ["Альжанов", "alzhanov"], ["Рахимов", "rakhimov"], ["Шарипов", "sharipov"],
];
// Отчество по-казахски вместо фамилии: Серікұлы / Ерланқызы (в профилях часто пишут так)
const KZ_PATRO = [["Серик", "serik"], ["Ерлан", "erlan"], ["Болат", "bolat"], ["Асқар", "askar"], ["Нурлан", "nurlan"], ["Кайрат", "kairat"]];
const RU_M = [
  ["Максим", "maxim"], ["Артём", "artyom"], ["Дмитрий", "dmitriy"], ["Никита", "nikita"], ["Сергей", "sergey"],
  ["Александр", "alex"], ["Виктор", "viktor"], ["Кирилл", "kirill"], ["Денис", "denis"], ["Игорь", "igor"],
  ["Евгений", "evgeniy"], ["Андрей", "andrey"], ["Илья", "ilya"], ["Роман", "roman"], ["Владислав", "vlad"],
];
const RU_F = [
  ["Анастасия", "nastya"], ["Екатерина", "katya"], ["Алина", "alina"], ["Виктория", "vika"], ["Ксения", "ksenia"],
  ["Дарья", "dasha"], ["Ольга", "olga"], ["Юлия", "yulia"], ["Полина", "polina"], ["Елизавета", "liza"], ["Мария", "maria"],
];
const RU_SUR = [
  ["Иванов", "ivanov"], ["Петров", "petrov"], ["Смирнов", "smirnov"], ["Кузнецов", "kuznetsov"], ["Попов", "popov"],
  ["Морозов", "morozov"], ["Волков", "volkov"], ["Соколов", "sokolov"], ["Новиков", "novikov"], ["Лебедев", "lebedev"],
  ["Фёдоров", "fedorov"], ["Павлов", "pavlov"], ["Захаров", "zakharov"], ["Белов", "belov"],
];
const NEUTRAL_SUR = [["Шевченко", "shevchenko"], ["Ковальчук", "kovalchuk"], ["Бондаренко", "bondarenko"], ["Кравченко", "kravchenko"]];
const KOREAN_SUR = [["Ким", "kim"], ["Пак", "pak"], ["Цой", "tsoi"], ["Ли", "li"], ["Тен", "ten"], ["Хван", "khvan"], ["Югай", "yugai"]];

const fem = (s) => (/(ов|ев|ин)$/.test(s) ? `${s}а` : s);
const femLat = (s) => (/(ov|ev|in)$/.test(s) ? `${s}a` : s);

// ───────────── Города ─────────────
const CITIES = {
  1: { name: "Астана", lat: 51.1694, lng: 71.4491, tag: "ast" },
  2: { name: "Алматы", lat: 43.2389, lng: 76.8897, tag: "almaty" },
  3: { name: "Шымкент", lat: 42.3417, lng: 69.5901, tag: "shym" },
  4: { name: "Караганда", lat: 49.8047, lng: 73.1094, tag: "krg" },
  5: { name: "Актобе", lat: 50.2839, lng: 57.167, tag: "aktobe" },
  7: { name: "Павлодар", lat: 52.2873, lng: 76.9674, tag: "pvl" },
  8: { name: "Усть-Каменогорск", lat: 49.9483, lng: 82.6275, tag: "ukg" },
  10: { name: "Атырау", lat: 47.1167, lng: 51.8833, tag: "atr" },
  11: { name: "Костанай", lat: 53.2144, lng: 63.6246, tag: "kst" },
  15: { name: "Актау", lat: 43.65, lng: 51.1667, tag: "aktau" },
};
const CITY_PLAN = [[2, 36], [1, 32], [3, 16], [4, 10], [5, 6], [7, 5], [10, 5], [15, 4], [8, 3], [11, 3]];

// Площадки: из OpenStreetMap для первых пяти городов, для остальных — знакомые названия возле центра
const GENERIC = /^(поле|стадион|площадка|корт|футбольное поле|баскетбольная площадка|тренажерный зал|тренажёрный зал|спортзал|спортивная площадка|каток|теннисный корт|тенисный корт|запасное поле|gym)$/i;
const venues = {};
for (const id of Object.keys(CITIES)) {
  const file = path.join(ROOT, `public/venues/${id}.json`);
  if (!existsSync(file)) continue;
  venues[id] = JSON.parse(readFileSync(file, "utf8")).filter(
    (v) => v.n && v.n.length >= 4 && v.n.length <= 80 && !GENERIC.test(v.n.trim()) && !/кайрат|kairat|астана арена|барыс/i.test(v.n),
  );
}
const FALLBACK_VENUES = {
  football: ["Стадион «Центральный»", "Манеж «Арена»", "Поле у ДЮСШ №1", "Футбольный манеж «Чемпион»"],
  basketball: ["Площадка в Центральном парке", "Спорткомплекс «Олимп»", "Зал ДЮСШ №2"],
  tennis: ["Теннисный центр", "Корты в парке Победы"],
  ice_rink: ["Ледовый дворец", "Каток в парке"],
  gym: ["Спортзал «Жігер»", "ФОК «Самал»", "Зал школы-лицея №3"],
  run: ["Набережная", "Центральный парк", "Городской стадион, беговая дорожка"],
};
const RUN_SPOTS = {
  1: ["Набережная Есиля, у моста", "Центральный парк Астаны", "Ботанический сад, главный вход", "Парк Влюблённых"],
  2: ["Терренкур вдоль Есентая", "Парк Первого Президента", "Ботанический сад, вход с Тимирязева", "Медеу, нижняя станция"],
  3: ["Дендропарк", "Парк Независимости"],
};
function venueFor(cityId, sport) {
  const kinds = {
    football: ["football", "stadium"], basketball: ["basketball"], tennis: ["tennis"], padel: ["tennis"],
    hockey: ["ice_rink"], volleyball: ["gym"], badminton: ["gym"], table_tennis: ["gym"], running: [],
  }[sport];
  const city = CITIES[cityId];
  const jitter = () => ({ lat: +(city.lat + (rnd() - 0.5) * 0.06).toFixed(5), lng: +(city.lng + (rnd() - 0.5) * 0.08).toFixed(5) });
  if (sport === "running") {
    return { name: pick(RUN_SPOTS[cityId] ?? FALLBACK_VENUES.run), ...jitter(), outdoor: true };
  }
  const list = (venues[cityId] ?? []).filter((v) => kinds.includes(v.k));
  if (list.length) {
    const v = pick(list.slice(0, 40));
    return { name: v.n.trim(), lat: v.lat, lng: v.lng, outdoor: v.k === "football" || v.k === "stadium" || v.k === "basketball" ? null : false };
  }
  const key = sport === "football" ? "football" : sport === "basketball" ? "basketball" : sport === "hockey" ? "ice_rink" : sport === "tennis" || sport === "padel" ? "tennis" : "gym";
  return { name: pick(FALLBACK_VENUES[key]), ...jitter(), outdoor: null };
}

// ───────────── Люди ─────────────
const SPORT_W = [["football", 44], ["basketball", 22], ["volleyball", 9], ["tennis", 6], ["padel", 4], ["running", 6], ["hockey", 3], ["table_tennis", 3], ["badminton", 3]];
const BIOS = {
  football: [
    "Футбол — жизнь ⚽ Играю в опорной зоне", "Мини-футбол по вечерам, ищу постоянную команду", "Вратарь. Да, сам хочу стоять на воротах 🧤",
    "Қорғаушы. Аптасына 2 рет ойнаймын ⚽", "Футбол 3 раза в неделю 💪", "Левый вингер, люблю 5×5 на искусственке",
    "IT днём, футбол вечером", "Играю с 7 лет, сейчас — любитель", "Футболды жақсы көремін ⚽🔥", "Ищу игры по выходным утром",
  ],
  basketball: [
    "Стритбол 3×3 🏀", "Баскетбол — менің өмірім 🏀", "Разыгрывающий, 183 см", "Ищу людей на утренний баскет",
    "Бросаю трёхи, защищаюсь через раз 😅", "Баскет по средам и субботам",
  ],
  volleyball: ["Волейбол по средам и пятницам 🏐", "Пляжка летом, зал зимой", "Связующая, ищу смешанную команду", "Волейбол ойнаймын 🏐"],
  tennis: ["Теннис NTRP 3.5 🎾", "Ищу спарринг-партнёра на корт", "Теннис по утрам перед работой"],
  padel: ["Падел — новая любовь 🎾", "Падел и теннис, ищу пару", "Падел по выходным"],
  running: ["Готовлюсь к марафону 🏃", "Бегаю по утрам, 30–40 км в неделю", "Бег и йога ☀️", "Таңертең жүгіремін 🏃‍♀️"],
  hockey: ["Хоккей зимой, футбол летом 🏒", "Защитник, любительская лига", "Хоккей — с детства"],
  table_tennis: ["Настольный теннис, уровень — любитель", "Пинг-понг после работы 🏓"],
  badminton: ["Бадминтон по выходным 🏸", "Бадминтон и бег"],
};
const BIO_TAIL = ["", "", "", " · {city}", " · студент", " · работаю в IT", " · {city} 📍", " · пишите в личку"];

const users = [];
const usernames = new Set();
function makeUsername(first, last, sport, cityTag) {
  const short = { football: "fc", basketball: "hoops", volleyball: "volley", tennis: "tennis", padel: "padel", running: "run", hockey: "hockey", table_tennis: "pingpong", badminton: "bad" }[sport];
  const patterns = [
    () => `${first}.${last}`, () => `${first}_${last}`, () => `${first}${int(1, 99)}`, () => `${first}_${short}`,
    () => `${first}.${cityTag}`, () => `${last}.${first}`, () => `${first}${last.slice(0, 1)}`, () => `${first}_${int(7, 23)}`,
  ];
  for (let i = 0; i < 40; i++) {
    let u = pick(patterns)().toLowerCase().replace(/[^a-z0-9_.]/g, "");
    if (u.length > 20) u = u.slice(0, 20).replace(/[._]+$/, "");
    if (u.length >= 3 && !usernames.has(u)) {
      usernames.add(u);
      return u;
    }
  }
  const u = `${first.slice(0, 14)}${usernames.size}`;
  usernames.add(u);
  return u;
}

// Свои фото (jpg/webp/png) в public/seed/avatars имеют приоритет, иначе рисуем портрет
const photoDir = path.join(ROOT, "public/seed/avatars");
mkdirSync(photoDir, { recursive: true });
for (const f of readdirSync(photoDir)) if (/^pitch-\d+\.svg$/.test(f)) rmSync(path.join(photoDir, f));
const avatarFiles = readdirSync(photoDir).filter((f) => /\.(jpe?g|webp|png)$/i.test(f)).sort();

let n = 0;
for (const [cityId, count] of CITY_PLAN) {
  for (let i = 0; i < count; i++) {
    n++;
    const female = chance(0.3);
    const origin = weighted([["kz", 70], ["ru", 20], ["ko", 10]]);
    let first, firstLat, last, lastLat;
    if (origin === "kz") {
      [first, firstLat] = pick(female ? KZ_F : KZ_M);
      if (chance(0.12)) {
        const [p, pl] = pick(KZ_PATRO);
        last = female ? `${p}қызы` : `${p}ұлы`;
        lastLat = female ? `${pl}kyzy` : `${pl}uly`;
      } else {
        [last, lastLat] = pick(KZ_SUR);
        if (female) { last = fem(last); lastLat = femLat(lastLat); }
      }
    } else if (origin === "ru") {
      [first, firstLat] = pick(female ? RU_F : RU_M);
      [last, lastLat] = chance(0.25) ? pick(NEUTRAL_SUR) : pick(RU_SUR);
      if (female) { last = fem(last); lastLat = femLat(lastLat); }
    } else {
      [first, firstLat] = pick(female ? [...RU_F, ["Диана", "diana"]] : [...RU_M, ["Вячеслав", "slava"]]);
      [last, lastLat] = pick(KOREAN_SUR);
    }
    const main = weighted(female ? [["volleyball", 20], ["tennis", 15], ["padel", 10], ["running", 15], ["basketball", 15], ["badminton", 10], ["football", 8], ["table_tennis", 7]] : SPORT_W);
    const sports = [main, ...sample(SPORT_W.map(([s]) => s).filter((s) => s !== main), weighted([[0, 4], [1, 4], [2, 2]]))];
    const city = CITIES[cityId];
    const full = chance(0.12) ? `${first} ${last.slice(0, 1)}.` : chance(0.06) ? first : `${first} ${last}`;
    const bio = chance(0.25) ? null : `${pick(BIOS[main])}${pick(BIO_TAIL).replace("{city}", city.name)}`.slice(0, 160);
    users.push({
      id: uid("8001", n),
      n,
      cityId,
      first,
      female,
      username: makeUsername(firstLat, lastLat, main, city.tag),
      full,
      bio,
      sports,
      main,
      level: weighted([["beginner", 2], ["amateur", 6], ["advanced", 3]]),
      gamesBase: int(4, 140),
      createdDays: int(20, 260),
      origin,
      avatar: null,
      strength: rnd(),
    });
  }
}
for (const u of users) {
  if (avatarFiles.length) {
    u.avatar = u.n <= avatarFiles.length ? `/seed/avatars/${avatarFiles[u.n - 1]}` : null;
  } else if (chance(0.9)) {
    writeFileSync(path.join(photoDir, `pitch-${u.n}.svg`), avatarSvg(u, rnd));
    u.avatar = `/seed/avatars/pitch-${u.n}.svg`;
  }
}
const byCity = (cityId) => users.filter((u) => u.cityId === cityId);
const playsSport = (u, sport) => u.sports.includes(sport);

// ───────────── Картинки для постов ─────────────
const SPORT_IMG = { football: "football", basketball: "basketball", volleyball: "volleyball", tennis: "tennis", padel: "tennis", running: "running", hockey: "hockey", table_tennis: "tennis", badminton: "volleyball" };
function sportImages(sport) {
  const dir = path.join(ROOT, "public/seed/photos", sport);
  const own = existsSync(dir) ? readdirSync(dir).filter((f) => /\.(jpe?g|webp|png)$/i.test(f)).map((f) => `/seed/photos/${sport}/${f}`) : [];
  if (own.length) return own;
  const scenes = path.join(ROOT, "public/seed/scenes");
  const base = SPORT_IMG[sport];
  const drawn = existsSync(scenes) ? readdirSync(scenes).filter((f) => f.startsWith(`${base}-`)).map((f) => `/seed/scenes/${f}`) : [];
  return drawn.length ? drawn : [`/seed/${base}.svg`];
}
const media = (sport, count = 1) =>
  JSON.stringify(sample(sportImages(sport), count).map((p) => ({ type: "image", path: p, w: 1080, h: 1350 })));

// ───────────── Тексты ─────────────
const LOBBY_TEXT = {
  football: [
    "Нас {cur}, нужны ещё {need}. Играем 5×5, манишки есть.", "Вечерний мини-футбол, без грубости. За поле делим поровну.",
    "Ищем вратаря и пару полевых. Уровень — любители.", "Кешкі футбол, тағы {need} адам керек ⚽",
    "Футбол 7×7 на искусственном газоне. Приходите за 10 минут до начала.", "Субботний футбол, играем уже год постоянным составом — нужна замена.",
    "Играем 6×6, мяч и вода есть. Бутсы на искусственку.", "Ищем {need} игроков на 2 часа, играем на победителя.",
  ],
  basketball: [
    "Стритбол 3×3, нужен ещё {need}.", "Играем на всё поле 5×5, нужно {need} человека.", "Утренний баскетбол перед работой ☀️",
    "Баскетбол, бір-екі адам жетпейді 🏀", "Баскет в зале, играем до 21 очка.",
  ],
  volleyball: ["Волейбол в зале, смешанные команды. Все уровни.", "Волейбол 6×6, нужно {need} человек.", "Пляжный волейбол, сетка и мяч наши."],
  tennis: ["Ищу партнёра на корт, уровень ~3.0–3.5.", "Парная игра, нужна пара.", "Теннис утром, корт уже забронирован."],
  padel: ["Нужен 4-й на падел 🎾", "Падел 2×2, корт оплачен, делим на четверых."],
  hockey: ["Любительский хоккей, нужен вратарь и 2 полевых.", "Хоккей 5×5, лёд на полтора часа."],
  running: ["Пробежка 8 км, темп 5:30–6:00.", "Утренний бег 5 км, новичкам рады.", "Длинная 15 км, готовимся к забегу."],
  badminton: ["Бадминтон после работы, воланы есть.", "Бадминтон пара на пару."],
  table_tennis: ["Настольный теннис, играем на вылет.", "Пинг-понг, 2 стола, приходите."],
};
const SPORT_RU = { football: "футбол", basketball: "баскетбол", volleyball: "волейбол", tennis: "теннис", padel: "падел", hockey: "хоккей", running: "пробежку", badminton: "бадминтон", table_tennis: "настольный теннис" };
const WOMEN_TEXT = [
  "Девочки, собираемся на {sport}! Нас {cur}, нужно ещё {need}. Все уровни 💛", "Женская игра: {sport} без стеснения, новичкам рады",
  "Қыздар, {sport} ойнаймыз! Тағы {need} адам керек", "Только девушки: {sport} после работы, потом кофе ☕",
];
const PENDING_MSG = ["Можно с вами? Приду вовремя", "Могу на любую позицию", "Барамын! 💪", "Есть ещё место? Я с другом", "Играю в защите, возьмите 🙏", null];
const HIGHLIGHT_CAPTION = [
  "Отличная игра сегодня! Спасибо всем, кто пришёл 🔥", "{score} в нашу пользу 💪 Следующая — на этой неделе",
  "Керемет ойын болды! Рахмет баршаңызға ⚽", "Наконец-то забил со штрафного 😅", "MVP вечера — @{friend} 👏",
  "Сегодня без побед, но было весело", "Собрались за 20 минут через Match&Play. Так и надо!", "Вот это была заруба 🔥 Жду реванш",
  "Новые лица в составе — всем привет!", "Погода шепчет — играли на улице ☀️", "Два часа пролетели как 10 минут",
];
const POST_CAPTION = [
  "Тренировка перед турниром 💪", "Кто в субботу утром? Пишите, соберём игру", "Новые кроссовки прошли тест-драйв 😄",
  "Ищем людей в команду на зимний сезон", "Спорт > сериалы", "Сегодня {km} км ✅", "Вечерняя игра — лучший способ перезагрузиться",
  "Жаттығу аяқталды 🔥", "Скучаю по лету и играм на улице", "Первый раз на этом поле — топ", "Готовимся к кубку города 🏆",
];
const COMMENTS = [
  "Огонь 🔥", "Керемет!", "В следующий раз я с вами", "Кто забил второй?", "Красавчики 💪", "Жаль, пропустил", "Мықты!",
  "Когда следующая?", "Бомба", "Это было легендарно 😂", "Жду реванш", "Зачёт 👏", "Я тоже хочу!", "Супер, ребята",
  "Отлично сыграли", "Рахмет за игру!", "Позовите в следующий раз", "Вратарь сегодня тащил",
];
const LOBBY_CHAT = [
  "Всем привет! Мяч беру я", "Буду к началу", "Парковка там есть?", "Есть, прямо у входа", "Ертең кездескенше!",
  "Кто в светлом, кто в тёмном?", "Я в белом", "Опаздываю минут на 5, начинайте", "Деньги за поле кидаю на Kaspi организатору?",
  "Да, на мой номер в профиле", "Возьму воду на всех", "Кто-нибудь может подвезти от метро?", "+", "Ок 👍",
];
const CREW_CHAT = [
  "Завтра в 20:00, все в силе?", "Я буду", "+", "Беру мяч", "Кто сможет в субботу?", "Ертең келемін", "Опаздываю на 10 минут",
  "Скинул за поле", "Нам нужен ещё один на турнир", "Красавчики, вчера разнесли 💪", "Форму заказал, придёт в пятницу",
  "Регистрирую нас на кубок, ок?", "Давай!", "Я в отпуске до среды", "Кто снимал вчера? Скиньте видео", "Сегодня тренировка в 19:30",
];

// ───────────── SQL ─────────────
const out = [];
const sql = (s) => out.push(s);

sql(`-- Match&Play — демо-сообщество для презентации (сгенерировано scripts/gen-pitch-seed.mjs).
-- ВНИМАНИЕ: это вымышленные люди. Не выдавайте их за настоящих пользователей.
-- Запускать в Supabase SQL Editor после всех миграций (включая 0013). Можно запускать повторно.
-- Удалить: supabase/cleanup-demo.sql (удаляет все демо-аккаунты @demo.matchandplay.kz).
--
-- Чтобы ваш аккаунт выглядел «живым» на презентации (подписчики, сыгранные игры, команда, уведомления),
-- впишите свой ник вместо your_username в строке ниже:
`);
sql(`create temp table if not exists pitch_presenter (id uuid, city_id smallint);
truncate pitch_presenter;
insert into pitch_presenter select id, city_id from public.profiles where username = lower('your_username');
`);
sql(`begin;

-- Время считается от момента запуска: kz() — полночь сегодня по Казахстану + дни и часы
create or replace function pg_temp.kz(d integer, h numeric) returns timestamptz language sql stable as $$
  select date_trunc('day', now() + interval '5 hours') - interval '5 hours' + make_interval(days => d) + make_interval(secs => h * 3600)
$$;
create or replace function pg_temp.ago(h numeric) returns timestamptz language sql stable as $$
  select now() - make_interval(secs => h * 3600)
$$;
-- Момент внутри месяца: k = 0 — текущий (до сейчас), 1 — прошлый, 2 — позапрошлый; f — доля месяца
create or replace function pg_temp.inmonth(k integer, f numeric) returns timestamptz language sql stable as $$
  select case when k = 0
    then public.kz_month_start() + (now() - public.kz_month_start()) * f
    else public.kz_month_start(null, -k) + (public.kz_month_start(null, 1 - k) - public.kz_month_start(null, -k)) * f
  end
$$;

-- Старые демо-данные этой презентации
delete from public.crews where id::text like 'd0000000-0000-4000-8004-%';
delete from public.court_reports where id::text like 'd0000000-0000-4000-8009-%';
delete from public.sponsors where id::text like 'd0000000-0000-4000-8008-%';
delete from auth.users where email like 'pitch.%@demo.matchandplay.kz';

-- Пока заливаем данные: без push на телефоны и без «защиты от спама» в чатах
alter table public.notifications disable trigger notifications_push;
alter table public.chat_messages disable trigger chat_messages_guard;
alter table public.chat_messages disable trigger chat_messages_after;
`);

// Пользователи
sql(`insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values`);
sql(
  users
    .map((u) => `('00000000-0000-0000-0000-000000000000','${u.id}','authenticated','authenticated',${q(`pitch.${u.username}@demo.matchandplay.kz`)},'',now(),'{"provider":"email","providers":["email"]}','{}',pg_temp.ago(${u.createdDays * 24}),now())`)
    .join(",\n") + ";",
);
sql(`\ninsert into public.profiles (id, username, full_name, bio, city_id, sports, level, games_played, avatar_url, gender, created_at) values`);
sql(
  users
    .map((u) => `('${u.id}',${q(u.username)},${q(u.full)},${q(u.bio)},${u.cityId},${arr(u.sports)},'${u.level}',${u.gamesBase},${q(u.avatar)},'${u.female ? "female" : "male"}',pg_temp.ago(${u.createdDays * 24}))`)
    .join(",\n") + ";",
);

// Подписки: в основном внутри города, часть взаимных
const follows = new Set();
for (const u of users) {
  const local = byCity(u.cityId).filter((x) => x.id !== u.id);
  const other = users.filter((x) => x.cityId !== u.cityId);
  const k = int(6, Math.min(40, local.length + 8));
  for (const t of sample(local, Math.round(k * 0.8))) follows.add(`${u.id}|${t.id}`);
  for (const t of sample(other, Math.round(k * 0.2))) follows.add(`${u.id}|${t.id}`);
}
for (const f of [...follows]) {
  const [a, b] = f.split("|");
  if (chance(0.45)) follows.add(`${b}|${a}`);
}
sql(`\ninsert into public.follows (follower_id, following_id, created_at) values`);
sql([...follows].map((f) => { const [a, b] = f.split("|"); return `('${a}','${b}',pg_temp.ago(${int(1, 2400)}))`; }).join(",\n") + "\non conflict do nothing;");

// ───────────── Команды ─────────────
const CREWS = [
  [2, "football", "Алатау Юнайтед", "Играем с 2021 года. Тренировки вт/чт, по выходным — матчи."],
  [2, "football", "Медеу Сити", "Любители из Медеуского района. Ищем крайних полузащитников."],
  [2, "football", "Самал FC", "Футбол 6×6 после работы. Без грубости."],
  [2, "football", "Тұлпар Алматы", "Тұлпар — жүйрік! Ойнаймыз, жеңеміз ⚽"],
  [2, "football", "Бостандык Вулвз", "Команда района Бостандык. Участвуем во всех кубках города."],
  [2, "football", "Жетісу Старс", null],
  [2, "basketball", "Абай Хупс", "Стритбол и 5×5. Площадка на Абая."],
  [2, "basketball", "Кок-Тобе Баллерс", "Баскет у подножия Кок-Тобе 🏀"],
  [2, "basketball", "Достык 3×3", "Только 3×3, только хардкор."],
  [2, "volleyball", "Волей Алматы", "Смешанный волейбол, все уровни."],
  [1, "football", "Есиль Сити", "Левый берег. Играем круглый год в манеже."],
  [1, "football", "Сарыарка FC", "Любительская команда, 3 года вместе."],
  [1, "football", "Номадс Астана", "Номадс — значит всегда в движении ⚽"],
  [1, "football", "Байтерек Юнайтед", "Офисная команда, которая выросла в серьёзную."],
  [1, "football", "Нура Старс", null],
  [1, "basketball", "Астана Найтс", "Играем по вечерам, ищем высоких 🏀"],
  [1, "basketball", "Есиль Хупс", "Баскетбол 5×5 и турниры 3×3."],
  [1, "running", "Есиль Бегуны", "Бегаем по набережной по субботам в 8:00."],
  [3, "football", "Шымкент Лайонс", "Арыстандар! Ойнаймыз әр демалыс."],
  [3, "football", "Оңтүстік FC", "Южный характер ⚽"],
  [3, "football", "Каратау Юнайтед", null],
  [3, "basketball", "Шым Баллерс", "Стритбол в Шымкенте."],
  [4, "football", "Караганда Вулвз", "Играем в манеже, зимой и летом."],
  [4, "football", "Майкудук FC", "Майкудук — наш район, наша команда."],
  [4, "basketball", "Караганда Хупс", null],
  [5, "football", "Актобе Беркуты", "Бүркіттер ⚽"],
  [7, "football", "Павлодар Юнайтед", null],
  [10, "football", "Жайык FC", "Атырау, футбол по выходным."],
];
const crews = [];
const captainsUsed = new Set();
CREWS.forEach(([cityId, sport, name, descr], i) => {
  const local = byCity(cityId);
  const fans = local.filter((u) => playsSport(u, sport) && !captainsUsed.has(u.id));
  const captain = fans[0] ?? local.find((u) => !captainsUsed.has(u.id)) ?? local[0];
  captainsUsed.add(captain.id);
  const size = sport === "football" ? int(7, 13) : sport === "basketball" ? int(5, 9) : int(5, 10);
  const pool = local.filter((u) => u.id !== captain.id).sort((a, b) => Number(playsSport(b, sport)) - Number(playsSport(a, sport)) || rnd() - 0.5);
  const members = pool.slice(0, size - 1);
  crews.push({
    id: uid("8004", i + 1), conv: uid("8007", i + 1), cityId, sport, name, descr, captain, members,
    isOpen: chance(0.7), strength: rnd(), created: int(40, 400),
    pending: chance(0.4) ? pool.slice(size - 1, size + int(0, 1)) : [],
  });
});
sql(`\ninsert into public.crews (id, name, description, sport, city_id, captain_id, is_open, created_at) values`);
sql(crews.map((c) => `('${c.id}',${q(c.name)},${q(c.descr)},'${c.sport}',${c.cityId},'${c.captain.id}',${c.isOpen},pg_temp.ago(${c.created * 24}))`).join(",\n") + ";");
sql(`insert into public.conversations (id, kind, crew_id, created_at) values`);
sql(crews.map((c) => `('${c.conv}','crew','${c.id}',pg_temp.ago(${c.created * 24}))`).join(",\n") + ";");
const memberRows = [];
for (const c of crews) {
  memberRows.push(`('${c.id}','${c.captain.id}','captain','active',pg_temp.ago(${c.created * 24}))`);
  for (const m of c.members) memberRows.push(`('${c.id}','${m.id}','member','active',pg_temp.ago(${int(1, c.created) * 24}))`);
  for (const m of c.pending) memberRows.push(`('${c.id}','${m.id}','member','pending',pg_temp.ago(${int(2, 60)}))`);
}
sql(`insert into public.crew_members (crew_id, user_id, role, status, joined_at) values`);
sql(memberRows.join(",\n") + "\non conflict do nothing;");
// Чаты команд
const crewMsgs = [];
for (const c of crews) {
  const people = [c.captain, ...c.members];
  let h = int(60, 200);
  for (let k = 0; k < int(6, 16); k++) {
    h = Math.max(0.2, h - rnd() * 18);
    crewMsgs.push(`('${c.conv}','${pick(people).id}',${q(pick(CREW_CHAT))},pg_temp.ago(${h.toFixed(2)}))`);
  }
}
sql(`insert into public.chat_messages (conversation_id, user_id, text, created_at) values`);
sql(crewMsgs.join(",\n") + ";");
sql(`update public.conversations c set last_message_at = (select max(m.created_at) from public.chat_messages m where m.conversation_id = c.id) where c.id::text like 'd0000000-0000-4000-8007-%';
update public.conversation_members cm set last_read_at = coalesce((select max(m.created_at) from public.chat_messages m where m.conversation_id = cm.conversation_id), now())
 where cm.conversation_id::text like 'd0000000-0000-4000-8007-%';`);

// ───────────── Игры ─────────────
const lobbies = [];
const PLAYERS = { football: [[4, 12], [1, 6]], basketball: [[2, 8], [1, 4]], volleyball: [[4, 10], [1, 6]], tennis: [[1, 3], [1, 2]], padel: [[2, 3], [1, 2]], hockey: [[6, 14], [1, 5]], running: [[1, 5], [2, 8]], badminton: [[1, 3], [1, 3]], table_tennis: [[1, 4], [1, 3]] };
const PRICE = { football: [1500, 3000, 500], basketball: [1000, 2000, 500], volleyball: [1000, 2000, 500], tennis: [4000, 8000, 1000], padel: [5000, 10000, 1000], hockey: [3000, 5000, 500], running: null, badminton: [1000, 2500, 500], table_tennis: [500, 1500, 500] };
const HOURS = [[7, 1], [8, 1], [10, 2], [12, 1], [15, 1], [17, 2], [18, 4], [19, 6], [19.5, 3], [20, 6], [20.5, 2], [21, 4], [22, 1]];
let lobbyN = 0;
function makeLobby(cityId, day, past) {
  const local = byCity(cityId);
  const sport = weighted(SPORT_W.filter(([s]) => local.some((u) => playsSport(u, s))));
  const org = pick(local.filter((u) => playsSport(u, sport))) ?? pick(local);
  const womenOnly = org.female && ["volleyball", "badminton", "tennis", "padel", "running", "basketball", "football"].includes(sport) && chance(0.45);
  const [[c1, c2], [n1, n2]] = PLAYERS[sport];
  const cur = int(c1, c2);
  const need = int(n1, n2);
  const v = venueFor(cityId, sport);
  const p = PRICE[sport];
  const price = !p || chance(0.2) ? null : p[0] + p[2] * int(0, (p[1] - p[0]) / p[2]);
  const outdoor = v.outdoor ?? (sport === "football" ? chance(0.4) : sport === "basketball" ? chance(0.55) : sport === "tennis" ? chance(0.5) : false);
  const text = (womenOnly ? pick(WOMEN_TEXT) : pick(LOBBY_TEXT[sport])).replace("{cur}", cur).replace("{need}", need).replace("{sport}", SPORT_RU[sport]);
  const others = shuffle(local.filter((u) => u.id !== org.id && (!womenOnly || u.female))).sort((a, b) => Number(playsSport(b, sport)) - Number(playsSport(a, sport)));
  const acceptedN = past ? Math.min(need, others.length) : Math.min(need, others.length, weighted([[0, 2], [Math.max(0, need - 1), 4], [need, 3], [Math.floor(need / 2), 3]]));
  const accepted = others.slice(0, acceptedN);
  const pending = past ? [] : others.slice(acceptedN, acceptedN + (acceptedN < need && chance(0.4) ? int(1, 2) : 0));
  lobbyN++;
  const l = {
    id: uid("8002", lobbyN), cityId, sport, org, cur, need, womenOnly, venue: v, price, outdoor, text, accepted, pending, past,
    day, hour: weighted(HOURS), duration: weighted([[60, 2], [90, 5], [120, 3]]), level: weighted([[null, 4], ["beginner", 1], ["amateur", 3], ["advanced", 1]]),
  };
  if (l.hour < 9 && sport !== "running" && sport !== "tennis") l.hour = 19;
  lobbies.push(l);
  return l;
}
for (const [cityId, count] of CITY_PLAN) {
  const upcoming = Math.round(count * 0.9);
  const past = Math.round(count * 1.3);
  for (let i = 0; i < upcoming; i++) makeLobby(cityId, weighted([[0, 3], [1, 4], [2, 3], [3, 3], [4, 2], [5, 2], [6, 2], [7, 1], [8, 1], [9, 1]]), false);
  for (let i = 0; i < past; i++) makeLobby(cityId, -int(1, 30), true);
}
const startExpr = (l) => `pg_temp.kz(${l.day}, ${l.hour})`;
sql(`\n-- Игры: будущие (только те, что начнутся позже чем через 20 минут) и прошедшие
insert into public.lobbies (id, organizer_id, sport, description, players_current, players_needed, start_time, duration_min, city_id,
                            location_name, lat, lng, level, price_kzt, is_outdoor, women_only, status, created_at)
select v.id::uuid, v.org::uuid, v.sport, v.descr, v.cur, v.need, v.st, v.dur, v.city, v.place, v.lat, v.lng, v.lvl::public.skill_level,
       v.price, v.outdoor, v.women, (case when v.st < now() then 'finished' else 'active' end)::public.lobby_status, least(v.st - interval '1 day', now() - interval '2 hours')
from (values`);
sql(lobbies.map((l) => `('${l.id}','${l.org.id}','${l.sport}',${q(l.text)},${l.cur},${l.need},${startExpr(l)},${l.duration},${l.cityId},${q(l.venue.name.slice(0, 120))},${l.venue.lat},${l.venue.lng},${q(l.level)},${l.price ?? "null::int"},${l.outdoor},${l.womenOnly})`).join(",\n"));
sql(`) as v(id, org, sport, descr, cur, need, st, dur, city, place, lat, lng, lvl, price, outdoor, women)
where v.st < now() - interval '3 hours' or v.st > now() + interval '20 minutes';`);

const apps = [];
const checkins = [];
for (const l of lobbies) {
  for (const u of l.accepted) apps.push(`('${l.id}','${u.id}','accepted',null)`);
  for (const u of l.pending) apps.push(`('${l.id}','${u.id}','pending',${q(pick(PENDING_MSG))})`);
  if (l.past) {
    checkins.push(`('${l.id}','${l.org.id}',${int(1, 14)})`);
    for (const u of l.accepted) if (chance(0.88)) checkins.push(`('${l.id}','${u.id}',${int(1, 14)})`);
  }
}
sql(`\ninsert into public.lobby_applications (lobby_id, user_id, status, message, created_at, decided_at)
select v.l::uuid, v.u::uuid, v.s::public.application_status, v.m, l.created_at + interval '1 hour', case when v.s = 'accepted' then l.created_at + interval '3 hours' end
from (values`);
sql(apps.join(",\n"));
sql(`) as v(l, u, s, m) join public.lobbies l on l.id = v.l::uuid
on conflict do nothing;

update public.lobbies l
   set accepted_count = s.n,
       status = case when l.status = 'finished' then l.status when s.n >= l.players_needed then 'full'::public.lobby_status else 'active'::public.lobby_status end
  from (select lobby_id, count(*)::smallint as n from public.lobby_applications where status = 'accepted' group by lobby_id) s
 where s.lobby_id = l.id and l.id::text like 'd0000000-0000-4000-8002-%';

-- Отметки на прошедших играх (встряхиванием у точки игры)
insert into public.lobby_checkins (lobby_id, user_id, checked_in_at, method, distance_m)
select v.l::uuid, v.u::uuid, l.start_time - make_interval(mins => (v.d * 2) % 25), 'place', v.d
from (values`);
sql(checkins.join(",\n"));
sql(`) as v(l, u, d) join public.lobbies l on l.id = v.l::uuid and l.status = 'finished'
on conflict do nothing;`);

// Чаты будущих игр
const lobbyMsgs = [];
for (const l of lobbies.filter((x) => !x.past && x.accepted.length >= 2 && chance(0.5))) {
  const people = [l.org, ...l.accepted];
  for (let k = 0; k < int(2, 6); k++) lobbyMsgs.push(`('${l.id}','${pick(people).id}',${q(pick(LOBBY_CHAT))},${(k * 0.7 + rnd()).toFixed(2)})`);
}
sql(`\nalter table public.lobby_messages disable trigger user;
insert into public.lobby_messages (lobby_id, user_id, text, created_at)
select v.l::uuid, v.u::uuid, v.t, least(now() - interval '5 minutes', l.created_at + make_interval(secs => v.h * 3600))
from (values`);
sql(lobbyMsgs.join(",\n"));
sql(`) as v(l, u, t, h) join public.lobbies l on l.id = v.l::uuid;
alter table public.lobby_messages enable trigger user;`);

// ───────────── Посты ─────────────
const posts = [];
let postN = 0;
for (const l of lobbies.filter((x) => x.past && chance(0.5))) {
  const author = chance(0.5) ? l.org : pick([l.org, ...l.accepted]);
  const friend = pick([l.org, ...l.accepted].filter((u) => u.id !== author.id)) ?? l.org;
  const score = l.sport === "basketball" ? `${int(15, 21)}:${int(8, 14)}` : `${int(3, 7)}:${int(1, 2)}`;
  const caption = pick(HIGHLIGHT_CAPTION).replace("{friend}", friend.username).replace("{score}", score);
  postN++;
  posts.push({ id: uid("8003", postN), author, sport: l.sport, lobby: l, caption, when: `least(now() - interval '10 minutes', ${startExpr(l)} + interval '${int(2, 30)} hours')`, cityId: l.cityId, pop: rnd() });
}
for (let i = 0; i < 90; i++) {
  const author = pick(users);
  postN++;
  posts.push({ id: uid("8003", postN), author, sport: author.main, lobby: null, caption: chance(0.1) ? null : pick(POST_CAPTION).replace("{km}", int(5, 21)), when: `pg_temp.ago(${int(1, 24 * 50)})`, cityId: author.cityId, pop: rnd() });
}
sql(`\ninsert into public.posts (id, author_id, caption, sport, lobby_id, media, created_at)
select v.id::uuid, v.a::uuid, v.c, v.s, l.id, v.m::jsonb, v.w
from (values`);
sql(posts.map((p) => `('${p.id}','${p.author.id}',${q(p.caption)},'${p.sport}',${p.lobby ? `'${p.lobby.id}'` : "null"},${q(media(p.sport, chance(0.25) ? int(2, 3) : 1))},${p.when})`).join(",\n"));
sql(`) as v(id, a, c, s, lob, m, w)
left join public.lobbies l on l.id = v.lob::uuid and l.status = 'finished';`);

const likes = [];
const comments = [];
for (const p of posts) {
  const local = byCity(p.cityId).filter((u) => u.id !== p.author.id);
  const k = Math.round(2 + p.pop ** 2 * Math.min(55, local.length + 10));
  for (const u of sample(local, Math.round(k * 0.85))) likes.push(`('${p.id}','${u.id}')`);
  for (const u of sample(users.filter((x) => x.cityId !== p.cityId), Math.round(k * 0.15))) likes.push(`('${p.id}','${u.id}')`);
  for (const u of sample(local, weighted([[0, 3], [1, 3], [2, 2], [3, 1], [5, 1]]))) comments.push(`('${p.id}','${u.id}',${q(pick(COMMENTS))},${int(1, 600)})`);
}
sql(`\ninsert into public.likes (post_id, user_id) select v.p::uuid, v.u::uuid from (values`);
sql(likes.join(",\n"));
sql(`) as v(p, u) join public.posts p on p.id = v.p::uuid on conflict do nothing;

insert into public.comments (post_id, user_id, text, created_at)
select v.p::uuid, v.u::uuid, v.t, least(now(), p.created_at + make_interval(mins => v.m))
from (values`);
sql(comments.join(",\n"));
sql(`) as v(p, u, t, m) join public.posts p on p.id = v.p::uuid;`);

// ───────────── Турниры ─────────────
const tournaments = [];
let tN = 0;
let teamN = 0;
const TEAM_NAMES = ["Друзья Ерлана", "Ветераны", "Студенты", "Команда 23", "Сборная офиса", "Жас Қыран", "Дворовые", "Последний шанс", "Темп", "Резерв", "Ракета", "Шторм", "Юность", "Феникс"];
const T_NAMES = {
  football: ["Кубок {city} по мини-футболу", "Лига выходного дня", "Осенний кубок", "Кубок районов", "Ночной турнир 6×6", "Кубок Match&Play"],
  basketball: ["Street Ball Cup 3×3", "Кубок {city} по баскетболу", "Турнир 3×3 «Жаркий асфальт»", "Баскетбольная ночь"],
};
function makeTournament(cityId, sport, monthK, size, finished) {
  const cityCrews = crews.filter((c) => c.cityId === cityId && c.sport === sport);
  const chosen = sample(cityCrews, Math.min(cityCrews.length, size - (size >= 8 ? 2 : 1)));
  const local = byCity(cityId);
  const teams = chosen.map((c) => ({ id: uid("8006", ++teamN), name: c.name, captain: c.captain, crew: c, strength: c.strength * 0.7 + rnd() * 0.3 }));
  const usedCaps = new Set(teams.map((t) => t.captain.id));
  const names = shuffle(TEAM_NAMES);
  while (teams.length < size) {
    const cap = local.find((u) => !usedCaps.has(u.id) && playsSport(u, sport)) ?? local.find((u) => !usedCaps.has(u.id));
    if (!cap) break;
    usedCaps.add(cap.id);
    teams.push({ id: uid("8006", ++teamN), name: names.pop() ?? `Команда ${teamN}`, captain: cap, crew: null, strength: rnd() * 0.6 });
  }
  if (teams.length < 4) return;
  const realSize = teams.length >= 8 && size >= 8 ? 8 : 4;
  teams.length = realSize;
  const seeded = shuffle(teams);
  const matches = [];
  let round = seeded;
  let r = 1;
  while (round.length > 1) {
    const next = [];
    for (let i = 0; i < round.length; i += 2) {
      const a = round[i], b = round[i + 1];
      const pA = 0.5 + (a.strength - b.strength) * 0.8;
      const win = rnd() < pA ? a : b;
      let sa, sb;
      if (sport === "basketball") { sa = int(12, 21); sb = int(8, 20); } else { sa = int(0, 6); sb = int(0, 6); }
      if (sa === sb) sa++;
      if ((win === a) !== sa > sb) [sa, sb] = [sb, sa];
      matches.push({ round: r, position: i / 2, a, b, sa, sb, win: finished ? win : null });
      next.push(win);
    }
    round = next;
    r++;
  }
  const org = local.find((u) => !usedCaps.has(u.id)) ?? local[0];
  const v = venueFor(cityId, sport);
  tN++;
  const f = monthK === 0 ? (0.15 + rnd() * 0.75).toFixed(3) : (0.2 + rnd() * 0.75).toFixed(3);
  tournaments.push({
    id: uid("8005", tN), cityId, sport, size: realSize, teams, matches: finished ? matches : [], finished, org, v,
    name: pick(T_NAMES[sport]).replace("{city}", CITIES[cityId].name),
    when: finished ? `pg_temp.inmonth(${monthK}, ${f})` : `pg_temp.kz(${int(4, 12)}, 11)`,
    winner: finished ? round[0] : null,
  });
}
for (const k of [0, 1, 2]) {
  makeTournament(2, "football", k, 8, true);
  makeTournament(2, "football", k, 4, true);
  makeTournament(2, "basketball", k, 4, true);
  makeTournament(1, "football", k, 8, true);
  if (k !== 2) makeTournament(1, "basketball", k, 4, true);
  makeTournament(3, "football", k, 4, true);
  if (k !== 1) makeTournament(4, "football", k, 4, true);
}
makeTournament(1, "football", 0, 4, true);
makeTournament(2, "football", 0, 8, false);
makeTournament(1, "football", 0, 8, false);
makeTournament(2, "basketball", 0, 8, false);
makeTournament(3, "football", 0, 8, false);

sql(`\n-- Турниры: завершённые (дают очки в рейтинг команд) и открытые для регистрации
insert into public.tournaments (id, organizer_id, name, description, rules, sport, city_id, location_name, lat, lng, starts_at,
                                registration_ends_at, max_teams, team_size, entry_fee_kzt, prize, status, created_at, finished_at) values`);
sql(tournaments.map((t) => {
  const start = t.finished ? `${t.when} - interval '5 hours'` : t.when;
  return `('${t.id}','${t.org.id}',${q(t.name)},${q(t.sport === "football" ? "Турнир для любительских команд. Игры по 2×15 минут, плей-офф с первого круга." : "Турнир 3×3 до 21 очка или 10 минут. Плей-офф.")},${q("Фолы и споры решает судья. Опоздание больше 10 минут — техническое поражение.")},'${t.sport}',${t.cityId},${q(t.v.name.slice(0, 120))},${t.v.lat},${t.v.lng},${start},${start} - interval '2 days',${t.size},${t.sport === "football" ? 7 : 4},${pick([0, 5000, 10000, 15000])},${q(pick(["Кубок и медали", "Кубок, медали и 100 000 ₸ победителю", "Медали и форма от спонсора", "Кубок и сертификаты в спортмагазин"]))},'${t.finished ? "finished" : "registration"}',${start} - interval '14 days',${t.finished ? t.when : "null"})`;
}).join(",\n") + ";");
sql(`insert into public.tournament_contacts (tournament_id, contact) select id, 'Telegram: @mp_cups' from public.tournaments where id::text like 'd0000000-0000-4000-8005-%';`);
const teamRows = [];
const matchRows = [];
for (const t of tournaments) {
  const regTeams = t.finished ? t.teams : t.teams.slice(0, int(3, t.teams.length - 1));
  for (const team of regTeams) teamRows.push(`('${team.id}','${t.id}',${q(team.name)},'${team.captain.id}',${team.crew ? `'${team.crew.id}'` : "null"})`);
  for (const m of t.matches) matchRows.push(`('${t.id}',${m.round},${m.position},'${m.a.id}','${m.b.id}',${m.sa},${m.sb},'${m.win.id}','finished')`);
}
sql(`insert into public.tournament_teams (id, tournament_id, name, captain_id, crew_id) values`);
sql(teamRows.join(",\n") + ";");
sql(`insert into public.tournament_matches (tournament_id, round, position, team_a_id, team_b_id, score_a, score_b, winner_id, status) values`);
sql(matchRows.join(",\n") + ";");
sql(`update public.tournaments t set winner_team_id = v.w::uuid from (values ${tournaments.filter((t) => t.finished).map((t) => `('${t.id}','${t.winner.id}')`).join(",")}) as v(t, w) where t.id = v.t::uuid;`);

// ───────────── Обращения о площадках ─────────────
const PAID_RE = /манеж|арена|arena|клуб|club|центр|center|fitness|фитнес|комплекс|академ|academy|ск |спорткомплекс|школа футбола|padel|падел/i;
const ISSUE_TEXT = {
  hoop: ["Кольцо оторвано, торчат болты", "Нет сетки на кольце и щит треснул", "Кольцо погнуто, мяч отскакивает"],
  net: ["Сетку украли ещё летом", "Сетка порвана посередине"],
  goal: ["Ворота шатаются, опасно для детей", "Нет сетки на воротах, одна штанга погнута"],
  surface: ["Покрытие вздулось, ямы у центра", "Резиновое покрытие порвано, можно подвернуть ногу", "Асфальт треснул, после дождя лужи"],
  lighting: ["Фонари не горят уже месяц, вечером играть невозможно", "Работает только один прожектор из четырёх"],
  fence: ["Сетка-рабица порвана, мяч улетает на дорогу", "Калитка сломана"],
  trash: ["Много стекла на площадке", "Урны переполнены, мусор по всему полю"],
};
const courtRows = [];
const voteRows = [];
let crN = 0;
for (const [cityId, count] of [[2, 11], [1, 9], [3, 4], [4, 3]]) {
  const free = (venues[cityId] ?? []).filter((v) => ["football", "basketball", "tennis"].includes(v.k) && !PAID_RE.test(v.n));
  const generic = (JSON.parse(readFileSync(path.join(ROOT, `public/venues/${cityId}.json`), "utf8")))
    .filter((v) => ["football", "basketball"].includes(v.k) && v.a && !v.n);
  for (const v of sample([...free, ...generic], count)) {
    const kinds = v.k === "basketball" ? ["hoop", "net", "surface", "lighting", "fence", "trash"] : v.k === "tennis" ? ["net", "surface", "lighting", "fence"] : ["goal", "surface", "lighting", "fence", "trash"];
    const kind = pick(kinds);
    const status = weighted([["new", 4], ["sent", 3], ["in_progress", 2], ["fixed", 3], ["rejected", 0.5]]);
    const local = byCity(cityId);
    const voters = sample(local, int(1, Math.min(14, local.length)));
    const days = int(2, 40);
    crN++;
    const id = uid("8009", crN);
    const label = { football: "Футбольное поле", basketball: "Баскетбольная площадка", tennis: "Теннисный корт" }[v.k];
    const name = (v.n ? v.n : `${label}, ${v.a}`).slice(0, 120);
    const note = status === "fixed" ? pick(["Отремонтировано акиматом района", "Заменили кольца и сетки", "Установлено новое освещение"]) : status === "in_progress" ? "Включено в план ремонта" : status === "rejected" ? "Площадка частная, обратитесь к владельцу" : null;
    courtRows.push(`('${id}',${q(v.id)},${cityId},${q(name)},${v.lat},${v.lng},'${kind}',${q(chance(0.75) ? pick(ISSUE_TEXT[kind]) : null)},'${status}',${q(note)},${voters.length},'${voters[0].id}',pg_temp.ago(${days * 24}),pg_temp.ago(${int(1, days) * 24}),${status === "fixed" || status === "rejected" ? `pg_temp.ago(${int(1, days - 1) * 24})` : "null"})`);
    for (const u of voters) voteRows.push(`('${id}','${u.id}')`);
  }
}
sql(`\n-- Обращения жителей о площадках (для акимата)
insert into public.court_reports (id, venue_id, city_id, venue_name, lat, lng, kind, comment, status, admin_note, votes, created_by, created_at, updated_at, resolved_at) values`);
sql(courtRows.join(",\n") + "\non conflict do nothing;");
sql(`insert into public.court_report_votes (report_id, user_id) select v.r::uuid, v.u::uuid from (values ${voteRows.join(",")}) as v(r, u) join public.court_reports c on c.id = v.r::uuid on conflict do nothing;
update public.court_reports c set votes = (select count(*) from public.court_report_votes v where v.report_id = c.id) where c.id::text like 'd0000000-0000-4000-8009-%';`);

// ───────────── Партнёры и награды (вымышленные) ─────────────
const SPONSORS = [
  [1, "Спорттовары «Чемпион»", "store", "#ff6b00", "пр. Абая, 52, Алматы", 2, [["−15% на мячи и форму", "Скидка на один чек в любом магазине сети", 8, null, null], ["Бутсы со скидкой 20%", "Для тех, кто играет в футбол каждую неделю", 6, "football", 30]]],
  [2, "Кофейня «Таңғы»", "cafe", "#8b5e3c", "Астана, Алматы, Шымкент", null, [["Раф в подарок после игры", "Покажите код бариста", 3, null, 100]]],
  [3, "Фитнес-клуб «Жігер»", "gym", "#e63946", "мкр. Самал-2, 58, Алматы", 2, [["Неделя в зале бесплатно", "Тренажёрный зал и бассейн, 7 дней", 12, null, 20]]],
  [4, "Баскет-шоп «Данк»", "store", "#3a86ff", "ТРЦ «Керуен», Астана", 1, [["−20% на баскетбольные мячи", null, 5, "basketball", null]]],
  [5, "Spa «Шипа»", "services", "#7b2cbf", "ул. Байтурсынова, 9, Шымкент", 3, [["Хаммам за полцены", "После тяжёлой игры — самое то", 10, null, 15]]],
  [6, "Вода «Тау Су»", "other", "#06b6d4", null, null, [["Упаковка воды на команду", "Для организаторов, которые собрали 4 игры", 4, null, 50]]],
];
const spRows = [];
const offerRows = [];
let offN = 0;
SPONSORS.forEach(([i, name, kind, color, address, cityId, offers]) => {
  const sid = uid("8008", i);
  spRows.push(`('${sid}',${q(name)},'${kind}','${color}',${q(address)},${cityId ?? "null"})`);
  for (const [title, descr, games, sport, limit] of offers) {
    offN++;
    offerRows.push(`('${uid("8010", offN)}','${sid}',${q(title)},${q(descr)},${games},${q(sport)},${cityId ?? "null"},${limit ?? "null"})`);
  }
});
sql(`\ninsert into public.sponsors (id, name, kind, color, address, city_id) values ${spRows.join(",\n")};
insert into public.reward_offers (id, sponsor_id, title, description, games_required, sport, city_id, monthly_limit) values ${offerRows.join(",\n")};`);

// ───────────── Аккаунт ведущего ─────────────
sql(`
-- ───────────── Ваш аккаунт (если вписан ник выше) ─────────────
-- Подписчики и подписки
insert into public.follows (follower_id, following_id, created_at)
select u.id, p.id, pg_temp.ago((abs(hashtext(u.id::text)) % 600) + 1)
  from pitch_presenter p join public.profiles u on u.id::text like 'd0000000-0000-4000-8001-%'
 where (u.city_id = p.city_id and abs(hashtext(u.id::text)) % 10 < 8) or abs(hashtext(u.id::text)) % 10 < 3
on conflict do nothing;
insert into public.follows (follower_id, following_id, created_at)
select p.id, u.id, pg_temp.ago((abs(hashtext(u.id::text || 'f')) % 600) + 1)
  from pitch_presenter p join public.profiles u on u.id::text like 'd0000000-0000-4000-8001-%'
 where (u.city_id = p.city_id and abs(hashtext(u.id::text || 'f')) % 10 < 7) or abs(hashtext(u.id::text || 'f')) % 10 < 2
on conflict do nothing;

-- Сыграл 6 прошедших игр в своём городе (с отметкой) и записан на 2 будущие
with games as (
  select l.id, row_number() over (order by l.start_time desc) as rn
    from public.lobbies l, pitch_presenter p
   where l.city_id = p.city_id and l.status = 'finished' and l.id::text like 'd0000000-0000-4000-8002-%'
     and l.start_time > now() - interval '14 days'
)
update public.lobbies l set players_needed = l.players_needed + 1 from games g where g.id = l.id and g.rn <= 6;
insert into public.lobby_applications (lobby_id, user_id, status, created_at, decided_at)
select l.id, p.id, 'accepted', l.created_at + interval '2 hours', l.created_at + interval '4 hours'
  from pitch_presenter p join lateral (
    select * from public.lobbies l where l.city_id = p.city_id and l.status = 'finished' and l.id::text like 'd0000000-0000-4000-8002-%'
       and l.start_time > now() - interval '14 days' order by l.start_time desc limit 6) l on true
on conflict do nothing;
update public.lobbies l set accepted_count = (select count(*) from public.lobby_applications a where a.lobby_id = l.id and a.status = 'accepted')
 where l.id::text like 'd0000000-0000-4000-8002-%';
insert into public.lobby_checkins (lobby_id, user_id, checked_in_at, method, distance_m)
select a.lobby_id, a.user_id, l.start_time - interval '7 minutes', 'place', 6
  from public.lobby_applications a join public.lobbies l on l.id = a.lobby_id join pitch_presenter p on p.id = a.user_id
 where l.status = 'finished'
on conflict do nothing;

with upcoming as (
  select l.id from public.lobbies l, pitch_presenter p
   where l.city_id = p.city_id and l.status = 'active' and l.start_time > now() + interval '3 hours'
     and l.id::text like 'd0000000-0000-4000-8002-%' and l.accepted_count < l.players_needed
   order by l.is_outdoor desc nulls last, l.start_time limit 2
)
insert into public.lobby_applications (lobby_id, user_id, status, created_at, decided_at)
select u.id, p.id, 'accepted', now() - interval '1 day', now() - interval '20 hours' from upcoming u, pitch_presenter p
on conflict do nothing;
update public.lobbies l set accepted_count = (select count(*) from public.lobby_applications a where a.lobby_id = l.id and a.status = 'accepted'),
       status = case when (select count(*) from public.lobby_applications a where a.lobby_id = l.id and a.status = 'accepted') >= l.players_needed then 'full'::public.lobby_status else l.status end
 where l.id::text like 'd0000000-0000-4000-8002-%' and l.status in ('active', 'full');

-- В команде своего города (футбол, если есть)
insert into public.crew_members (crew_id, user_id, role, status, joined_at)
select c.id, p.id, 'member', 'active', now() - interval '40 days'
  from pitch_presenter p join lateral (
    select c.* from public.crews c where c.city_id = p.city_id and c.id::text like 'd0000000-0000-4000-8004-%'
     order by (c.sport = 'football') desc, c.member_count desc limit 1) c on true
on conflict do nothing;

-- Лайки и комментарии к вашим постам
insert into public.likes (post_id, user_id)
select po.id, u.id from pitch_presenter p join public.posts po on po.author_id = p.id
  join public.profiles u on u.id::text like 'd0000000-0000-4000-8001-%' and (u.city_id = p.city_id or abs(hashtext(u.id::text)) % 4 = 0)
 where abs(hashtext(po.id::text || u.id::text)) % 3 = 0
on conflict do nothing;

-- Предупреждение о погоде для вашей ближайшей игры на улице
insert into public.notifications (user_id, type, payload, created_at)
select p.id, 'weather_alert',
       jsonb_build_object('lobby_id', l.id, 'sport', l.sport, 'start_time', l.start_time, 'location', l.location_name,
         'weather', jsonb_build_object('kind', 'rain', 'reasons', jsonb_build_array('rain'), 'precip_prob', 80, 'wind_ms', 7, 'temp_min', 6, 'temp_max', 8)),
       now() - interval '15 minutes'
  from pitch_presenter p join public.lobby_applications a on a.user_id = p.id and a.status = 'accepted'
  join public.lobbies l on l.id = a.lobby_id and l.status in ('active', 'full') and l.is_outdoor
 order by l.start_time limit 1;
`);

sql(`
-- ───────────── Итоги ─────────────
-- Счётчик сыгранных игр не меньше реального
update public.profiles p set games_played = greatest(p.games_played, (
  select count(*) from public.lobbies l where l.status = 'finished' and (l.organizer_id = p.id or exists (
    select 1 from public.lobby_applications a where a.lobby_id = l.id and a.user_id = p.id and a.status = 'accepted'))))
 where p.id::text like 'd0000000-0000-4000-8001-%';

-- Уведомления демо-людям не нужны; у вас остаются подписки, лайки, комментарии и погода
delete from public.notifications where user_id::text like 'd0000000-%';
delete from public.notifications n using pitch_presenter p
 where n.user_id = p.id and n.created_at > now() - interval '1 minute' and n.type not in ('follow', 'like', 'comment', 'weather_alert');
update public.notifications n set read = true, created_at = now() - make_interval(mins => (abs(hashtext(n.id::text)) % 4000) + 30)
  from pitch_presenter p where n.user_id = p.id and n.type = 'follow' and n.created_at > now() - interval '1 minute' and abs(hashtext(n.id::text)) % 5 > 0;

alter table public.notifications enable trigger notifications_push;
alter table public.chat_messages enable trigger chat_messages_guard;
alter table public.chat_messages enable trigger chat_messages_after;

commit;

select
  (select count(*) from public.profiles where id::text like 'd0000000-0000-4000-8001-%') as people,
  (select count(*) from public.follows f where f.follower_id::text like 'd0000000-%') as follows,
  (select count(*) from public.crews where id::text like 'd0000000-0000-4000-8004-%') as crews,
  (select count(*) from public.lobbies where id::text like 'd0000000-0000-4000-8002-%' and status <> 'finished') as upcoming_games,
  (select count(*) from public.lobbies where id::text like 'd0000000-0000-4000-8002-%' and status = 'finished') as past_games,
  (select count(*) from public.posts where id::text like 'd0000000-0000-4000-8003-%') as posts,
  (select count(*) from public.posts where id::text like 'd0000000-0000-4000-8003-%' and lobby_id is not null) as highlights,
  (select count(*) from public.tournaments where id::text like 'd0000000-0000-4000-8005-%') as tournaments,
  (select count(*) from pitch_presenter) as presenter_found;
`);

writeFileSync(OUT, out.join("\n"));
console.log(`OK ${path.relative(ROOT, OUT)}: ${users.length} people, ${crews.length} crews, ${lobbies.length} games, ${posts.length} posts, ${likes.length} likes, ${comments.length} comments, ${tournaments.length} tournaments`);
