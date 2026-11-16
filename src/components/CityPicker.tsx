"use client";

import { Loader2, LocateFixed } from "lucide-react";
import { useMemo, useState } from "react";
import { SheetSelect } from "@/components/ui/SheetSelect";
import { cityOptions } from "@/lib/city-options";
import { nearestCity } from "@/lib/geo";
import type { City } from "@/lib/types";

export function CityPicker({
  cities,
  value,
  onChange,
  name = "city_id",
}: {
  cities: City[];
  value: number | null;
  onChange: (id: number) => void;
  name?: string;
}) {
  const [locating, setLocating] = useState(false);
  const options = useMemo(() => cityOptions(cities), [cities]);
  const [hint, setHint] = useState<string | null>(null);

  function locate() {
    if (!("geolocation" in navigator)) {
      setHint("Геолокация недоступна на этом устройстве");
      return;
    }
    setLocating(true);
    setHint(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false);
        const found = nearestCity(cities, coords.latitude, coords.longitude);
        if (!found) return;
        onChange(found.city.id);
        setHint(
          found.distanceKm > 80
            ? `Ближайший город из списка — ${found.city.name_ru} (${Math.round(found.distanceKm)} км)`
            : `Вы в городе ${found.city.name_ru}`,
        );
      },
      () => {
        setLocating(false);
        setHint("Не удалось определить местоположение — выберите город вручную");
      },
      { timeout: 10000, maximumAge: 600000 },
    );
  }

  return (
    <div>
      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <SheetSelect
            name={name}
            title="Ваш город"
            placeholder="Выберите город"
            searchPlaceholder="Найти город"
            value={value}
            options={options}
            onChange={onChange}
            required
          />
        </div>
        <button type="button" onClick={locate} className="btn-secondary shrink-0 px-4" aria-label="Определить город">
          {locating ? <Loader2 className="size-5 animate-spin" /> : <LocateFixed className="size-5" />}
        </button>
      </div>
      {hint && <p className="mt-1.5 text-sm text-muted">{hint}</p>}
    </div>
  );
}
