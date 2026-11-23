"use client";

import clsx from "clsx";
import { Loader2, Send } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { sendMessage } from "@/app/actions/chat";
import { Avatar } from "@/components/Avatar";
import { createClient } from "@/lib/supabase/client";
import { formatDay, formatTime } from "@/lib/time";
import type { MiniProfile } from "@/lib/types";

export interface ChatMessage {
  id: string;
  lobby_id: string;
  user_id: string;
  text: string;
  created_at: string;
}

export function LobbyChat({
  lobbyId,
  myId,
  initialMessages,
  members,
  readOnly,
}: {
  lobbyId: string;
  myId: string;
  initialMessages: ChatMessage[];
  /** Участники по id — чтобы показывать ник и аватар у новых сообщений */
  members: Record<string, MiniProfile>;
  readOnly: boolean;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [pending, startTransition] = useTransition();
  const bottom = useRef<HTMLDivElement>(null);

  const add = (m: ChatMessage) =>
    setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m].sort((a, b) => a.created_at.localeCompare(b.created_at))));

  // Новые сообщения в реальном времени (Supabase Realtime, с учётом RLS)
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`lobby-chat-${lobbyId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "lobby_messages", filter: `lobby_id=eq.${lobbyId}` },
        (payload) => add(payload.new as ChatMessage),
      )
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    return () => {
      supabase.removeChannel(channel);
    };
  }, [lobbyId]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  const send = () => {
    const value = text.trim();
    if (!value) return;
    startTransition(async () => {
      setError(null);
      const res = await sendMessage(lobbyId, value);
      if (res.ok && res.message) {
        setText("");
        add(res.message);
      } else setError(res.error ?? "Ошибка");
    });
  };

  const rows = useMemo(() => {
    let lastDay = "";
    return messages.map((m, i) => {
      const day = formatDay(m.created_at);
      const showDay = day !== lastDay;
      lastDay = day;
      const prev = messages[i - 1];
      const grouped = !showDay && prev?.user_id === m.user_id;
      return { m, day: showDay ? day : null, grouped };
    });
  }, [messages]);

  return (
    <div className="flex min-h-[calc(100dvh-7.5rem)] flex-col">
      <div className="flex-1 space-y-1 px-4 py-4">
        {messages.length === 0 && (
          <p className="py-16 text-center text-muted">Пока тихо. Договоритесь о деталях: кто берёт мяч, где встречаемся</p>
        )}
        {rows.map(({ m, day, grouped }) => {
          const mine = m.user_id === myId;
          const author = members[m.user_id];
          return (
            <div key={m.id}>
              {day && <p className="py-3 text-center text-xs font-semibold text-muted">{day}</p>}
              <div className={clsx("flex animate-fade-up items-end gap-2", mine && "flex-row-reverse", grouped ? "mt-0.5" : "mt-3")}>
                {!mine &&
                  (grouped ? (
                    <span className="w-7 shrink-0" />
                  ) : (
                    <Link href={author ? `/u/${author.username}` : "#"} className="shrink-0">
                      <Avatar src={author?.avatar_url} name={author?.username ?? "?"} size={28} />
                    </Link>
                  ))}
                <div
                  className={clsx(
                    "max-w-[78%] rounded-2xl px-3.5 py-2",
                    mine ? "rounded-br-md bg-accent text-accent-ink" : "rounded-bl-md bg-surface-2",
                  )}
                >
                  {!mine && !grouped && <p className="text-xs font-semibold opacity-70">@{author?.username ?? "игрок"}</p>}
                  <p className="text-[15px] break-words whitespace-pre-line">{m.text}</p>
                  <p className={clsx("mt-0.5 text-right text-[10px]", mine ? "opacity-60" : "text-muted")}>{formatTime(m.created_at)}</p>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>

      {readOnly ? (
        <p className="sticky bottom-(--nav-space) border-t border-line bg-bg p-4 text-center text-sm text-muted">
          Игра отменена — чат доступен только для чтения
        </p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="sticky bottom-(--nav-space) glass-bar border-t border-line/60"
        >
          <div className="flex items-end gap-2 px-3 py-2">
            <textarea
              className="input max-h-32 min-h-10 flex-1 resize-none py-2"
              rows={1}
              maxLength={1000}
              placeholder="Сообщение…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              aria-label="Сообщение"
            />
            <button
              className="glass-accent flex size-10 shrink-0 items-center justify-center rounded-full text-accent-ink disabled:opacity-40"
              disabled={pending || !text.trim()}
              aria-label="Отправить"
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </button>
          </div>
          {error && <p className="px-4 pb-2 text-sm text-danger">{error}</p>}
          {!live && <p className="px-4 pb-2 text-xs text-muted">Подключаемся к чату…</p>}
        </form>
      )}
    </div>
  );
}
