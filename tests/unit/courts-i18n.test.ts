import { describe, expect, it } from "vitest";
import { akimatAppeal, courtReportHref, isFreeCourt, issuesFor } from "@/lib/courts";
import { localizeDate, makeT } from "@/lib/i18n/core";
import { KK } from "@/lib/i18n/kk";
import { parseFilters, filtersToQuery, EMPTY_FILTERS } from "@/lib/filters";

describe("площадки", () => {
  it("бесплатная площадка — открытое поле без признаков клуба", () => {
    expect(isFreeCourt({ k: "basketball", n: "" })).toBe(true);
    expect(isFreeCourt({ k: "football", n: "Поле у школы №12" })).toBe(true);
    expect(isFreeCourt({ k: "football", n: "Манеж «Чемпион»" })).toBe(false);
    expect(isFreeCourt({ k: "gym", n: "" })).toBe(false);
  });
  it("виды проблем зависят от площадки", () => {
    expect(issuesFor("basketball")).toContain("hoop");
    expect(issuesFor("football")).toContain("goal");
    expect(issuesFor("football")).not.toContain("hoop");
  });
  it("ссылка на обращение содержит площадку", () => {
    const href = courtReportHref({ id: "n123", k: "basketball", n: "", a: "Абая 10", lat: 43.2, lng: 76.9 }, 2);
    expect(href).toContain("venue=n123");
    expect(href).toContain("city=2");
  });
  it("текст обращения в акимат", () => {
    const text = akimatAppeal("Алматы", [{ venue_name: "Площадка у дома", kind: "hoop", comment: "болты торчат", lat: 43.2, lng: 76.9, votes: 7, created_at: "2026-11-20T10:00:00Z" }]);
    expect(text).toContain("В акимат города Алматы");
    expect(text).toContain("сломано кольцо или щит");
    expect(text).toContain("Сообщили жители: 7");
    expect(text).toContain("openstreetmap.org");
  });
});

describe("язык интерфейса", () => {
  it("русский — без изменений, казахский — из словаря, неизвестное — по-русски", () => {
    expect(makeT("ru")("Игры")).toBe("Игры");
    expect(makeT("kk")("Игры")).toBe(KK["Игры"]);
    expect(makeT("kk")("Строка без перевода")).toBe("Строка без перевода");
  });
  it("подстановки", () => {
    expect(makeT("ru")("{joined} из {total}", { joined: 3, total: 8 })).toBe("3 из 8");
  });
  it("числа: три формы по-русски, одна по-казахски", () => {
    expect(makeT("ru").n(5, ["игра", "игры", "игр"])).toBe("игр");
    expect(makeT("ru").n(22, ["игра", "игры", "игр"])).toBe("игры");
    expect(makeT("kk").n(5, ["игра", "игры", "игр"])).toBe(KK["игра"] ?? "игра");
  });
  it("даты", () => {
    expect(localizeDate("kk", "Сегодня, 19:00")).toBe("Бүгін, 19:00");
    expect(localizeDate("kk", "25 ноября")).toBe("25 қараша");
    expect(localizeDate("ru", "Сегодня")).toBe("Сегодня");
  });
  it("все переводы непустые и сохраняют подстановки", () => {
    for (const [ru, kk] of Object.entries(KK)) {
      expect(kk.trim().length).toBeGreaterThan(0);
      for (const ph of ru.match(/\{\w+\}/g) ?? []) expect(kk).toContain(ph);
    }
  });
});

describe("фильтр «только для девушек»", () => {
  it("читается из адреса и попадает обратно", () => {
    expect(parseFilters({ women: "1" }).women).toBe(true);
    expect(filtersToQuery({ ...EMPTY_FILTERS, women: true })).toBe("?women=1");
  });
});
