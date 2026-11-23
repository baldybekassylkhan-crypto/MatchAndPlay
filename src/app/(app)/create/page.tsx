import { ChevronRight, ImagePlus, Trophy, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";

export const metadata = { title: "Создать" };

const ITEMS: { href: string; icon: LucideIcon; title: string; text: string }[] = [
  { href: "/create/lobby", icon: Users, title: "Игра", text: "Найдите игроков на время и место" },
  { href: "/create/tournament", icon: Trophy, title: "Турнир", text: "Сетка и команды, после модерации" },
  { href: "/create/post", icon: ImagePlus, title: "Пост", text: "Фото и видео с ваших игр" },
];

export default function CreatePage() {
  return (
    <>
      <PageHeader title="Создать" />
      <div className="px-4 pt-3">
        <ul className="card divide-y divide-line overflow-hidden">
          {ITEMS.map(({ href, icon: Icon, title, text }) => (
            <li key={href}>
              <Link href={href} className="flex min-h-[68px] items-center gap-3 px-4 py-3 active:bg-surface-2">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent/12 text-accent">
                  <Icon className="size-5" strokeWidth={1.9} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[17px] font-medium">{title}</span>
                  <span className="block truncate text-[14px] text-muted">{text}</span>
                </span>
                <ChevronRight className="size-5 shrink-0 text-muted/60" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
