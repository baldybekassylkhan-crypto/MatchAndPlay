"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { loadFeed } from "@/app/actions/posts";
import { PostCard } from "@/components/posts/PostCard";
import type { FeedCursor } from "@/lib/posts";
import type { PostWithMeta } from "@/lib/types";

const PULL_THRESHOLD = 70;

export function Feed({
  initialPosts,
  initialCursor,
  initialDone,
  end,
}: {
  initialPosts: PostWithMeta[];
  initialCursor: FeedCursor;
  initialDone: boolean;
  /** Что показать, когда посты закончились */
  end: React.ReactNode;
}) {
  const router = useRouter();
  const [posts, setPosts] = useState(initialPosts);
  const [cursor, setCursor] = useState(initialCursor);
  const [done, setDone] = useState(initialDone);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pull, setPull] = useState(0);
  const sentinel = useRef<HTMLDivElement>(null);
  const touchStart = useRef<number | null>(null);
  const loadingRef = useRef(false);

  // Свежие данные с сервера (после публикации или pull-to-refresh)
  useEffect(() => {
    setPosts(initialPosts);
    setCursor(initialCursor);
    setDone(initialDone);
  }, [initialPosts, initialCursor, initialDone]);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || done) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const page = await loadFeed(cursor);
      setPosts((prev) => {
        const ids = new Set(prev.map((p) => p.id));
        return [...prev, ...page.posts.filter((p) => !ids.has(p.id))];
      });
      setCursor(page.cursor);
      setDone(page.done || page.posts.length === 0);
    } catch {
      setDone(true);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [cursor, done]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || done) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && loadMore(), { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore, done]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 800);
  }, [router]);

  // Pull-to-refresh: потянуть вниз в самом верху страницы
  const onTouchStart = (e: React.TouchEvent) => {
    touchStart.current = window.scrollY <= 0 ? e.touches[0].clientY : null;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (touchStart.current === null) return;
    const d = e.touches[0].clientY - touchStart.current;
    setPull(d > 0 ? Math.min(d * 0.5, 100) : 0);
  };
  const onTouchEnd = () => {
    if (pull >= PULL_THRESHOLD) refresh();
    setPull(0);
    touchStart.current = null;
  };

  return (
    <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <div
        className="flex items-center justify-center overflow-hidden text-muted transition-[height]"
        style={{ height: refreshing ? 48 : pull }}
        aria-hidden={!refreshing}
      >
        <RefreshCw
          className={`size-5 ${refreshing ? "animate-spin" : ""}`}
          style={{ transform: refreshing ? undefined : `rotate(${pull * 3}deg)` }}
        />
      </div>

      {posts.map((p) => (
        <PostCard key={p.id} post={p} />
      ))}

      {done ? (
        end
      ) : (
        <div ref={sentinel} className="flex min-h-20 justify-center py-8 text-sm text-muted">
          {loading && <Loader2 className="size-5 animate-spin" />}
        </div>
      )}
    </div>
  );
}
