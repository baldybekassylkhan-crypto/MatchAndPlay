import { describe, expect, it } from "vitest";
import { formatAddress } from "@/lib/address";

describe("formatAddress", () => {
  it("показывает название места, улицу и дом", () => {
    expect(formatAddress({ name: "Стадион Жетысу", address: { road: "улица Абая", house_number: "12" } })).toBe(
      "Стадион Жетысу, улица Абая, 12",
    );
  });

  it("не повторяет улицу, если она же является названием", () => {
    expect(formatAddress({ name: "улица Абая", address: { road: "улица Абая" } })).toBe("улица Абая");
  });

  it("без улицы берёт район", () => {
    expect(formatAddress({ address: { suburb: "Каратал" } })).toBe("Каратал");
  });

  it("укладывается в лимит поля", () => {
    expect(formatAddress({ name: "а".repeat(200) })!.length).toBe(120);
  });

  it("возвращает null, если адреса нет", () => {
    expect(formatAddress({})).toBeNull();
  });
});
