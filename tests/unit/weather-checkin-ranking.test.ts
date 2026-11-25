import { describe, expect, it } from "vitest";
import { checkinMessage, createShakeDetector, motionForce } from "@/lib/checkin";
import { currentKzMonth, daysUntilReset, monthLabel, recentMonths } from "@/lib/ranking";
import { assessWeather, codeKind, describeWeather, type HourForecast } from "@/lib/weather";

const hour = (iso: string, o: Partial<HourForecast> = {}): HourForecast => ({
  time: iso, temp: 12, precipProb: 10, precipMm: 0, windKmh: 10, code: 1, ...o,
});

describe("погода", () => {
  const start = "2026-11-25T14:00:00.000Z"; // 19:00 по Казахстану
  it("берёт только часы игры", () => {
    const hours = [
      hour("2026-11-25T12:00:00.000Z", { precipProb: 100, code: 63 }),
      hour("2026-11-25T14:00:00.000Z"),
      hour("2026-11-25T15:00:00.000Z", { temp: 9 }),
      hour("2026-11-25T16:00:00.000Z", { precipProb: 100, code: 63 }),
    ];
    const w = assessWeather(hours, start, 90)!;
    expect(w.bad).toBe(false);
    expect([w.tempMin, w.tempMax]).toEqual([9, 12]);
  });
  it("дождь, гроза, ветер и мороз дают предупреждение", () => {
    expect(assessWeather([hour(start, { precipProb: 80, code: 61 })], start, 60)!.reasons).toEqual(["rain"]);
    expect(assessWeather([hour(start, { code: 95 })], start, 60)!.reasons).toContain("storm");
    expect(assessWeather([hour(start, { windKmh: 45 })], start, 60)!.reasons).toEqual(["wind"]);
    expect(assessWeather([hour(start, { temp: -25 })], start, 60)!.reasons).toEqual(["cold"]);
    expect(assessWeather([hour(start, { temp: -3, precipProb: 90, code: 73 })], start, 60)!.reasons).toEqual(["snow"]);
  });
  it("облачно с малой вероятностью осадков — без предупреждения", () => {
    expect(assessWeather([hour(start, { code: 3, precipProb: 30 })], start, 60)!.bad).toBe(false);
  });
  it("нет прогноза на время игры", () => {
    expect(assessWeather([hour("2026-11-20T10:00:00.000Z")], start, 60)).toBeNull();
  });
  it("коды и текст", () => {
    expect(codeKind(0)).toBe("clear");
    expect(codeKind(81)).toBe("rain");
    expect(codeKind(75)).toBe("snow");
    expect(describeWeather({ reasons: ["rain", "wind"], precipProb: 80, windMs: 12, tempMin: 6, tempMax: 8 })).toBe(
      "дождь (вероятность 80%), сильный ветер 12 м/с, +6°…+8°",
    );
  });
});

describe("встряхивание", () => {
  it("три рывка за секунду — встряхнули", () => {
    const d = createShakeDetector();
    expect(d.push(20, 0)).toBe(false);
    expect(d.push(20, 300)).toBe(false);
    expect(d.push(20, 600)).toBe(true);
  });
  it("слабые и редкие движения не считаются", () => {
    const d = createShakeDetector();
    expect([d.push(5, 0), d.push(6, 200), d.push(7, 400)]).toEqual([false, false, false]);
    expect([d.push(20, 0), d.push(20, 2000), d.push(20, 4000)]).toEqual([false, false, false]);
  });
  it("один длинный рывок не считается несколькими", () => {
    const d = createShakeDetector();
    expect([d.push(20, 0), d.push(20, 30), d.push(20, 60), d.push(20, 90)].some(Boolean)).toBe(false);
  });
  it("сила рывка без гравитации", () => {
    expect(motionForce({ acceleration: { x: 3, y: 4, z: 0 }, accelerationIncludingGravity: null } as never)).toBe(5);
    expect(motionForce({ acceleration: null, accelerationIncludingGravity: { x: 0, y: 0, z: 9.81 } } as never)).toBeCloseTo(0);
  });
  it("понятные сообщения", () => {
    expect(checkinMessage({ status: "too_far", distance: 120 })).toContain("120 м");
    expect(checkinMessage({ status: "weak_gps", accuracy: 80 })).toContain("±80 м");
    expect(checkinMessage({ status: "ok" })).toBeNull();
  });
});

describe("месяцы рейтинга", () => {
  it("месяц по времени Казахстана", () => {
    expect(currentKzMonth(new Date("2026-11-30T19:30:00Z"))).toBe("2026-12");
    expect(currentKzMonth(new Date("2026-11-30T18:30:00Z"))).toBe("2026-11");
  });
  it("последние месяцы и подписи", () => {
    const now = new Date("2026-01-10T10:00:00Z");
    expect(recentMonths(3, now)).toEqual(["2026-01", "2025-12", "2025-11"]);
    expect(monthLabel("2026-01", now)).toBe("Январь");
    expect(monthLabel("2025-12", now)).toBe("Декабрь 2025");
  });
  it("дней до обновления", () => {
    expect(daysUntilReset(new Date("2026-11-25T10:00:00Z"))).toBe(6);
  });
});
