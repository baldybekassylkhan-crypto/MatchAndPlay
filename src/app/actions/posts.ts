"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getMyProfile } from "@/lib/auth";
import { MAX_POST_IMAGES, MAX_VIDEO_SECONDS, POSTS_BUCKET } from "@/lib/media";
import { FEED_START, getFeedPage, type FeedCursor } from "@/lib/posts";
import { SPORT_IDS } from "@/lib/sports";
import { getAuthUserId } from "@/lib/supabase/auth-user";
import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createClient();
  const userId = await getAuthUserId(supabase);
  const user = userId ? { id: userId } : null;
  if (!user) redirect("/login");
  return { supabase, userId: user.id };
}

const isUuid = (id: string) => /^[0-9a-f-]{36}$/i.test(id);

const postSchema = z
  .object({
    caption: z
      .string()
      .trim()
      .max(1000, "Не больше 1000 символов")
      .transform((v) => (v === "" ? null : v)),
    sport: z.enum(SPORT_IDS).nullable(),
    lobby_id: z.uuid().nullable(),
    media: z
      .array(
        z.object({
          type: z.enum(["image", "video"]),
          path: z.string().regex(/^[0-9a-f-]{36}\/[\w.-]+$/i),
          w: z.number().int().min(1).max(10000),
          h: z.number().int().min(1).max(10000),
          duration: z.number().min(0).max(MAX_VIDEO_SECONDS + 1).optional(),
        }),
      )
      .min(1, "Добавьте фото или видео")
      .max(MAX_POST_IMAGES),
  })
  .refine((p) => p.media.filter((m) => m.type === "video").length <= 1, "Можно добавить только одно видео")
  .refine((p) => !p.media.some((m) => m.type === "video") || p.media.length === 1, "Видео публикуется отдельно от фото");

export type PostInput = z.input<typeof postSchema>;

export async function createPost(input: PostInput): Promise<{ ok: false; error: string } | { ok: true; id: string }> {
  const { supabase, userId } = await requireUser();
  const parsed = postSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Проверьте пост" };

  // Файлы можно брать только из своей папки
  if (parsed.data.media.some((m) => !m.path.startsWith(`${userId}/`))) {
    return { ok: false, error: "Файлы не найдены, загрузите их заново" };
  }

  const { data, error } = await supabase
    .from("posts")
    .insert({ ...parsed.data, author_id: userId })
    .select("id")
    .single();

  if (error || !data) {
    if (error?.message.includes("not_your_game")) return { ok: false, error: "Хайлайт можно привязать только к своей прошедшей игре" };
    return { ok: false, error: "Не удалось опубликовать пост. Попробуйте ещё раз." };
  }

  revalidatePath("/");
  revalidatePath("/u/[username]", "page");
  return { ok: true, id: data.id };
}

/** Удаляем загруженные файлы, если пост так и не опубликовали. */
export async function discardUploads(paths: string[]) {
  const { supabase, userId } = await requireUser();
  const own = paths.filter((p) => p.startsWith(`${userId}/`)).slice(0, MAX_POST_IMAGES);
  if (own.length) await supabase.storage.from(POSTS_BUCKET).remove(own);
}

export async function deletePost(postId: string) {
  if (!isUuid(postId)) return { ok: false };
  const { supabase, userId } = await requireUser();
  const { data: post } = await supabase.from("posts").select("author_id, media").eq("id", postId).maybeSingle();
  if (!post || post.author_id !== userId) return { ok: false };

  const { error } = await supabase.from("posts").delete().eq("id", postId);
  if (error) return { ok: false };
  const paths = ((post.media as { path: string }[]) ?? []).map((m) => m.path).filter((p) => p.startsWith(`${userId}/`));
  if (paths.length) await supabase.storage.from(POSTS_BUCKET).remove(paths);

  const me = await getMyProfile();
  revalidatePath("/");
  if (me) revalidatePath(`/u/${me.username}`);
  redirect(me ? `/u/${me.username}` : "/");
}

export async function toggleLike(postId: string, like: boolean) {
  if (!isUuid(postId)) return { ok: false };
  const { supabase, userId } = await requireUser();
  const { error } = like
    ? await supabase.from("likes").insert({ post_id: postId, user_id: userId })
    : await supabase.from("likes").delete().eq("post_id", postId).eq("user_id", userId);
  return { ok: !error || error.code === "23505" };
}

export async function addComment(postId: string, text: string) {
  if (!isUuid(postId)) return { ok: false, error: "Пост не найден" };
  const clean = text.trim();
  if (!clean) return { ok: false, error: "Напишите комментарий" };
  if (clean.length > 500) return { ok: false, error: "Не больше 500 символов" };
  const { supabase, userId } = await requireUser();
  const { error } = await supabase.from("comments").insert({ post_id: postId, user_id: userId, text: clean });
  if (error) return { ok: false, error: "Не удалось отправить комментарий" };
  revalidatePath(`/p/${postId}`);
  return { ok: true };
}

export async function deleteComment(commentId: string, postId: string) {
  if (!isUuid(commentId)) return { ok: false };
  const { supabase } = await requireUser();
  const { error } = await supabase.from("comments").delete().eq("id", commentId);
  revalidatePath(`/p/${postId}`);
  return { ok: !error };
}

/** Следующая страница ленты для бесконечной прокрутки. */
export async function loadFeed(cursor: FeedCursor = FEED_START) {
  const profile = await getMyProfile();
  if (!profile) redirect("/onboarding");
  return getFeedPage(profile.id, profile.city_id, cursor);
}
