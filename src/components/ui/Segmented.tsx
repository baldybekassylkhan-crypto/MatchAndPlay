"use client";

import clsx from "clsx";
import { motion } from "motion/react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

/** Пружина для всех переключателей — быстрая, без «резинки». */
export const SWITCH_SPRING = { type: "spring", stiffness: 500, damping: 38, mass: 0.8 } as const;

interface Option<T extends string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
}

/**
 * Переключатель-«таблетка» (Вход / Регистрация, Список / Свайпы):
 * подложка плавно переезжает к выбранному пункту.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  layoutId,
  size = "md",
  className,
  ariaLabel,
}: {
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
  /** Уникальный id на странице — по нему motion анимирует перемещение подложки */
  layoutId: string;
  size?: "sm" | "md";
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={clsx(
        "glass relative grid rounded-2xl p-1",
        size === "sm" && "rounded-full",
        className,
      )}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={clsx(
              "relative flex items-center justify-center gap-1.5 font-semibold transition-colors duration-200",
              size === "md" ? "h-10 rounded-xl text-sm" : "h-8 rounded-full px-3 text-sm",
              active ? "text-ink" : "text-muted hover:text-ink",
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={SWITCH_SPRING}
                className={clsx("absolute inset-0 bg-surface shadow-sm ring-1 ring-black/5", size === "md" ? "rounded-xl" : "rounded-full")}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              {o.icon}
              {o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Вкладки-ссылки («Мои игры»): выбранная вкладка подсвечивается сразу по нажатию,
 * не дожидаясь ответа сервера, и подложка плавно переезжает.
 */
export function TabLinks({
  items,
  layoutId,
  variant = "pill",
  className,
}: {
  items: { href: string; label: ReactNode; active: boolean; icon?: ReactNode }[];
  layoutId: string;
  variant?: "pill" | "underline";
  className?: string;
}) {
  const serverActive = items.findIndex((i) => i.active);
  const [active, setActive] = useState(serverActive);
  useEffect(() => setActive(serverActive), [serverActive]);

  return (
    <nav className={clsx("flex", variant === "pill" ? "gap-2" : "", className)}>
      {items.map((item, idx) => {
        const on = idx === active;
        return (
          <Link
            key={item.href}
            href={item.href}
            scroll={false}
            onClick={() => setActive(idx)}
            aria-current={on ? "page" : undefined}
            className={clsx(
              "relative flex shrink-0 items-center justify-center gap-1.5 text-sm font-semibold transition-colors duration-200",
              variant === "pill" ? "rounded-full px-3.5 py-2" : "h-11 flex-1",
              variant === "pill" && !on && "glass",
              on ? (variant === "pill" ? "text-bg" : "text-ink") : "text-muted hover:text-ink",
            )}
          >
            {on &&
              (variant === "pill" ? (
                <motion.span layoutId={layoutId} transition={SWITCH_SPRING} className="absolute inset-0 rounded-full bg-ink" />
              ) : (
                <motion.span
                  layoutId={layoutId}
                  transition={SWITCH_SPRING}
                  className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-ink"
                />
              ))}
            <span className="relative z-10 flex items-center gap-1.5">
              {item.icon}
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
