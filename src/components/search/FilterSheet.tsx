"use client";

import { useT } from "@/components/I18nProvider";
import clsx from "clsx";
import { X } from "lucide-react";
import { AnimatePresence, motion, useDragControls } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { SheetSelect } from "@/components/ui/SheetSelect";
import { cityOptions } from "@/lib/city-options";
import {
  DAY_PRESETS,
  EMPTY_FILTERS,
  TIMES_OF_DAY,
  type LobbyFilters,
  type TimeOfDay,
} from "@/lib/filters";
import { SportGrid } from "@/components/ui/SportGrid";
import type { SportId } from "@/lib/sports";
import { toKzInputs } from "@/lib/time";
import { LEVELS, type City, type SkillLevel } from "@/lib/types";

function toggle<T>(list: T[], item: T) {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold text-muted">{title}</h3>
      <div className="flex flex-wrap gap-2">{children}</div>
    </section>
  );
}

export function FilterSheet({
  open,
  onClose,
  initial,
  cities,
  defaultCityId,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  initial: LobbyFilters;
  cities: City[];
  defaultCityId: number;
  onApply: (f: LobbyFilters) => void;
}) {
  const [f, setF] = useState(initial);
  const t = useT();
  const dragControls = useDragControls();
  const cityOpts = useMemo(() => cityOptions(cities), [cities]);

  useEffect(() => {
    if (open) setF(initial);
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  const isPreset = DAY_PRESETS.some((d) => d.id === f.day);
  const today = toKzInputs(new Date()).date;

  return (
    <AnimatePresence>
      {open && (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={t("Фильтры")}>
      <motion.button
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-label={t("Закрыть")}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      />
      <motion.div
        className="relative flex max-h-[90dvh] w-full max-w-lg flex-col rounded-t-3xl bg-bg"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 420, damping: 40 }}
        drag="y"
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.6 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 120 || info.velocity.y > 600) onClose();
        }}
      >
        {/* Ручка: потянуть вниз, чтобы закрыть */}
        <div
          className="flex cursor-grab touch-none justify-center pt-2.5 pb-1 active:cursor-grabbing"
          onPointerDown={(e) => dragControls.start(e)}
        >
          <span className="h-1.5 w-10 rounded-full bg-line" />
        </div>
        <header
          className="flex touch-none items-center justify-between border-b border-line px-5 pt-1 pb-4"
          onPointerDown={(e) => dragControls.start(e)}
        >
          <h2 className="text-lg font-bold">{t("Фильтры")}</h2>
          <button
            onClick={onClose}
            onPointerDown={(e) => e.stopPropagation()}
            className="flex size-11 items-center justify-center rounded-full bg-surface-2"
            aria-label={t("Закрыть")}
          >
            <X className="size-5" />
          </button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <section>
            <h3 className="mb-2 text-sm font-semibold text-muted">{t("Город")}</h3>
            <SheetSelect
              title={t("Город")}
              searchPlaceholder={t("Найти город")}
              value={f.city ?? defaultCityId}
              options={cityOpts}
              onChange={(city) => setF({ ...f, city })}
            />
          </section>

          <Section title={t("День")}>
            {/* Только «Сегодня» и «Завтра»; повторное нажатие снимает выбор (= любой день) */}
            {DAY_PRESETS.filter((d) => d.id === "today" || d.id === "tomorrow").map((d) => (
              <button
                key={d.id}
                type="button"
                aria-pressed={f.day === d.id}
                className={clsx("chip", f.day === d.id && "chip-active")}
                onClick={() => setF({ ...f, day: f.day === d.id ? "any" : d.id })}
              >
                {t(d.label)}
              </button>
            ))}
            <input
              type="date"
              min={today}
              aria-label={t("Конкретная дата")}
              className={clsx("chip h-[38px] text-[16px]!", !isPreset && "chip-active")}
              value={isPreset ? "" : f.day}
              onChange={(e) => setF({ ...f, day: e.target.value || "any" })}
            />
          </Section>

          <Section title={t("Вид спорта")}>
            <SportGrid selected={f.sports} onToggle={(id) => setF({ ...f, sports: toggle<SportId>(f.sports, id) })} />
          </Section>

          <Section title={t("Время")}>
            {TIMES_OF_DAY.map((tm) => (
              <button
                key={tm.id}
                type="button"
                className={clsx("chip", f.times.includes(tm.id) && "chip-active")}
                onClick={() => setF({ ...f, times: toggle<TimeOfDay>(f.times, tm.id) })}
              >
                {t(tm.label)} <span className="opacity-60">{tm.hint}</span>
              </button>
            ))}
          </Section>

          <Section title={t("Для кого")}>
            <button type="button" className={clsx("chip", !f.women && "chip-active")} onClick={() => setF({ ...f, women: false })}>
              {t("Все игры")}
            </button>
            <button type="button" className={clsx("chip", f.women && "chip-active")} onClick={() => setF({ ...f, women: true })}>
              {t("Только для девушек")}
            </button>
          </Section>

          <Section title={t("Уровень")}>
            <button type="button" className={clsx("chip", !f.level && "chip-active")} onClick={() => setF({ ...f, level: null })}>
              {t("Любой")}
            </button>
            {LEVELS.map((l) => (
              <button
                key={l.id}
                type="button"
                className={clsx("chip", f.level === l.id && "chip-active")}
                onClick={() => setF({ ...f, level: l.id as SkillLevel })}
              >
                {t(l.label)}
              </button>
            ))}
          </Section>
        </div>

        <footer className="flex gap-2 border-t border-line px-5 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setF({ ...EMPTY_FILTERS, city: f.city, q: f.q })}
          >
            {t("Сбросить")}
          </button>
          <button type="button" className="btn-primary flex-1" onClick={() => onApply(f)}>
            {t("Показать игры")}
          </button>
        </footer>
      </motion.div>
    </div>
      )}
    </AnimatePresence>
  );
}
