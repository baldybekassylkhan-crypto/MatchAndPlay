// Иллюстрированный портрет для демо-аккаунта (SVG 400×400): тон кожи, причёска, черты лица.
// Это рисунок, а не фото реального человека.

const SKIN = {
  kz: ["#f1c9a5", "#e8b98f", "#dcae86", "#d2a079", "#c79270"],
  ko: ["#f3d1b0", "#ecc4a0", "#e3b791"],
  ru: ["#f6d7c0", "#f0c9ad", "#e9bc9b", "#f8dccb"],
};
const HAIR = ["#1a1414", "#231a16", "#2e211a", "#3b2a20", "#141012"];
const HAIR_LIGHT = ["#6b4a2e", "#8a6239", "#b48a52", "#3b2a20", "#2e211a", "#c9a46a"];
const BG = ["#ffd166", "#06d6a0", "#118ab2", "#ef476f", "#8ecae6", "#b8f400", "#ffb4a2", "#cdb4db", "#90be6d", "#f9c74f", "#43aa8b", "#f8961e"];
const SHIRT = ["#1d3557", "#e63946", "#2a9d8f", "#264653", "#f4a261", "#ffffff", "#111111", "#7b2cbf", "#0077b6", "#ff006e", "#3a86ff", "#ffbe0b"];
const HIJAB = ["#2b2d42", "#8d99ae", "#e5989b", "#6d597a", "#b5838d", "#355070", "#f2e9e4"];

