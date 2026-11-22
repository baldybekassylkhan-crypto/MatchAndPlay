"use client";

import { ChevronDown, MapPin } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { SheetSelect } from "@/components/ui/SheetSelect";
import { cityOptions } from "@/lib/city-options";
import type { City } from "@/lib/types";

/** Компактный выбор города в шапке: меняет ?city= в адресе, остальные фильтры сохраняет. */
export function CitySwitcher({ cities, value }: { cities: City[]; value: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const options = useMemo(() => cityOptions(cities), [cities]);

  const change = (id: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("city", String(id));
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <SheetSelect
      title="Город"
      searchPlaceholder="Найти город"
      value={value}
      options={options}
      onChange={change}
      trigger={({ open, label }) => (
        <button
          type="button"
          onClick={open}
          aria-haspopup="dialog"
          aria-label={`Город: ${label ?? "не выбран"}`}
          className="glass inline-flex h-10 min-w-0 shrink-0 items-center gap-1.5 rounded-full pr-2.5 pl-3 text-sm font-semibold"
        >
          <MapPin className="size-4" />
          <span className="max-w-[7.5rem] truncate">{label ?? "Город"}</span>
          <ChevronDown className="size-4 text-muted" />
        </button>
      )}
    />
  );
}
