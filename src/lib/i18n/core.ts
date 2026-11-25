import { KK } from "@/lib/i18n/kk";

/**
 * Язык интерфейса: русский (исходный) и казахский.
 * Ключ перевода — сам русский текст, поэтому непереведённое просто остаётся по-русски.
 */
export type Locale = "ru" | "kk";
export const LOCALES: Locale[] = ["ru", "kk"];
export const LOCALE_COOKIE = "lang";
export const LOCALE_NAMES: Record<Locale, string> = { ru: "Русский", kk: "Қазақша" };

export const isLocale = (v: unknown): v is Locale => v === "ru" || v === "kk";

type Vars = Record<string, string | number>;

const fill = (s: string, vars?: Vars) => (vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : s);

export function translate(locale: Locale, text: string, vars?: Vars) {
  return fill(locale === "kk" ? (KK[text] ?? text) : text, vars);
}

// Даты и время приходят из lib/time по-русски — заменяем слова целиком
const DATE_WORDS: [RegExp, string][] = [
  [/Сегодня/g, "Бүгін"], [/сегодня/g, "бүгін"], [/Завтра/g, "Ертең"], [/завтра/g, "ертең"], [/Вчера/g, "Кеше"], [/вчера/g, "кеше"],
  [/понедельник/gi, "дүйсенбі"], [/вторник/gi, "сейсенбі"], [/среда|среду/gi, "сәрсенбі"], [/четверг/gi, "бейсенбі"],
  [/пятница|пятницу/gi, "жұма"], [/суббота|субботу/gi, "сенбі"], [/воскресенье/gi, "жексенбі"],
  [/\bпн\b/g, "дс"], [/\bвт\b/g, "сс"], [/\bср\b/g, "ср"], [/\bчт\b/g, "бс"], [/\bпт\b/g, "жм"], [/\bсб\b/g, "сб"], [/\bвс\b/g, "жс"],
  [/января/g, "қаңтар"], [/февраля/g, "ақпан"], [/марта/g, "наурыз"], [/апреля/g, "сәуір"], [/мая/g, "мамыр"], [/июня/g, "маусым"],
  [/июля/g, "шілде"], [/августа/g, "тамыз"], [/сентября/g, "қыркүйек"], [/октября/g, "қазан"], [/ноября/g, "қараша"], [/декабря/g, "желтоқсан"],
  [/(\d+) мин назад/g, "$1 мин бұрын"], [/(\d+) ч назад/g, "$1 сағ бұрын"], [/(\d+) дн назад/g, "$1 күн бұрын"], [/только что/g, "жаңа ғана"],
  [/ с человека/g, " адамға"], [/Бесплатно/g, "Тегін"],
];

export function localizeDate(locale: Locale, text: string) {
  if (locale !== "kk") return text;
  return DATE_WORDS.reduce((s, [re, to]) => s.replace(re, to), text);
}

export interface T {
  (text: string, vars?: Vars): string;
  /** Дата, время, «2 ч назад» из lib/time */
  d: (text: string) => string;
  /** Число + слово: по-русски три формы, по-казахски одна */
  n: (count: number, forms: [string, string, string]) => string;
  locale: Locale;
}

export function makeT(locale: Locale): T {
  const t = ((text: string, vars?: Vars) => translate(locale, text, vars)) as T;
  t.d = (text) => localizeDate(locale, text);
  t.n = (count, forms) => {
    if (locale === "kk") return translate(locale, forms[0]);
    const m10 = count % 10;
    const m100 = count % 100;
    if (m10 === 1 && m100 !== 11) return forms[0];
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return forms[1];
    return forms[2];
  };
  t.locale = locale;
  return t;
}
