// Оборачивает русский текст в JSX в t("…") и добавляет t в компоненты.
//   node scripts/i18n-wrap.mjs <файл> [<файл> …]
// Клиентские файлы получают const t = useT(), серверные (async) — const t = await getT().
// После запуска проверьте результат: npm run typecheck.

import { readFileSync, writeFileSync } from "node:fs";

const CYR = /[А-Яа-яЁё]/;
const ATTRS = ["aria-label", "placeholder", "title", "ariaLabel", "searchPlaceholder", "alt", "label", "text", "message"];

function wrapText(src) {
  let out = src;
  // Атрибуты: aria-label="Текст" → aria-label={t("Текст")}
  for (const a of ATTRS) {
    out = out.replace(new RegExp(`(\\s${a})="([^"{}]*${CYR.source}[^"{}]*)"`, "g"), (_, attr, text) => `${attr}={t(${JSON.stringify(text)})}`);
  }
  // Строки в тернарниках внутри JSX: cond ? "Текст" : "Текст"
  out = out.replace(new RegExp(String.raw`\?(\s*)"([^"{}]*[А-Яа-яЁё][^"{}]*)"(\s*):`, "g"), (_, s1, text, s2) => `?${s1}t(${JSON.stringify(text)})${s2}:`);
  out = out.replace(new RegExp(String.raw`:(\s*)"([^"{}]*[А-Яа-яЁё][^"{}]*)"(\s*)\}`, "g"), (_, s1, text, s2) => `:${s1}t(${JSON.stringify(text)})${s2}}`);
  // Текст между тегами в одной строке: >Текст< → >{t("Текст")}<
  out = out.replace(/>([^<>{}\n]*)</g, (m, inner) => {
    const text = inner.trim();
    if (!text || !CYR.test(text) || /[`$]/.test(text)) return m;
    const lead = inner.slice(0, inner.indexOf(text[0]));
    const trail = inner.slice(inner.lastIndexOf(text[text.length - 1]) + 1);
    return `>${lead}{t(${JSON.stringify(text)})}${trail}<`;
  });
  // Строка, целиком состоящая из текста внутри JSX
  out = out
    .split("\n")
    .map((line, i, lines) => {
      const text = line.trim();
      if (!text || !CYR.test(text) || /^(\/\/|\/\*|\*|\{|<|import|export|const|let|return|case|if)/.test(text)) return line;
      if (/[{}<>="'`;()]/.test(text.replace(/[«»—–…,.!?:№%+−]/g, ""))) return line;
      const prev = (lines[i - 1] ?? "").trim();
      const next = (lines[i + 1] ?? "").trim();
      const inJsx = (prev.endsWith(">") || prev.endsWith("}") || prev === "") && (next.startsWith("<") || next.startsWith("{") || next.startsWith(")"));
      if (!inJsx) return line;
      const indent = line.slice(0, line.indexOf(text[0]));
      return `${indent}{t(${JSON.stringify(text)})}`;
    })
    .join("\n");
  return out;
}

// Границы тела функции по фигурным скобкам (строки и шаблоны учитываются грубо)
function bodyEnd(src, open) {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'") {
      const q = c;
      for (i++; i < src.length && src[i] !== q; i++) if (src[i] === "\\") i++;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return src.length;
}

function injectT(src, client) {
  const re = /(export\s+(?:default\s+)?)?(async\s+)?function\s+([A-Z]\w*)\s*(<[^>]*>)?\s*\(/g;
  let out = src;
  let m;
  const spots = [];
  while ((m = re.exec(src))) {
    // Пропускаем параметры (они могут содержать фигурные скобки деструктуризации)
    let i = re.lastIndex;
    let depth = 1;
    for (; i < src.length && depth > 0; i++) {
      if (src[i] === "(") depth++;
      else if (src[i] === ")") depth--;
    }
    const open = src.indexOf("{", i);
    const end = bodyEnd(src, open);
    const body = src.slice(open, end);
    if (!/[^\w.]t(\(|\.d\(|\.n\()/.test(body) || /const t = /.test(body)) continue;
    const isAsync = Boolean(m[2]);
    if (!client && !isAsync) {
      console.warn(`! ${m[3]}: серверный компонент не async — добавьте t вручную`);
      continue;
    }
    spots.push({ at: open + 1, text: client ? "\n  const t = useT();" : "\n  const t = await getT();" });
  }
  for (const s of spots.sort((a, b) => b.at - a.at)) out = out.slice(0, s.at) + s.text + out.slice(s.at);
  if (spots.length) {
    const imp = client ? 'import { useT } from "@/components/I18nProvider";' : 'import { getT } from "@/lib/i18n/server";';
    if (!out.includes(imp)) {
      const firstImport = out.search(/^import /m);
      out = out.slice(0, firstImport) + imp + "\n" + out.slice(firstImport);
    }
  }
  return out;
}

for (const file of process.argv.slice(2)) {
  const src = readFileSync(file, "utf8");
  const client = /^["']use client["']/.test(src.trimStart());
  const next = injectT(wrapText(src), client);
  if (next !== src) {
    writeFileSync(file, next);
    console.log("✓", file);
  } else console.log("·", file);
}
