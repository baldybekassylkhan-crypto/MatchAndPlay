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

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function withLikes(supabase: Supabase, userId: string, posts: Omit<PostWithMeta, "liked">[]) {
  if (!posts.length) return [] as PostWithMeta[];
  const { data } = await supabase
    .from("likes")
    .select("post_id")
    .eq("user_id", userId)
    .in(
      "post_id",
      posts.map((p) => p.id),
    );
  const liked = new Set((data ?? []).map((r) => r.post_id as string));
  return posts.map((p) => ({ ...p, liked: liked.has(p.id) }));
}

const inList = (ids: string[]) => `(${ids.join(",")})`;

export async function getFeedPage(
  userId: string,
  cityId: number,
  cursor: FeedCursor,
): Promise<{ posts: PostWithMeta[]; cursor: FeedCursor; done: boolean }> {
  const supabase = await createClient();
  const { data: followRows } = await supabase.from("follows").select("following_id").eq("follower_id", userId).limit(2000);
  const mine = [userId, ...(followRows ?? []).map((r) => r.following_id as string)];

  const next: FeedCursor = { ...cursor };
  const out: (Omit<PostWithMeta, "liked">)[] = [];

  const streams = [
    {
      key: "a" as const,
      recommended: false,
      build: () => supabase.from("posts").select(POST_SELECT).in("author_id", mine),
    },
    {
      key: "b" as const,
      recommended: true,
      build: () =>
        supabase.from("posts").select(POST_SELECT_BY_CITY).eq("author.city_id", cityId).not("author_id", "in", inList(mine)),
    },
    {
      key: "c" as const,
      recommended: true,
      build: () =>
        supabase.from("posts").select(POST_SELECT_BY_CITY).neq("author.city_id", cityId).not("author_id", "in", inList(mine)),
    },
  ];

  for (const s of streams) {
    if (out.length >= FEED_PAGE) break;
    if (next[s.key] === "done") continue;
    const want = FEED_PAGE - out.length;
    let q = s.build().order("created_at", { ascending: false }).limit(want);
    if (next[s.key]) q = q.lt("created_at", next[s.key]!);
    const { data } = await q;
    const rows = (data as Omit<PostWithMeta, "liked">[] | null) ?? [];
    out.push(...rows.map((p) => ({ ...p, recommended: s.recommended })));
    next[s.key] = rows.length < want ? "done" : rows[rows.length - 1].created_at;
  }

  const posts = await withLikes(supabase, userId, out);
  const done = next.a === "done" && next.b === "done" && next.c === "done";
  return { posts, cursor: next, done };
}

export const getPost = cache(async (id: string, userId: string): Promise<PostWithMeta | null> => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("posts").select(POST_SELECT).eq("id", id).maybeSingle();
  if (!data) return null;
  const [post] = await withLikes(supabase, userId, [data as Omit<PostWithMeta, "liked">]);
  return post;
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
  const supabase = await createClient();
  const { data: followRows } = await supabase.from("follows").select("following_id").eq("follower_id", userId).limit(2000);
  const ids = [userId, ...(followRows ?? []).map((r) => r.following_id as string)];
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
