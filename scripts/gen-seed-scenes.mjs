// Рисует иллюстрации для демо-постов: public/seed/scenes/<sport>-<n>.svg (1080×1350).
//   node scripts/gen-seed-scenes.mjs
// Вид сверху на поле/площадку с игроками, в разных палитрах (день, вечер, прожекторы).

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "../public/seed/scenes");
mkdirSync(DIR, { recursive: true });

let s = 7;
const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
const W = 1080, H = 1350;

const wrap = (body, defs = "") => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>${defs}
<radialGradient id="vig" cx="50%" cy="45%" r="75%"><stop offset="60%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="0.45"/></radialGradient>
<filter id="sh" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="6" stdDeviation="6" flood-opacity="0.35"/></filter>
</defs>
${body}
<rect width="${W}" height="${H}" fill="url(#vig)"/>
</svg>`;

function players(n, colors, area, r = 18) {
  let out = "";
  for (let i = 0; i < n; i++) {
    const x = area.x + rnd() * area.w, y = area.y + rnd() * area.h;
    const c = colors[i % colors.length];
    out += `<g filter="url(#sh)"><circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r}" fill="${c}"/><circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r * 0.45}" fill="#000" opacity="0.25"/></g>`;
  }
  return out;
}
const glow = (cx, cy, o = 0.35) =>
  `<circle cx="${cx}" cy="${cy}" r="520" fill="url(#gl)" opacity="${o}"/>`;
const glowDef = (c = "#fff6d5") => `<radialGradient id="gl"><stop offset="0" stop-color="${c}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`;

