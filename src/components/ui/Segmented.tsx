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
        "relative grid rounded-[10px] bg-surface-2 p-0.5",
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
              "relative flex items-center justify-center gap-1.5 rounded-[8px] text-[13px] transition-colors duration-200",
              size === "md" ? "h-8" : "h-8 px-3",
              active ? "font-semibold text-ink" : "font-medium text-ink",
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={SWITCH_SPRING}
                className="absolute inset-0 rounded-[8px] bg-white shadow-[0_2px_6px_rgb(0_0_0/0.12),0_0_0_0.5px_rgb(0_0_0/0.04)] dark:bg-[#636366]"
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
              variant === "pill" ? "rounded-full px-3.5 py-1.5" : "h-11 flex-1",
              variant === "pill" && !on && "bg-surface-2 text-ink",
              on ? (variant === "pill" ? "text-accent-ink" : "text-ink") : "text-muted",
            )}
          >
            {on &&
              (variant === "pill" ? (
                <motion.span layoutId={layoutId} transition={SWITCH_SPRING} className="absolute inset-0 rounded-full bg-accent" />
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
