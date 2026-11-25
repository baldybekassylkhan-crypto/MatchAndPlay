"use client";

import { useT } from "@/components/I18nProvider";
import clsx from "clsx";
import { Check } from "lucide-react";
import { SportIcon } from "@/components/ui/SportIcon";
import { SPORT_IDS, SPORTS, type SportId } from "@/lib/sports";

const SHORT: Partial<Record<SportId, string>> = { table_tennis: "Наст. теннис" };

/** Виды спорта: спокойная сетка значков, выбранные отмечены акцентом и галочкой. */
export function SportGrid({
  selected,
  onToggle,
  ariaLabel = "Виды спорта",
}: {
  selected: SportId[];
  onToggle: (id: SportId) => void;
  animateIn?: boolean;
  ariaLabel?: string;
}) {
  const t = useT();
  return (
    <div role="group" aria-label={t(ariaLabel)} className="grid w-full grid-cols-3 gap-2 sm:grid-cols-4">
      {SPORT_IDS.map((id) => {
        const on = selected.includes(id);
        return (
          <button
            key={id}
            type="button"
            aria-pressed={on}
            title={t(SPORTS[id].label)}
            onClick={() => onToggle(id)}
            className={clsx(
              "relative flex h-[78px] flex-col items-center justify-center gap-1.5 rounded-2xl px-1 text-center active:opacity-60",
              on ? "bg-accent/12 text-accent" : "bg-surface-2 text-ink",
            )}
          >
            <SportIcon sport={id} className="size-6" />
            <span className="w-full truncate text-xs font-medium">{t(SHORT[id] ?? SPORTS[id].label)}</span>
            {on && (
              <span className="absolute top-1.5 right-1.5 flex size-4 items-center justify-center rounded-full bg-accent text-accent-ink" aria-hidden>
                <Check className="size-3" strokeWidth={3} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