function football([g1, g2, line, teams, night]) {
  let stripes = "";
  for (let i = 0; i < 10; i++) stripes += `<rect x="0" y="${i * 135}" width="${W}" height="135" fill="${i % 2 ? g1 : g2}"/>`;
  const L = `stroke="${line}" stroke-width="8" fill="none" opacity="0.9"`;
  const field = `<rect x="80" y="90" width="920" height="1170" ${L}/>
<line x1="80" y1="675" x2="1000" y2="675" ${L}/><circle cx="540" cy="675" r="140" ${L}/><circle cx="540" cy="675" r="8" fill="${line}"/>
<rect x="290" y="90" width="500" height="200" ${L}/><rect x="410" y="90" width="260" height="80" ${L}/>
<rect x="290" y="1060" width="500" height="200" ${L}/><rect x="410" y="1180" width="260" height="80" ${L}/>
<rect x="460" y="60" width="160" height="30" fill="none" stroke="${line}" stroke-width="6"/><rect x="460" y="1260" width="160" height="30" fill="none" stroke="${line}" stroke-width="6"/>`;
  const ball = `<g filter="url(#sh)"><circle cx="${600 + rnd() * 120}" cy="${560 + rnd() * 160}" r="16" fill="#fff"/><circle cx="600" cy="0" r="0"/></g>`;
  const lights = night ? glow(0, 0) + glow(W, 0) + glow(0, H) + glow(W, H) : "";
  return wrap(stripes + field + players(14, teams, { x: 140, y: 160, w: 800, h: 1030 }) + ball + lights, night ? glowDef() : "");
}
function basketball([floor, paint, line, teams, night]) {
  const L = `stroke="${line}" stroke-width="8" fill="none"`;
  const body = `<rect width="${W}" height="${H}" fill="${floor}"/>
${Array.from({ length: 18 }, (_, i) => `<rect x="${i * 60}" y="0" width="60" height="${H}" fill="#000" opacity="${i % 2 ? 0.04 : 0}"/>`).join("")}
<rect x="90" y="90" width="900" height="1170" ${L}/><line x1="90" y1="675" x2="990" y2="675" ${L}/><circle cx="540" cy="675" r="120" ${L}/>
<rect x="380" y="90" width="320" height="380" fill="${paint}" opacity="0.85"/><rect x="380" y="90" width="320" height="380" ${L}/><circle cx="540" cy="470" r="120" ${L}/>
<path d="M150 90 V250 A400 400 0 0 0 930 250 V90" ${L}/>
<rect x="380" y="880" width="320" height="380" fill="${paint}" opacity="0.85"/><rect x="380" y="880" width="320" height="380" ${L}/><circle cx="540" cy="880" r="120" ${L}/>
<path d="M150 1260 V1100 A400 400 0 0 1 930 1100 V1260" ${L}/>
<circle cx="540" cy="150" r="26" fill="none" stroke="#ff5a1f" stroke-width="8"/><circle cx="540" cy="1200" r="26" fill="none" stroke="#ff5a1f" stroke-width="8"/>
<g filter="url(#sh)"><circle cx="${520 + rnd() * 80}" cy="${360 + rnd() * 80}" r="22" fill="#e8742a"/><path d="M500 380 h80" stroke="#5a2a0a" stroke-width="3"/></g>`;
  return wrap(body + players(8, teams, { x: 200, y: 200, w: 680, h: 700 }, 20) + (night ? glow(540, 0, 0.3) + glow(540, H, 0.3) : ""), night ? glowDef("#ffffff") : "");
}
function volleyball([floor, out, line, teams]) {
  const L = `stroke="${line}" stroke-width="8" fill="none"`;
  return wrap(`<rect width="${W}" height="${H}" fill="${out}"/><rect x="190" y="125" width="700" height="1100" fill="${floor}"/>
<rect x="190" y="125" width="700" height="1100" ${L}/><line x1="190" y1="492" x2="890" y2="492" ${L}/><line x1="190" y1="858" x2="890" y2="858" ${L}/>
<line x1="140" y1="675" x2="940" y2="675" stroke="#fff" stroke-width="10"/><line x1="140" y1="690" x2="940" y2="690" stroke="#000" stroke-width="6" opacity="0.2"/>
<circle cx="140" cy="675" r="12" fill="#ddd"/><circle cx="940" cy="675" r="12" fill="#ddd"/>
${players(12, teams, { x: 240, y: 190, w: 600, h: 970 })}
<g filter="url(#sh)"><circle cx="${560 + rnd() * 100}" cy="${600 - rnd() * 100}" r="20" fill="#fff"/><path d="M548 590 q12 -10 24 0" stroke="#f2c230" stroke-width="5" fill="none"/></g>`);
}
function tennis([court, out, line]) {
  const L = `stroke="${line}" stroke-width="8" fill="none"`;
  return wrap(`<rect width="${W}" height="${H}" fill="${out}"/><rect x="220" y="150" width="640" height="1050" fill="${court}"/>
<rect x="220" y="150" width="640" height="1050" ${L}/><line x1="300" y1="150" x2="300" y2="1200" ${L}/><line x1="780" y1="150" x2="780" y2="1200" ${L}/>
<line x1="300" y1="420" x2="780" y2="420" ${L}/><line x1="300" y1="930" x2="780" y2="930" ${L}/><line x1="540" y1="420" x2="540" y2="930" ${L}/>
<line x1="180" y1="675" x2="900" y2="675" stroke="#f4f4f4" stroke-width="10"/>
${players(2, ["#f4f4f4", "#111"], { x: 330, y: 220, w: 420, h: 900 }, 22)}
<g filter="url(#sh)"><circle cx="${420 + rnd() * 240}" cy="${500 + rnd() * 300}" r="13" fill="#d8f238"/></g>`);
}
function hockey([ice, line, teams]) {
  return wrap(`<rect width="${W}" height="${H}" fill="#1b2430"/><rect x="110" y="70" width="860" height="1210" rx="220" fill="${ice}"/>
<rect x="110" y="70" width="860" height="1210" rx="220" fill="none" stroke="#c9d6e3" stroke-width="10"/>
<line x1="110" y1="675" x2="970" y2="675" stroke="#d8323b" stroke-width="14"/><line x1="110" y1="450" x2="970" y2="450" stroke="${line}" stroke-width="14"/><line x1="110" y1="900" x2="970" y2="900" stroke="${line}" stroke-width="14"/>
<line x1="110" y1="190" x2="970" y2="190" stroke="#d8323b" stroke-width="5"/><line x1="110" y1="1160" x2="970" y2="1160" stroke="#d8323b" stroke-width="5"/>
<circle cx="540" cy="675" r="110" fill="none" stroke="${line}" stroke-width="6"/>
${[[300, 310], [780, 310], [300, 1040], [780, 1040]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="90" fill="none" stroke="#d8323b" stroke-width="5"/><circle cx="${x}" cy="${y}" r="10" fill="#d8323b"/>`).join("")}
<path d="M480 190 h120 v-40 a60 60 0 0 0 -120 0 z" fill="${line}" opacity="0.35"/>
${players(10, teams, { x: 200, y: 220, w: 680, h: 900 })}
<g filter="url(#sh)"><ellipse cx="${500 + rnd() * 80}" cy="${600 + rnd() * 120}" rx="16" ry="11" fill="#111"/></g>`);
}
function running([track, grass, line]) {
  let lanes = "";
  for (let i = 0; i < 6; i++) {
    const d = i * 38;
    lanes += `<rect x="${140 + d}" y="${120 + d}" width="${800 - 2 * d}" height="${1110 - 2 * d}" rx="${400 - d}" fill="none" stroke="${line}" stroke-width="4" opacity="0.8"/>`;
  }
  return wrap(`<rect width="${W}" height="${H}" fill="${grass}"/><rect x="120" y="100" width="840" height="1150" rx="420" fill="${track}"/>
