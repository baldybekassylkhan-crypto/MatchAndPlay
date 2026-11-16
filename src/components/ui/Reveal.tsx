"use client";

import { motion } from "motion/react";

/**
 * Плавно раскрывается по высоте и проявляется (ошибки, подсказки, панели подтверждения).
 * Использовать внутри <AnimatePresence>, чтобы было и плавное закрытие.
 */
export function Reveal({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      style={{ overflow: "hidden" }}
    >
      <div className={className}>{children}</div>
    </motion.div>
  );
}
