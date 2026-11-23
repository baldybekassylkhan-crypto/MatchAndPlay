"use client";

import clsx from "clsx";
import { CalendarCheck, Compass, House, Plus, User, Users } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { SWITCH_SPRING } from "@/components/ui/Segmented";
import { createClient } from "@/lib/supabase/client";

export function BottomNav({ username }: { username: string }) {
  const pathname = usePathname();
  const myProfile = `/u/${username}`;
  const [pending, setPending] = useState<string | null>(null);
  const [unreadChats, setUnreadChats] = useState(0);
  useEffect(() => setPending(null), [pathname]);

  // Точка на вкладке «Команды»: считаем при переходах
  const refreshUnread = useCallback(async () => {
    const supabase = createClient();
    const [direct, lobby] = await Promise.all([
      supabase.rpc("unread_chat_count"),
      supabase.from("notifications").select("id", { count: "exact", head: true }).eq("type", "chat_message").eq("read", false),
    ]);
    setUnreadChats(((direct.data as number | null) ?? 0) + (lobby.count ?? 0));
  }, []);
  useEffect(() => {
    refreshUnread();
  }, [pathname, refreshUnread]);

  // Одна подписка на всё время работы приложения (RLS пришлёт только мои чаты)
  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout>;
    const onMessage = () => {
      clearTimeout(timer);
      timer = setTimeout(refreshUnread, 1000);
    };
    const channel = supabase
      .channel("nav-unread")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, onMessage)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "lobby_messages" }, onMessage)
      .subscribe();
    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [refreshUnread]);

  const items = [
    { href: "/", label: "Главная", icon: House, active: pathname === "/" },
    { href: "/search", label: "Поиск", icon: Compass, active: pathname.startsWith("/search") },
    {
      href: "/crews",
      label: "Общение",
      icon: Users,
      active: ["/crews", "/messages"].some((p) => pathname.startsWith(p)),
      badge: unreadChats > 0,
    },
    {
      href: "/games",
      label: "Игры",
      icon: CalendarCheck,
      active: ["/games", "/tournaments", "/admin"].some((p) => pathname.startsWith(p)),
    },
    {
      href: myProfile,
      label: "Профиль",
      icon: User,
      active: pathname === myProfile || pathname.startsWith(`${myProfile}/`) || pathname.startsWith("/profile"),
    },
  ];
  const createActive = pending ? pending === "/create" : pathname.startsWith("/create");

  return (
    <nav
      data-bottom-nav
      aria-label="Основное меню"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(0.5rem+env(safe-area-inset-bottom))] transition-transform duration-200"
    >
      <div className="pointer-events-auto mx-auto flex max-w-[30rem] items-center gap-2">
        <ul className="liquid-glass grid h-[62px] min-w-0 flex-1 grid-cols-5 rounded-full p-1">
          {items.map(({ href, label, icon: Icon, active: routeActive, badge }) => {
            const active = pending ? pending === href : routeActive;
            return (
              <li key={href} className="relative min-w-0">
                <Link
                  href={href}
                  aria-label={badge ? `${label}, есть непрочитанные сообщения` : label}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setPending(href)}
                  className={clsx(
                    "relative flex h-full flex-col items-center justify-center gap-0.5 rounded-full text-[10px] font-medium tracking-normal whitespace-nowrap",
                    active ? "text-accent" : "text-ink",
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="bottom-nav-indicator"
                      transition={{ type: "spring", stiffness: 420, damping: 28, mass: 0.9 }}
                      className="liquid-drop absolute inset-0 rounded-full"
                    />
                  )}
                  <motion.span
                    className="relative"
                    initial={false}
                    animate={{ scale: active ? 1.08 : 1 }}
                    whileTap={{ scale: 0.84 }}
                    transition={SWITCH_SPRING}
                  >
                    <Icon className="size-[22px]" strokeWidth={active ? 2.2 : 1.8} />
                    {badge && <span className="absolute -top-0.5 -right-1 size-2 rounded-full bg-danger" aria-hidden />}
                  </motion.span>
                  <span className="relative">{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        <Link
          href="/create"
          aria-label="Создать"
          aria-current={createActive ? "page" : undefined}
          onClick={() => setPending("/create")}
          className={clsx("liquid-glass flex size-[62px] shrink-0 items-center justify-center rounded-full active:scale-90", createActive ? "text-accent" : "text-ink")}
        >
          <Plus className="size-7" strokeWidth={2} />
        </Link>
      </div>
    </nav>
  );
}