<rect x="348" y="328" width="384" height="694" rx="192" fill="${grass}"/>${lanes}
<line x1="140" y1="675" x2="348" y2="675" stroke="#fff" stroke-width="10"/>
${players(6, ["#ffffff", "#ffd400", "#00c2ff", "#ff4d6d", "#7cff6b", "#111"], { x: 150, y: 500, w: 170, h: 360 }, 16)}`);
}

const SETS = {
  football: [
    ["#3f9a3a", "#47a842", "#ffffff", ["#ffffff", "#e63946"], false],
    ["#1f5e33", "#236a39", "#e8f5e9", ["#ffd166", "#118ab2"], true],
    ["#2f8f6b", "#35a079", "#ffffff", ["#111111", "#f4a261"], false],
    ["#24492b", "#2a5531", "#dfeee0", ["#ffffff", "#3a86ff"], true],
  ],
  basketball: [
    ["#d9a066", "#c0392b", "#ffffff", ["#1d3557", "#ffffff"], false],
    ["#2b4c7e", "#e76f51", "#ffffff", ["#ffd166", "#111111"], false],
    ["#c98b52", "#264653", "#f8f8f8", ["#e63946", "#ffffff"], true],
    ["#3d3d4a", "#7b2cbf", "#e0e0e0", ["#ffffff", "#ff9f1c"], true],
  ],
  volleyball: [
    ["#e9c46a", "#d4a373", "#ffffff", ["#e63946", "#1d3557"]],
    ["#f28c28", "#1d4ed8", "#ffffff", ["#ffffff", "#111111"]],
    ["#efd9a7", "#9ad1d4", "#ffffff", ["#ff006e", "#3a86ff"]],
    ["#2a9d8f", "#264653", "#ffffff", ["#ffd166", "#ef476f"]],
  ],
  tennis: [["#2d6cdf", "#3f8f5a", "#ffffff"], ["#c65d3b", "#a84d30", "#ffffff"], ["#3e8e5e", "#2c6b45", "#ffffff"], ["#5b3fa0", "#2b8a6e", "#ffffff"]],
  hockey: [["#eef6fb", "#1d4ed8", ["#d8323b", "#1d3557"]], ["#e3f0f8", "#1e40af", ["#111111", "#ffd166"]], ["#f2f8fc", "#2563eb", ["#ffffff", "#e63946"]], ["#e6f1f9", "#1d4ed8", ["#2a9d8f", "#111111"]]],
  running: [["#c8553d", "#4f9d4a", "#ffffff"], ["#2f6fb3", "#3c8d4a", "#ffffff"], ["#b8432f", "#2f7d3a", "#fefefe"], ["#8a3a2f", "#4b8b3b", "#ffffff"]],
};
const DRAW = { football, basketball, volleyball, tennis, hockey, running };
for (const [sport, sets] of Object.entries(SETS)) {
  sets.forEach((p, i) => writeFileSync(path.join(DIR, `${sport}-${i + 1}.svg`), DRAW[sport](p)));
}
console.log("OK", Object.values(SETS).flat().length, "scenes in public/seed/scenes");
