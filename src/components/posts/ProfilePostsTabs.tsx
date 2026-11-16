"use client";

import clsx from "clsx";
import { Grid3x3, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { PostGrid } from "@/components/posts/PostGrid";
import { SWITCH_SPRING } from "@/components/ui/Segmented";
import type { Post } from "@/lib/types";

type Tab = "posts" | "highlights";

/** Вкладки профиля без перезагрузки: хайлайты — это посты, привязанные к игре. */
export function ProfilePostsTabs({ posts, isMe, initialTab }: { posts: Post[]; isMe: boolean; initialTab: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const shown = tab === "highlights" ? posts.filter((p) => p.lobby_id) : posts;

  const select = (t: Tab) => {
    setTab(t);
    // Ссылка остаётся «правильной», но без запроса к серверу
    const url = new URL(window.location.href);
    if (t === "highlights") url.searchParams.set("tab", "highlights");
    else url.searchParams.delete("tab");
    window.history.replaceState(null, "", url);
  };

  return (
    <>
      <div role="tablist" className="mt-5 grid grid-cols-2 border-b border-line">
        {(
          [
            { id: "posts", label: "Посты", icon: Grid3x3 },
            { id: "highlights", label: "Хайлайты", icon: Sparkles },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => select(id)}
            className={clsx(
              "relative flex h-11 items-center justify-center gap-1.5 text-sm font-semibold transition-colors duration-200",
              tab === id ? "text-ink" : "text-muted hover:text-ink",
            )}
          >
            <Icon className="size-4" />
            {label}
            {tab === id && (
              <motion.span
                layoutId="profile-tab"
                transition={SWITCH_SPRING}
                className="absolute inset-x-6 -bottom-px h-0.5 rounded-full bg-ink"
              />
            )}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          initial={{ opacity: 0, x: tab === "highlights" ? 24 : -24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: tab === "highlights" ? -24 : 24 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
          {shown.length > 0 ? (
            <PostGrid posts={shown} />
          ) : tab === "posts" ? (
            <EmptyState
              icon={Grid3x3}
              title="Постов пока нет"
              text={isMe ? "Поделитесь фото или видео с игры." : "Здесь появятся посты игрока."}
              action={isMe ? { href: "/create/post", label: "Создать пост" } : undefined}
            />
          ) : (
            <EmptyState
              icon={Sparkles}
              title="Хайлайтов пока нет"
              text={
                isMe
                  ? "Выложите пост и привяжите его к сыгранной игре — он появится здесь."
                  : "Лучшие моменты с игр будут собраны здесь."
              }
              action={isMe ? { href: "/create/post", label: "Выложить хайлайт" } : undefined}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </>
  );
}
