"use client";

import { Check } from "lucide-react";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const VISIBLE_MS = 2600;

/** Уведомление сверху: выезжает, исчезает само, можно смахнуть вверх. */
export function TopToast({ message, clearParam }: { message: string; clearParam?: string }) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setTarget(document.body);
    setOpen(true);
    // После обновления страницы уведомление не показывается снова
    if (clearParam) {
      const url = new URL(window.location.href);
      url.searchParams.delete(clearParam);
      window.history.replaceState(window.history.state, "", url);
    }
    const timer = setTimeout(() => setOpen(false), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [clearParam]);

  if (!target) return null;

  return createPortal(
    <MotionConfig reducedMotion="user">
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[90] flex justify-center px-4 pt-[calc(0.5rem+env(safe-area-inset-top))]">
        <AnimatePresence>
          {open && (
            <motion.div
              role="status"
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0.7, bottom: 0.08 }}
              onDragEnd={(_, info) => {
                if (info.offset.y < -16) setOpen(false);
              }}
              initial={{ y: -90, opacity: 0, scale: 0.94 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -90, opacity: 0, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className="liquid-glass pointer-events-auto flex h-12 touch-none items-center gap-2.5 rounded-full pr-5 pl-2 text-[15px] font-semibold"
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-accent text-accent-ink">
                <Check className="size-[18px]" strokeWidth={2.6} aria-hidden />
              </span>
              {message}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>,
    target,
  );
}
