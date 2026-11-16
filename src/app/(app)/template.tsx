"use client";

import { motion } from "motion/react";

/**
 * Плавное проявление каждой страницы при переходе.
 * template (в отличие от layout) монтируется заново при каждом переходе, нижнее меню остаётся на месте.
 * Анимируем только opacity: transform у обёртки сломал бы position: fixed внутри
 * (поле комментария, панель фильтров, тосты).
 */
export default function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.22, ease: "easeOut" }}>
      {children}
    </motion.div>
  );
}
