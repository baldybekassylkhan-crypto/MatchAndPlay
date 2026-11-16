"use client";

import { Loader2, Send, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { addComment, deleteComment } from "@/app/actions/posts";
import { Avatar } from "@/components/Avatar";
import { timeAgo } from "@/lib/time";
import type { Comment } from "@/lib/types";

export function Comments({
  postId,
  comments,
  myId,
  myUsername,
  myAvatar,
  isPostAuthor,
}: {
  postId: string;
  comments: Comment[];
  myId: string;
  myUsername: string;
  myAvatar: string | null;
  isPostAuthor: boolean;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [removing, setRemoving] = useState<string | null>(null);

  const send = () =>
    startTransition(async () => {
      setError(null);
      const res = await addComment(postId, text);
      if (res.ok) setText("");
      else setError(res.error ?? "Ошибка");
    });

  const remove = (id: string) =>
    startTransition(async () => {
      setRemoving(id);
      await deleteComment(id, postId);
      setRemoving(null);
    });

  return (
    <section id="comments" className="px-4 pt-2 pb-28">
      <h2 className="mb-3 font-bold">Комментарии {comments.length > 0 && <span className="text-muted">{comments.length}</span>}</h2>
      {comments.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Пока нет комментариев. Будьте первым!</p>
      ) : (
        <ul className="space-y-4">
          {comments.map((c) => (
            <li key={c.id} className="flex animate-fade-up gap-3">
              {c.user && (
                <Link href={`/u/${c.user.username}`}>
                  <Avatar src={c.user.avatar_url} name={c.user.username} size={32} />
                </Link>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <Link href={`/u/${c.user?.username}`} className="mr-1.5 font-semibold">
                    @{c.user?.username}
                  </Link>
                  <span className="break-words whitespace-pre-line">{c.text}</span>
                </p>
                <p className="mt-0.5 text-xs text-muted">{timeAgo(c.created_at)}</p>
              </div>
              {(c.user_id === myId || isPostAuthor) && (
                <button
                  type="button"
                  onClick={() => remove(c.id)}
                  disabled={pending}
                  className="flex size-8 shrink-0 items-center justify-center text-muted"
                  aria-label="Удалить комментарий"
                >
                  {removing === c.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) send();
        }}
        className="fixed inset-x-0 bottom-(--nav-space) z-30 glass-bar border-t border-line/60"
      >
        <div className="mx-auto flex max-w-lg items-center gap-2 px-4 py-2">
          <Avatar src={myAvatar} name={myUsername} size={32} />
          <input
            className="input h-10 flex-1"
            placeholder="Добавьте комментарий…"
            maxLength={500}
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-label="Комментарий"
          />
          <button
            className="glass-accent flex size-10 items-center justify-center rounded-full text-accent-ink disabled:opacity-40"
            disabled={pending || !text.trim()}
            aria-label="Отправить"
          >
            {pending && !removing ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </button>
        </div>
        {error && <p className="mx-auto max-w-lg px-4 pb-2 text-sm text-danger">{error}</p>}
      </form>
    </section>
  );
}
