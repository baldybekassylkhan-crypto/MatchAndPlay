import { describe, expect, it } from "vitest";
import { EMPTY_FILTERS, filtersToQuery, parseMode } from "@/lib/filters";

describe("режим поиска", () => {
  it("по умолчанию открывается карта", () => {
    expect(parseMode({})).toBe("map");
    expect(parseMode({ mode: "что-то" })).toBe("map");
  });

  it("список и свайпы сохраняются в ссылке, карта не добавляет параметр", () => {
    expect(filtersToQuery(EMPTY_FILTERS, "list")).toBe("?mode=list");
    expect(filtersToQuery(EMPTY_FILTERS, "swipe")).toBe("?mode=swipe");
    expect(filtersToQuery(EMPTY_FILTERS, "map")).toBe("");
    expect(parseMode({ mode: "list" })).toBe("list");
  });
});
