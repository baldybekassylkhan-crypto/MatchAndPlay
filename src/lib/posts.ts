import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Comment, Post, PostWithMeta } from "@/lib/types";

export const POST_SELECT =
  "*, author:profiles!posts_author_id_fkey(id, username, full_name, avatar_url), lobby:lobbies(id, sport, start_time)";

export const FEED_PAGE = 10;
/** Лента заканчивается: показываем только посты за последние две недели. */
const FEED_DAYS = 14;

/** Курсор ленты — created_at последнего показанного поста. */
export type FeedCursor = string | null;

export const FEED_START: FeedCursor = null;

/** На кого подписан пользователь (+ он сам). Один запрос на рендер — общий для ленты и кружков хайлайтов. */
export const getFollowingIds = cache(async (userId: string): Promise<string[]> => {
  const supabase = await createClient();
  const { data } = await supabase.from("follows").select("following_id").eq("follower_id", userId).limit(2000);
  return [userId, ...(data ?? []).map((r) => r.following_id as string)];
});

/** Лайк текущего пользователя приходит вместе с постом — без отдельного запроса. */
const LIKED_BY_ME = ", my_like:likes(user_id)";
type RawPost = Omit<PostWithMeta, "liked"> & { my_like?: { user_id: string }[] };
const toPost = (p: RawPost): PostWithMeta => {
  const { my_like, ...rest } = p;
  return { ...rest, liked: (my_like?.length ?? 0) > 0 };
};

/** Лента: посты всех игроков за последние две недели. Заблокированных скрывает RLS. */
export async function getFeedPage(
  userId: string,
  cursor: FeedCursor,
): Promise<{ posts: PostWithMeta[]; cursor: FeedCursor; done: boolean }> {
  const supabase = await createClient();

  let query = supabase
    .from("posts")
    .select(POST_SELECT + LIKED_BY_ME)
    .eq("my_like.user_id", userId)
    .gt("created_at", new Date(Date.now() - FEED_DAYS * 86_400_000).toISOString())
    .order("created_at", { ascending: false })
    .limit(FEED_PAGE);
  if (cursor) query = query.lt("created_at", cursor);

  const { data } = await query;
  const rows = (data as unknown as RawPost[] | null) ?? [];
  return {
    posts: rows.map(toPost),
    cursor: rows.at(-1)?.created_at ?? cursor,
    done: rows.length < FEED_PAGE,
  };
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
