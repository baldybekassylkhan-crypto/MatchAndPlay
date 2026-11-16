/**
 * Весь Казахстан живёт по UTC+5. Храним время в UTC, показываем в UTC+5.
 * Смещение задано явно, а не через "Asia/Almaty": на устройствах со старой базой
 * часовых поясов Алматы ещё может считаться UTC+6.
 */
export const KZ_OFFSET_MIN = 5 * 60;
export const LEAVE_DEADLINE_MIN = 30;

const shift = (d: Date) => new Date(d.getTime() + KZ_OFFSET_MIN * 60_000);

const pad = (n: number) => String(n).padStart(2, "0");

const WEEKDAYS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const WEEKDAYS_FULL = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

/** Части даты в казахстанском времени. */
export function kzParts(input: Date | string) {
  const d = shift(new Date(input));
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth(),
    day: d.getUTCDate(),
    weekday: d.getUTCDay(),
    hours: d.getUTCHours(),
    minutes: d.getUTCMinutes(),
  };
}

/** Полночь по времени Казахстана через offsetDays дней от сегодняшнего дня (в UTC). */
export function kzStartOfDay(offsetDays = 0, now: Date = new Date()) {
  const p = kzParts(now);
  return new Date(Date.UTC(p.year, p.month, p.day + offsetDays) - KZ_OFFSET_MIN * 60_000);
}

/** "2026-11-21" и "18:30" из UTC-даты — для полей формы. */
export function toKzInputs(input: Date | string) {
  const p = kzParts(input);
  return { date: `${p.year}-${pad(p.month + 1)}-${pad(p.day)}`, time: `${pad(p.hours)}:${pad(p.minutes)}` };
}

/** Дата и время из полей формы (время Казахстана) → UTC Date. */
export function fromKzInputs(date: string, time: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^(\d{2}):(\d{2})$/.exec(time);
  if (!m || !t) return null;
  const utc = Date.UTC(+m[1], +m[2] - 1, +m[3], +t[1], +t[2]) - KZ_OFFSET_MIN * 60_000;
  return Number.isNaN(utc) ? null : new Date(utc);
}

function dayDiff(a: Date | string, b: Date | string) {
  const pa = kzParts(a);
  const pb = kzParts(b);
  return Math.round((Date.UTC(pa.year, pa.month, pa.day) - Date.UTC(pb.year, pb.month, pb.day)) / 86_400_000);
}

/** "Сегодня", "Завтра", "Сб, 21 ноября". */
export function formatDay(input: Date | string, now: Date = new Date()) {
  const diff = dayDiff(input, now);
  if (diff === 0) return "Сегодня";
  if (diff === 1) return "Завтра";
  const p = kzParts(input);
  return `${WEEKDAYS[p.weekday]}, ${p.day} ${MONTHS[p.month]}`;
}

/** Короткая подпись для карточек: "Сегодня 19:00", "Сб 19:00", "3 дек 19:00". */
export function formatShortDayTime(input: Date | string, now: Date = new Date()) {
  const diff = dayDiff(input, now);
  const p = kzParts(input);
  const time = `${pad(p.hours)}:${pad(p.minutes)}`;
  if (diff === 0) return `Сегодня ${time}`;
  if (diff === 1) return `Завтра ${time}`;
  if (diff > 1 && diff < 7) return `${WEEKDAYS[p.weekday]} ${time}`;
  return `${p.day} ${MONTHS[p.month].slice(0, 3)} ${time}`;
}

export function formatTime(input: Date | string) {
  const p = kzParts(input);
  return `${pad(p.hours)}:${pad(p.minutes)}`;
}

/** "Сегодня, 18:30" */
export function formatDayTime(input: Date | string, now?: Date) {
  return `${formatDay(input, now)}, ${formatTime(input)}`;
}

/** "суббота, 21 ноября" — для страницы лобби. */
export function formatLongDate(input: Date | string) {
  const p = kzParts(input);
  return `${WEEKDAYS_FULL[p.weekday]}, ${p.day} ${MONTHS[p.month]}`;
}

export function formatDuration(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} мин`;
  return m ? `${h} ч ${m} мин` : `${h} ч`;
}

/** Можно ли ещё отказаться от игры (не позднее чем за 30 минут до начала). */
export function canLeaveGame(startTime: Date | string, now: Date = new Date()) {
  return new Date(startTime).getTime() - now.getTime() >= LEAVE_DEADLINE_MIN * 60_000;
}

export function hasStarted(startTime: Date | string, now: Date = new Date()) {
  return new Date(startTime).getTime() <= now.getTime();
}

export function formatPrice(kzt: number | null) {
  if (kzt === null || kzt === 0) return "Бесплатно";
  return `${new Intl.NumberFormat("ru-RU").format(kzt)} ₸ с человека`;
}

/** "только что", "5 мин", "3 ч", "2 дн", дальше — дата. */
export function timeAgo(input: Date | string, now: Date = new Date()) {
  const sec = Math.max(0, (now.getTime() - new Date(input).getTime()) / 1000);
  if (sec < 60) return "только что";
  if (sec < 3600) return `${Math.floor(sec / 60)} мин`;
  if (sec < 86_400) return `${Math.floor(sec / 3600)} ч`;
  if (sec < 7 * 86_400) return `${Math.floor(sec / 86_400)} дн`;
  const p = kzParts(input);
  return `${p.day} ${MONTHS[p.month]}`;
}

/** Склонение: plural(3, ["игрок", "игрока", "игроков"]) */
export function plural(n: number, forms: [string, string, string]) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}
