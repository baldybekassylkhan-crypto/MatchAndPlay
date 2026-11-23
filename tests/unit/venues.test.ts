import { describe, expect, it } from "vitest";
import { parseVenuePrefill, venueCreateHref, venuePlace, type Venue } from "@/lib/venues";

const venue: Venue = { id: "w1", k: "football", n: "Поле Динамо", a: "Абая, 10", lat: 43.2, lng: 76.9 };

const params = (href: string) => Object.fromEntries(new URL(href, "https://x.kz").searchParams);

describe("Собрать игру на площадке", () => {
  it("ссылка заполняет спорт, место, точку и город", () => {
    expect(parseVenuePrefill(params(venueCreateHref(venue, 2)), [1, 2])).toEqual({
      sport: "football",
      place: "Поле Динамо, Абая, 10",
      lat: 43.2,
      lng: 76.9,
      cityId: 2,
    });
  });

  it("у спортзала вид спорта остаётся на выбор", () => {
    const gym: Venue = { ...venue, k: "gym" };
    expect(parseVenuePrefill(params(venueCreateHref(gym, 2)), [2])?.sport).toBeNull();
  });

  it("площадка без названия получает понятную подпись", () => {
    expect(venuePlace({ ...venue, n: "", a: "" })).toBe("Футбольное поле");
    expect(venuePlace({ ...venue, n: "" })).toBe("Футбольное поле, Абая, 10");
  });

  it("неверные параметры не заполняют форму", () => {
    expect(parseVenuePrefill({ place: "Поле", lat: "abc", lng: "76" }, [1])).toBeNull();
    expect(parseVenuePrefill({ place: "Поле", lat: "95", lng: "76" }, [1])).toBeNull();
    expect(parseVenuePrefill({ place: "x", lat: "43", lng: "76" }, [1])).toBeNull();
    expect(parseVenuePrefill({ place: "Поле", lat: "43", lng: "76", sport: "chess", city: "99" }, [1])).toMatchObject({ sport: null, cityId: null });
  });
});
