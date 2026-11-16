"use client";

import clsx from "clsx";
import { CalendarCheck, Home, Plus, Search, User } from "lucide-react";
import Link from "next/link";
import { motion } from "motion/react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SWITCH_SPRING } from "@/components/ui/Segmented";

export function BottomNav({ username }: { username: string }) {
  const pathname = usePathname();
  const myProfile = `/u/${username}`;
  const [pending, setPending] = useState<string | null>(null);
  useEffect(() => setPending(null), [pathname]);

  const items = [
    { href: "/", label: "Главная", icon: Home, active: pathname === "/" },
    { href: "/search", label: "Поиск игр", icon: Search, active: pathname.startsWith("/search") },
    { href: "/create", label: "Создать", icon: Plus, active: pathname.startsWith("/create"), primary: true },
    { href: "/games", label: "Мои игры", icon: CalendarCheck, active: pathname.startsWith("/games") },
    {
      href: myProfile,
      label: "Профиль",
      icon: User,
      active: pathname === myProfile || pathname.startsWith(`${myProfile}/`) || pathname.startsWith("/profile"),
    },
  ];

  return (
    // «Парящее» стеклянное меню над контентом
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      <ul className="glass pointer-events-auto mx-auto grid h-16 max-w-[30rem] grid-cols-5 overflow-hidden rounded-[1.75rem]">
        {items.map(({ href, label, icon: Icon, active: routeActive, primary }) => {
          // Пока страница грузится, вкладка уже подсвечена — меню не «залипает»
          const active = pending ? pending === href : routeActive;
          return (
            <li key={href} className="relative">
              <Link
                href={href}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                onClick={() => setPending(href)}
                className={clsx(
                  "flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors duration-200",
                  active ? "text-ink" : "text-muted",
                )}
              >
                {active && !primary && (
                  <motion.span
                    layoutId="bottom-nav-indicator"
                    transition={SWITCH_SPRING}
                    className="absolute top-0 h-[3px] w-8 rounded-b-full bg-accent"
                  />
                )}
                {primary ? (
                  <motion.span
                    whileTap={{ scale: 0.88, rotate: 90 }}
                    transition={SWITCH_SPRING}
                    className="glass-accent flex size-10 items-center justify-center rounded-2xl text-accent-ink"
                  >
                    <Icon className="size-6" strokeWidth={2.5} />
                  </motion.span>
                ) : (
                  <>
                    <motion.span
                      animate={{ scale: active ? 1.12 : 1, y: active ? -1 : 0 }}
                      whileTap={{ scale: 0.85 }}
                      transition={SWITCH_SPRING}
                    >
                      <Icon className="size-6" strokeWidth={active ? 2.5 : 2} />
                    </motion.span>
                    {label}
                  </>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
