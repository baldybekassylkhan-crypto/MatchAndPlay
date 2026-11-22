"use client";

import clsx from "clsx";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { AnimatePresence, motion, useDragControls } from "motion/react";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export interface SelectOption<T extends string | number> {
  value: T;
  label: string;
  /** Подпись справа серым (например, казахское название) */
  hint?: string;
  /** Доп. слова для поиска (старые названия городов и т. п.) */
  keywords?: string[];
}

const norm = (s: string) => s.toLowerCase().replace(/ё/g, "е").trim();

/**
 * Красивая замена <select>: кнопка-поле, по нажатию — выезжающая снизу панель
 * (на широком экране — окно по центру) с поиском, галочкой и плавной анимацией.
 * Рендерится в портал, поэтому работает и внутри других панелей.
 */
export function SheetSelect<T extends string | number>({
  value,
  options,
  onChange,
  placeholder = "Выберите",
  title,
  name,
  searchable = options.length > 8,
  searchPlaceholder = "Поиск",
  trigger,
  className,
  required,
}: {
  value: T | null;
  options: SelectOption<T>[];
  onChange: (v: T) => void;
  placeholder?: string;
  title: string;
  /** Имя скрытого поля для обычных форм */
  name?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Своя кнопка вместо поля (например, чип в шапке) */
  trigger?: (props: { open: () => void; label: string | null }) => ReactNode;
  className?: string;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [mounted, setMounted] = useState(false);
  const dragControls = useDragControls();
  const listRef = useRef<HTMLUListElement>(null);
  const titleId = useId();

  useEffect(() => setMounted(true), []);

  const selected = options.find((o) => o.value === value) ?? null;

  const filtered = useMemo(() => {
    const q = norm(query);
    if (!q) return options;
    return options.filter((o) => [o.label, o.hint ?? "", ...(o.keywords ?? [])].some((s) => norm(s).includes(q)));
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Прокручиваем к выбранному пункту
    requestAnimationFrame(() => listRef.current?.querySelector("[aria-selected=true]")?.scrollIntoView({ block: "center" }));
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const pick = (v: T) => {
    onChange(v);
    setOpen(false);
  };

  return (
    <>
      {name && <input type="hidden" name={name} value={value ?? ""} required={required} />}

      {trigger ? (
        trigger({ open: () => setOpen(true), label: selected?.label ?? null })
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          className={clsx("input flex items-center justify-between gap-2 text-left", className)}
        >
          <span className={clsx("truncate", !selected && "text-muted")}>{selected?.label ?? placeholder}</span>
          <ChevronDown className={clsx("size-5 shrink-0 text-muted transition-transform duration-200", open && "rotate-180")} />
        </button>
      )}

      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && (
              <div
                className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
              >
                <motion.button
                  type="button"
                  aria-label="Закрыть"
                  className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
                  onClick={() => setOpen(false)}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                />
                <motion.div
                  className="relative flex max-h-[80dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-line bg-bg shadow-2xl sm:rounded-3xl"
                  initial={{ y: "100%", opacity: 0.6 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: "100%", opacity: 0.6 }}
                  transition={{ type: "spring", stiffness: 420, damping: 40 }}
                  drag="y"
                  dragControls={dragControls}
                  dragListener={false}
                  dragConstraints={{ top: 0, bottom: 0 }}
                  dragElastic={{ top: 0, bottom: 0.6 }}
                  onDragEnd={(_, info) => {
                    if (info.offset.y > 100 || info.velocity.y > 600) setOpen(false);
                  }}
                >
                  <div
                    className="flex cursor-grab touch-none justify-center pt-2.5 pb-1 active:cursor-grabbing sm:hidden"
                    onPointerDown={(e) => dragControls.start(e)}
                  >
                    <span className="h-1.5 w-10 rounded-full bg-line" />
                  </div>
                  <header className="flex items-center justify-between px-5 pt-1 pb-3 sm:pt-4">
                    <h2 id={titleId} className="text-lg font-bold">
                      {title}
                    </h2>
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="glass flex size-9 items-center justify-center rounded-full"
                      aria-label="Закрыть"
                    >
                      <X className="size-5" />
                    </button>
                  </header>

                  {searchable && (
                    <div className="px-4 pb-3">
                      <div className="relative">
                        <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted" />
                        <input
                          className="input h-11 pl-10"
                          placeholder={searchPlaceholder}
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          aria-label={searchPlaceholder}
                        />
                      </div>
                    </div>
                  )}

                  <ul
                    ref={listRef}
                    role="listbox"
                    aria-label={title}
                    className="flex-1 overflow-y-auto overscroll-contain px-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
                  >
                    {filtered.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted">Ничего не нашлось</li>}
                    {filtered.map((o, i) => {
                      const isSelected = o.value === value;
                      return (
                        <motion.li
                          key={String(o.value)}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: Math.min(i, 12) * 0.015, duration: 0.18 }}
                        >
                          <button
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            onClick={() => pick(o.value)}
                            className={clsx(
                              "flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left",
                              isSelected ? "bg-surface-2 font-semibold" : "hover:bg-surface-2 active:bg-surface-2",
                            )}
                          >
                            <span className="flex-1 truncate">{o.label}</span>
                            {o.hint && o.hint !== o.label && <span className="truncate text-sm text-muted">{o.hint}</span>}
                            <span
                              className={clsx(
                                "flex size-6 shrink-0 items-center justify-center rounded-full transition",
                                isSelected ? "scale-100 bg-accent text-accent-ink" : "scale-75 opacity-0",
                              )}
                            >
                              <Check className="size-4" strokeWidth={3} />
                            </span>
                          </button>
                        </motion.li>
                      );
                    })}
                  </ul>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
