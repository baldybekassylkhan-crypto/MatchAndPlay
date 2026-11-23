"use client";

import { X } from "lucide-react";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { FollowButton } from "@/components/FollowButton";
import type { SuggestedPerson } from "@/lib/suggestions";

const STORAGE_KEY = "hidden-suggestions";

function readHidden(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

/** Горизонтальный блок «Возможно, знакомы» внутри ленты. */
export function PeopleCarousel({ people }: { people: SuggestedPerson[] }) {
  const [hidden, setHidden] = useState<string[]>([]);
  useEffect(() => setHidden(readHidden()), []);

  const hide = (id: string) => {
    const next = [...new Set([...readHidden(), id])].slice(-200);
    setHidden(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Без хранилища карточка скрыта до перезагрузки
    }
  };

  const visible = people.filter((p) => !hidden.includes(p.id));
  if (visible.length === 0) return null;

  return (
    <MotionConfig reducedMotion="user">
      <section aria-label="Возможно, знакомы" className="border-b border-line py-4">
        <h2 className="mb-3 px-4 text-[17px] font-semibold">Возможно, знакомы</h2>
        <ul className="no-scrollbar flex snap-x snap-mandatory scroll-px-4 gap-2.5 overflow-x-auto overscroll-x-contain px-4">
          <AnimatePresence initial={false}>
            {visible.map((p, i) => (
              <motion.li
                key={p.id}
                layout
                initial={{ opacity: 0, x: 18 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                exit={{ opacity: 0, scale: 0.86 }}
                transition={{ duration: 0.3, delay: Math.min(i, 3) * 0.05, ease: [0.32, 0.72, 0, 1] }}
                className="card relative flex w-[152px] shrink-0 snap-start flex-col items-center p-3 text-center"
              >
                <button
                  type="button"
                  onClick={() => hide(p.id)}
                  aria-label={`Скрыть @${p.username}`}
                  className="absolute top-0.5 right-0.5 flex size-9 items-center justify-center text-muted active:opacity-60"
                >
                  <X className="size-4" />
                </button>
                <Link href={`/u/${p.username}`} className="flex w-full min-w-0 flex-col items-center active:opacity-60">
                  <Avatar src={p.avatar_url} name={p.username} size={72} className="mt-1" />
                  <span className="mt-2 w-full truncate text-[15px] font-semibold">{p.username}</span>
                  <span className="mt-0.5 h-4 w-full truncate text-[12px] leading-4 text-muted">{p.reason}</span>
                </Link>
                <div className="mt-3 flex w-full">
                  <FollowButton targetId={p.id} initialFollowing={false} compact />
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </section>
    </MotionConfig>
  );
}
