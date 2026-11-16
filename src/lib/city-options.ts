import type { SelectOption } from "@/components/ui/SheetSelect";
import type { City } from "@/lib/types";

/** Города для красивого списка: казахское название справа, поиск по старым названиям. */
export function cityOptions(cities: City[]): SelectOption<number>[] {
  return cities.map((c) => ({ value: c.id, label: c.name_ru, hint: c.name_kz, keywords: [c.name_kz, ...c.aliases] }));
}
