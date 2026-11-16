"use client";

import clsx from "clsx";
import { Check } from "lucide-react";
import { motion } from "motion/react";
import { SPORT_IDS, SPORTS, type SportId } from "@/lib/sports";

/** Короткие подписи, чтобы плитки были одинаковыми */
const SHORT: Partial<Record<SportId, string>> = { table_tennis: "Наст. теннис" };

/**
 * Виды спорта аккуратной сеткой одинаковых плиток: эмодзи сверху, подпись снизу,
 * галочка в углу у выбранных.
 */
export function SportGrid({
  selected,
  onToggle,
  animateIn = false,
  ariaLabel = "Виды спорта",
}: {
  selected: SportId[];
  onToggle: (id: SportId) => void;
  /** Плитки появляются по очереди (для анкеты) */
  animateIn?: boolean;
  ariaLabel?: string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="grid w-full grid-cols-3 gap-2 sm:grid-cols-4">
      {SPORT_IDS.map((id, i) => {
        const on = selected.includes(id);
        return (
          <motion.button
            key={id}
            type="button"
            aria-pressed={on}
            title={SPORTS[id].label}
            onClick={() => onToggle(id)}
            whileTap={{ scale: 0.94 }}
            initial={animateIn ? { opacity: 0, y: 10 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={animateIn ? { delay: 0.04 + i * 0.03 } : { duration: 0.15 }}
            className={clsx(
              "relative flex h-[76px] flex-col items-center justify-center gap-1 rounded-2xl px-1 text-center transition-colors duration-200",
              on ? "bg-ink text-bg" : "glass text-ink",
            )}
          >
            <span className="text-2xl leading-none" aria-hidden>
              {SPORTS[id].emoji}
            </span>
            <span className="w-full truncate text-xs font-semibold">{SHORT[id] ?? SPORTS[id].label}</span>
            <span
              className={clsx(
                "absolute top-1.5 right-1.5 flex size-4 items-center justify-center rounded-full bg-accent text-accent-ink transition duration-200",
                on ? "scale-100 opacity-100" : "scale-50 opacity-0",
              )}
              aria-hidden
            >
              <Check className="size-3" strokeWidth={3.5} />
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
