import type { LobbyWithMeta } from "@/lib/types";

const WINDOW_MS = 30 * 60_000;

/** Окно отметки: за 30 минут до начала и до 30 минут после конца игры. Итоговую проверку делает база. */
export function isCheckinOpen(lobby: Pick<LobbyWithMeta, "status" | "start_time" | "duration_min">, now = Date.now()) {
  if (lobby.status === "cancelled") return false;
  const start = new Date(lobby.start_time).getTime();
  return now >= start - WINDOW_MS && now <= start + lobby.duration_min * 60_000 + WINDOW_MS;
}

/** Радиус отметки и допуск на погрешность GPS — те же числа, что в базе (shake_check_in). */
export const CHECKIN_RADIUS_M = 15;
export const CHECKIN_MAX_ACCURACY_M = 50;

/**
 * Встряхивание: несколько резких рывков подряд.
 * push(сила рывка в м/с² без учёта гравитации, время в мс) → true, когда встряхнули.
 */
export function createShakeDetector({ threshold = 14, peaks = 3, windowMs = 1200, gapMs = 120 } = {}) {
  let hits: number[] = [];
  return {
    push(force: number, t: number) {
      if (force < threshold) return false;
      if (hits.length && t - hits[hits.length - 1] < gapMs) return false;
      hits = [...hits.filter((h) => t - h <= windowMs), t];
      if (hits.length >= peaks) {
        hits = [];
        return true;
      }
      return false;
    },
    reset() {
      hits = [];
    },
  };
}

/** Сила рывка из события датчика: без гравитации, если устройство это умеет. */
export function motionForce(e: Pick<DeviceMotionEvent, "acceleration" | "accelerationIncludingGravity">) {
  const a = e.acceleration;
  if (a && a.x != null && a.y != null && a.z != null) return Math.hypot(a.x, a.y, a.z);
  const g = e.accelerationIncludingGravity;
  if (g && g.x != null && g.y != null && g.z != null) return Math.abs(Math.hypot(g.x, g.y, g.z) - 9.81);
  return 0;
}

export type ShakeStatus = "ok" | "already" | "closed" | "not_member" | "too_many" | "weak_gps" | "too_far" | "no_anchor";

export function checkinMessage(r: { status: ShakeStatus; distance?: number | null; accuracy?: number | null; host?: boolean }) {
  switch (r.status) {
    case "too_far":
      if (r.host) {
        return `Вы в ${r.distance} м от точки игры на карте. Вас отметит автоматически, когда рядом с вами отметится первый игрок — держите экран открытым.`;
      }
      return r.distance != null
        ? `Вы примерно в ${r.distance} м от площадки. Подойдите ближе к точке игры или к организатору (до ${CHECKIN_RADIUS_M} м).`
        : "Вы слишком далеко от площадки.";
    case "weak_gps":
      return r.accuracy
        ? `GPS пока неточный (±${r.accuracy} м). Выйдите на открытое место и встряхните ещё раз.`
        : "Не удалось определить место. Включите геолокацию и попробуйте ещё раз.";
    case "no_anchor":
      return "У игры нет точки на карте, а организатор ещё не отметился. Попросите его открыть отметку на своём телефоне.";
    case "too_many":
      return "Слишком много попыток. Подождите минуту.";
    case "closed":
      return "Отметка открыта за 30 минут до начала и до 30 минут после конца игры.";
    case "not_member":
      return "Отметиться могут только принятые игроки.";
    default:
      return null;
  }
}
