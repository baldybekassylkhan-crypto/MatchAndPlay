import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Comment, Post, PostWithMeta } from "@/lib/types";

export const POST_SELECT =
  "*, author:profiles!posts_author_id_fkey(id, username, full_name, avatar_url), lobby:lobbies(id, sport, start_time)";

/** То же, но с inner join на автора — чтобы фильтровать по его городу. */
const POST_SELECT_BY_CITY =
  "*, author:profiles!posts_author_id_fkey!inner(id, username, full_name, avatar_url, city_id), lobby:lobbies(id, sport, start_time)";

export const FEED_PAGE = 10;

/**
 * Курсор ленты. Три потока по очереди:
 *  a — подписки и мои посты, b — рекомендации из моего города, c — остальные рекомендации.
 * Значение — created_at последнего показанного поста, "done" — поток закончился.
 */
export interface FeedCursor {
  a: string | null;
  b: string | null;
  c: string | null;
}

export const FEED_START: FeedCursor = { a: null, b: null, c: null };

const inList = (ids: string[]) => `(${ids.join(",")})`;

/** На кого подписан пользователь (+ он сам). Один запрос на рендер — общий для ленты и кружков хайлайтов. */
export const getFollowingIds = cache(async (userId: string): Promise<string[]> => {
  const supabase = await createClient();
  const { data } = await supabase.from("follows").select("following_id").eq("follower_id", userId).limit(2000);
  return [userId, ...(data ?? []).map((r) => r.following_id as string)];
});

/** Лайк текущего пользователя приходит вместе с постом — без отдельного запроса. */
const LIKED_BY_ME = ", my_like:likes(user_id)";
type RawPost = Omit<PostWithMeta, "liked"> & { my_like?: { user_id: string }[] };
const toPost = (p: RawPost, recommended?: boolean): PostWithMeta => {
  const { my_like, ...rest } = p;
  return { ...rest, liked: (my_like?.length ?? 0) > 0, ...(recommended !== undefined ? { recommended } : {}) };
};

export async function getFeedPage(
  userId: string,
  cityId: number,
  cursor: FeedCursor,
): Promise<{ posts: PostWithMeta[]; cursor: FeedCursor; done: boolean }> {
  const [supabase, mine] = await Promise.all([createClient(), getFollowingIds(userId)]);

  const streams = [
    {
      key: "a" as const,
      recommended: false,
      build: () => supabase.from("posts").select(POST_SELECT + LIKED_BY_ME).in("author_id", mine),
    },
    {
      key: "b" as const,
      recommended: true,
      build: () =>
        supabase
          .from("posts")
          .select(POST_SELECT_BY_CITY + LIKED_BY_ME)
          .eq("author.city_id", cityId)
          .not("author_id", "in", inList(mine)),
    },
    {
      key: "c" as const,
      recommended: true,
      build: () =>
        supabase
          .from("posts")
          .select(POST_SELECT_BY_CITY + LIKED_BY_ME)
          .neq("author.city_id", cityId)
          .not("author_id", "in", inList(mine)),
    },
  ];

  // Все три потока одновременно (раньше — по очереди), затем заполняем страницу по приоритету.
  const fetched = await Promise.all(
    streams.map(async (s) => {
      if (cursor[s.key] === "done") return [] as RawPost[];
      let q = s
        .build()
        .eq("my_like.user_id", userId)
        .order("created_at", { ascending: false })
        .limit(FEED_PAGE);
      if (cursor[s.key]) q = q.lt("created_at", cursor[s.key]!);
      const { data } = await q;
      return (data as unknown as RawPost[] | null) ?? [];
    }),
  );

  const next: FeedCursor = { ...cursor };
  const posts: PostWithMeta[] = [];
  streams.forEach((s, i) => {
    if (cursor[s.key] === "done") return;
    const rows = fetched[i];
    const taken = rows.slice(0, Math.max(0, FEED_PAGE - posts.length));
    posts.push(...taken.map((p) => toPost(p, s.recommended)));
    if (taken.length === rows.length && rows.length < FEED_PAGE) next[s.key] = "done";
    else if (taken.length > 0) next[s.key] = taken[taken.length - 1].created_at;
    // taken.length === 0 и поток не пуст — оставляем курсор как был, дойдём до него на следующей странице
  });

  const done = next.a === "done" && next.b === "done" && next.c === "done";
  return { posts, cursor: next, done };
}

export const getPost = cache(async (id: string, userId: string): Promise<PostWithMeta | null> => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("posts")
    .select(POST_SELECT + LIKED_BY_ME)
    .eq("id", id)
    .eq("my_like.user_id", userId)
    .maybeSingle();
  return data ? toPost(data as unknown as RawPost) : null;
});

export async function getComments(postId: string): Promise<Comment[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("comments")
    .select("*, user:profiles!comments_user_id_fkey(id, username, full_name, avatar_url)")
    .eq("post_id", postId)
    .order("created_at")
    .limit(300);
  return (data as Comment[] | null) ?? [];
}

/** Посты для сетки профиля (highlights = только привязанные к играм). */
export async function getProfilePosts(authorId: string, highlights = false): Promise<Post[]> {
  const supabase = await createClient();
  let q = supabase.from("posts").select("*").eq("author_id", authorId).order("created_at", { ascending: false }).limit(90);
  if (highlights) q = q.not("lobby_id", "is", null);
  const { data } = await q;
  return (data as Post[] | null) ?? [];
}

export async function countPosts(authorId: string) {
  const supabase = await createClient();
  const { count } = await supabase.from("posts").select("*", { count: "exact", head: true }).eq("author_id", authorId);
  return count ?? 0;
}

/** Кружки хайлайтов сверху ленты: кто из подписок недавно выложил моменты с игр. */
export async function getHighlightAuthors(userId: string) {
  // Тот же список подписок, что и у ленты — без повторного запроса
  const [supabase, ids] = await Promise.all([createClient(), getFollowingIds(userId)]);
  const { data } = await supabase
    .from("posts")
    .select("author_id, created_at, author:profiles!posts_author_id_fkey(id, username, avatar_url)")
    .in("author_id", ids)
    .not("lobby_id", "is", null)
    .gt("created_at", new Date(Date.now() - 7 * 86_400_000).toISOString())
    .order("created_at", { ascending: false })
    .limit(100);
  const seen = new Map<string, { id: string; username: string; avatar_url: string | null }>();
  for (const row of (data as unknown as { author: { id: string; username: string; avatar_url: string | null } | null }[]) ?? []) {
    if (row.author && !seen.has(row.author.id)) seen.set(row.author.id, row.author);
  }
  return [...seen.values()].slice(0, 20);
}
