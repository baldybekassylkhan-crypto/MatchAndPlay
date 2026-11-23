"use client";

import { motion, MotionConfig } from "motion/react";
import Link from "next/link";

const EASE = [0.32, 0.72, 0, 1] as const;

const rise = (delay: number) => ({
  initial: { opacity: 0, y: 14 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.4 },
  transition: { duration: 0.45, delay, ease: EASE },
});

/** Финал ленты: галочка рисуется, текст мягко поднимается. */
export function FeedEndMessage({ hasPosts }: { hasPosts: boolean }) {
  return (
    <MotionConfig reducedMotion="user">
      <section className="flex flex-col items-center px-6 py-4 text-center">
        <motion.span
          className="flex size-11 items-center justify-center rounded-full bg-surface-2 text-muted"
          initial={{ opacity: 0, scale: 0.5 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ type: "spring", stiffness: 380, damping: 20 }}
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <motion.path
              d="M20 6 9 17l-5-5"
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.16, ease: "easeOut" }}
            />
          </svg>
        </motion.span>
        <motion.h2 {...rise(0.22)} className="mt-3 text-[20px] font-semibold">
          {hasPosts ? "Вы всё посмотрели" : "Пока здесь тихо"}
        </motion.h2>
        <motion.p {...rise(0.3)} className="mt-1 text-[15px] text-muted">
          {hasPosts ? "Кто играет сегодня вечером?" : "Сыграйте и станьте первым, кто поделится игрой."}
        </motion.p>
        <motion.div {...rise(0.38)}>
          <Link href="/search?day=today&times=evening" className="mt-2 inline-flex h-11 items-center px-3 text-[17px] text-accent active:opacity-60">
            Найти игру
          </Link>
        </motion.div>
      </section>
    </MotionConfig>
  );
}
