"use client";

import clsx from "clsx";
import { Heart, MessageCircle, Send, Trophy } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toggleLike } from "@/app/actions/posts";
import { Avatar } from "@/components/Avatar";
import { MediaCarousel } from "@/components/posts/MediaCarousel";
import { SPORTS } from "@/lib/sports";
import { formatLongDate, plural, timeAgo } from "@/lib/time";
import type { PostWithMeta } from "@/lib/types";

export function PostCard({ post, full = false }: { post: PostWithMeta; full?: boolean }) {
  const [liked, setLiked] = useState(post.liked);
  const [likes, setLikes] = useState(post.like_count);
  const [burst, setBurst] = useState(false);
  const [expanded, setExpanded] = useState(full);
  const [shared, setShared] = useState(false);
  const [, startTransition] = useTransition();

  const like = (value: boolean) => {
    if (value === liked) return;
    setLiked(value);
    setLikes((n) => n + (value ? 1 : -1));
    startTransition(async () => {
      const res = await toggleLike(post.id, value);
      if (!res.ok) {
        setLiked(!value);
        setLikes((n) => n + (value ? -1 : 1));
      }
    });
  };

  const onDoubleTap = () => {
    like(true);
    setBurst(true);
    setTimeout(() => setBurst(false), 700);
  };

  const share = async () => {
    const url = `${window.location.origin}/p/${post.id}`;
    try {
      if (navigator.share) await navigator.share({ title: "Match&Play", url });
      else {
        await navigator.clipboard.writeText(url);
        setShared(true);
        setTimeout(() => setShared(false), 1500);
      }
    } catch {
      // пользователь закрыл окно «Поделиться»
    }
  };

  const sport = post.sport ? SPORTS[post.sport] : null;
  const caption = post.caption ?? "";
  const long = caption.length > 120;

  return (
    <article className="border-b border-line pb-3">
      <div className="relative">
        <MediaCarousel media={post.media} onDoubleTap={onDoubleTap} />
        {post.author && (
          // Слой пропускает свайпы и двойное нажатие к фото, кликабелен только автор
          <header className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/50 to-transparent pt-3 pr-16 pb-8 pl-3">
            <Link
              href={`/u/${post.author.username}`}
              className="pointer-events-auto inline-flex max-w-full items-center gap-2.5 text-white active:opacity-70"
            >
              <Avatar src={post.author.avatar_url} name={post.author.username} size={38} className="ring-2 ring-white/90" />
              <span className="min-w-0 [text-shadow:0_1px_3px_rgb(0_0_0/0.55)]">
                <span className="block truncate text-sm font-semibold">{post.author.username}</span>
                <span className="block truncate text-xs text-white/85">
                  {post.recommended ? "Рекомендация" : timeAgo(post.created_at)}
                  {sport && ` · ${sport.label}`}
                </span>
              </span>
            </Link>
          </header>
        )}
        <AnimatePresence>
          {burst && (
            <motion.span
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.4 }}
              transition={{ type: "spring", stiffness: 500, damping: 22 }}
            >
              <Heart className="size-24 fill-white text-white drop-shadow-lg" />
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {post.lobby && (
        <Link
          href={`/lobby/${post.lobby.id}`}
          className="mx-4 mt-2.5 flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-1.5 text-sm font-semibold"
        >
          <Trophy className="size-4 shrink-0" />
          <span className="truncate">
            Хайлайт с игры: {SPORTS[post.lobby.sport]?.label.toLowerCase()}, {formatLongDate(post.lobby.start_time)}
          </span>
        </Link>
      )}

      <div className="flex items-center gap-1 px-2 pt-2">
        <button
          type="button"
          onClick={() => like(!liked)}
          className="flex size-10 items-center justify-center"
          aria-pressed={liked}
          aria-label={liked ? "Убрать лайк" : "Нравится"}
        >
          {/* key перезапускает анимацию «пульса» при каждом лайке */}
          <Heart key={String(liked)} className={clsx("size-6", liked && "animate-pop fill-danger text-danger")} />
        </button>
        <Link href={`/p/${post.id}#comments`} className="flex size-10 items-center justify-center" aria-label="Комментарии">
          <MessageCircle className="size-6" />
        </Link>
        <button type="button" onClick={share} className="flex size-10 items-center justify-center" aria-label="Поделиться">
          <Send className="size-6" />
        </button>
        {shared && <span className="text-sm text-muted">Ссылка скопирована</span>}
      </div>

      <div className="space-y-1 px-4">
        {likes > 0 && (
          <p className="text-sm font-semibold">
            {likes} {plural(likes, ["отметка «нравится»", "отметки «нравится»", "отметок «нравится»"])}
          </p>
        )}
        {caption && (
          <p className="text-[15px] whitespace-pre-line">
            {post.author && <span className="mr-1.5 font-semibold">@{post.author.username}</span>}
            {long && !expanded ? `${caption.slice(0, 120)}…` : caption}
            {long && !expanded && (
              <button type="button" onClick={() => setExpanded(true)} className="ml-1 text-muted">
                ещё
              </button>
            )}
          </p>
        )}
        {!full && post.comment_count > 0 && (
          <Link href={`/p/${post.id}#comments`} className="block text-sm text-muted">
            Смотреть все комментарии ({post.comment_count})
          </Link>
        )}
        {post.recommended && <p className="text-xs text-muted">{timeAgo(post.created_at)}</p>}
      </div>
    </article>
  );
}