export function avatarSvg(person, rnd) {
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const female = person.female;
  const skin = pick(SKIN[person.origin] ?? SKIN.kz);
  const hair = person.origin === "ru" ? pick(HAIR_LIGHT) : pick(HAIR);
  const bg = pick(BG);
  const shirt = pick(SHIRT);
  const hijab = female && person.origin === "kz" && rnd() < 0.18;
  const narrow = person.origin !== "ru";
  const glasses = rnd() < 0.14;
  const beard = !female && rnd() < (person.origin === "kz" ? 0.22 : 0.15);
  const jersey = rnd() < 0.45;
  const number = 1 + Math.floor(rnd() * 23);
  const smile = rnd() < 0.7;
  const shade = (hex, k) => {
    const n = parseInt(hex.slice(1), 16);
    const f = (c) => Math.max(0, Math.min(255, Math.round(c * k)));
    return `#${[f(n >> 16), f((n >> 8) & 255), f(n & 255)].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
  };
  const skinDark = shade(skin, 0.86);
  const ink = "#2a1d18";

  // Плечи и одежда
  let body = `<path d="M60 400 C70 318 130 286 200 286 C270 286 330 318 340 400 Z" fill="${shirt}"/>`;
  if (jersey) {
    const stripe = shirt === "#ffffff" ? "#e63946" : "#ffffff";
    body += `<path d="M168 290 L200 326 L232 290" fill="none" stroke="${stripe}" stroke-width="8"/>
<text x="200" y="384" font-family="Arial, sans-serif" font-size="46" font-weight="800" text-anchor="middle" fill="${stripe}" opacity="0.9">${number}</text>`;
  } else {
    body += `<path d="M172 288 Q200 312 228 288" fill="${skinDark}"/>`;
  }
  const neck = `<rect x="176" y="236" width="48" height="60" rx="18" fill="${skinDark}"/>`;

  // Волосы сзади (длинные)
  let back = "";
  let front = "";
  if (hijab) {
    const h = pick(HIJAB);
    back = `<path d="M108 190 C100 90 300 90 292 190 L300 330 C260 352 140 352 100 330 Z" fill="${h}"/>`;
    front = `<path d="M128 150 C140 92 260 92 272 150 C258 124 142 124 128 150 Z" fill="${shade(h, 0.85)}"/>`;
  } else if (female) {
    const style = Math.floor(rnd() * 4);
    if (style === 0) back = `<path d="M118 170 C110 80 290 80 282 170 L292 318 C250 336 150 336 108 318 Z" fill="${hair}"/>`; // длинные
    if (style === 1) back = `<path d="M124 168 C118 86 282 86 276 168 L282 250 C250 262 150 262 118 250 Z" fill="${hair}"/>`; // каре
    if (style === 2) back = `<circle cx="200" cy="78" r="34" fill="${hair}"/>`; // пучок
    if (style === 3) back = `<path d="M262 120 C330 150 320 250 292 300 C300 230 290 170 262 150 Z" fill="${hair}"/>`; // хвост
    front = `<path d="M122 178 C110 84 168 64 204 66 C252 68 294 100 278 178 C264 128 234 106 200 106 C166 108 138 128 122 178 Z" fill="${hair}"/>`;
  } else {
    const style = Math.floor(rnd() * 4);
    if (style === 0) front = `<path d="M124 172 C116 94 160 74 200 74 C240 74 284 94 276 172 C270 140 250 116 200 114 C150 116 130 140 124 172 Z" fill="${hair}"/>`; // коротко
    if (style === 1) front = `<path d="M122 170 C108 84 158 56 206 60 C256 64 294 96 278 170 C268 130 244 108 200 108 C156 110 132 130 122 170 Z" fill="${hair}"/>`; // объём
    if (style === 2) front = `<path d="M128 160 C126 98 168 84 200 84 C232 84 274 98 272 160 C256 126 144 126 128 160 Z" fill="${hair}" opacity="0.88"/>`; // коротко под машинку
    if (style === 3) front = `<path d="M122 172 C112 88 170 66 212 70 C258 74 292 104 278 172 C264 126 236 116 214 100 C196 126 156 128 122 172 Z" fill="${hair}"/>`; // пробор
  }

  // Лицо
  const face = `<ellipse cx="200" cy="178" rx="72" ry="86" fill="${skin}"/>
<ellipse cx="128" cy="184" rx="12" ry="18" fill="${skinDark}"/><ellipse cx="272" cy="184" rx="12" ry="18" fill="${skinDark}"/>`;
  const eyeRy = narrow ? 4.5 : 7;
  const eyes = `<ellipse cx="172" cy="180" rx="10" ry="${eyeRy}" fill="${ink}"/><ellipse cx="228" cy="180" rx="10" ry="${eyeRy}" fill="${ink}"/>
<circle cx="175" cy="178" r="2" fill="#fff" opacity="0.8"/><circle cx="231" cy="178" r="2" fill="#fff" opacity="0.8"/>`;
  const brows = `<path d="M156 ${hijab ? 162 : 160} q16 -8 32 0" stroke="${hijab ? ink : hair}" stroke-width="6" fill="none" stroke-linecap="round"/>
<path d="M212 ${hijab ? 162 : 160} q16 -8 32 0" stroke="${hijab ? ink : hair}" stroke-width="6" fill="none" stroke-linecap="round"/>`;
  const nose = `<path d="M200 186 q-8 22 0 26" stroke="${skinDark}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
  const mouth = smile
    ? `<path d="M178 228 q22 18 44 0" stroke="${shade(skin, 0.6)}" stroke-width="6" fill="${female ? "#e07a7a" : "none"}" stroke-linecap="round"/>`
    : `<path d="M182 232 h36" stroke="${shade(skin, 0.6)}" stroke-width="6" stroke-linecap="round"/>`;
  const cheeks = female ? `<circle cx="154" cy="210" r="12" fill="#ff8f8f" opacity="0.25"/><circle cx="246" cy="210" r="12" fill="#ff8f8f" opacity="0.25"/>` : "";
  const beardSvg = beard ? `<path d="M134 198 C140 270 260 270 266 198 C250 252 150 252 134 198 Z" fill="${hair}" opacity="0.85"/>` : "";
  const glassesSvg = glasses
    ? `<g fill="none" stroke="#1b1b1b" stroke-width="5"><circle cx="172" cy="180" r="20"/><circle cx="228" cy="180" r="20"/><path d="M192 180 h16"/></g>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
<rect width="400" height="400" fill="${bg}"/>
<circle cx="320" cy="70" r="90" fill="#fff" opacity="0.15"/>
${back}${neck}${body}${face}${cheeks}${beardSvg}${front}${brows}${eyes}${glassesSvg}${nose}${mouth}
</svg>`;
}
