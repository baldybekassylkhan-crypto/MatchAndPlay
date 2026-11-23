import { CalendarDays, Clock, MapPin, Users, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { getUser } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/env";
import { getLobby } from "@/lib/lobbies";
import { SPORTS } from "@/lib/sports";
import { formatLongDate, formatPrice, formatShortDayTime, formatTime, hasStarted } from "@/lib/time";
import { lobbySlots } from "@/lib/types";
import { SportIcon } from "@/components/ui/SportIcon";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const lobby = supabaseConfigured ? await getLobby(id) : null;
  if (!lobby) return { title: "Игра не найдена", robots: { index: false } };

  const sport = SPORTS[lobby.sport]?.label ?? "Игра";
  const { free } = lobbySlots(lobby);
  const title = `${sport} · ${formatShortDayTime(lobby.start_time)}`;
  const description = `${lobby.location_name}${lobby.city ? `, ${lobby.city.name_ru}` : ""}. ${
    free > 0 ? `Свободных мест: ${free}.` : "Мест пока нет."
  } Присоединяйся в Match&Play!`;

  return {
    title,
    description,
    robots: { index: false },
    openGraph: { title, description, siteName: "Match&Play", type: "website", images: [{ url: "/icons/512", width: 512, height: 512 }] },
    twitter: { card: "summary", title, description, images: ["/icons/512"] },
  };
}

/** Публичная страница игры для ссылок из WhatsApp и Telegram. Точка на карте и участники видны только после входа. */
export default async function SharedGamePage({ params }: { params: Params }) {
  const { id } = await params;
  if (!supabaseConfigured) notFound();
  const [lobby, user] = await Promise.all([getLobby(id), getUser()]);
  if (!lobby) notFound();
  if (user) redirect(`/lobby/${lobby.id}`);

  const sport = SPORTS[lobby.sport];
  const { free, total } = lobbySlots(lobby);
  const open = (lobby.status === "active" || lobby.status === "full") && !hasStarted(lobby.start_time);
  const canJoin = open && lobby.status === "active";
  const next = encodeURIComponent(`/lobby/${lobby.id}`);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      <Logo className="text-2xl" />

      <section className="mt-8 flex-1 space-y-5">
        <div>
          <p className="text-accent" aria-hidden>
            <SportIcon sport={lobby.sport} className="size-12" />
          </p>
          <h1 className="mt-3 text-3xl font-extrabold">{sport?.label ?? "Игра"}</h1>
          <p className="mt-2 text-lg whitespace-pre-line">{lobby.description}</p>
        </div>

        {!open && (
          <p className="rounded-2xl bg-surface-2 p-4 font-semibold">
            {lobby.status === "cancelled" ? "Организатор отменил эту игру" : "Эта игра уже прошла"}
          </p>
        )}

        <ul className="space-y-2 text-[15px]">
          <Info icon={CalendarDays}>{formatLongDate(lobby.start_time)}</Info>
          <Info icon={Clock}>{formatTime(lobby.start_time)}</Info>
          <Info icon={MapPin}>
            {lobby.location_name}
            {lobby.city && <span className="text-muted">, {lobby.city.name_ru}</span>}
          </Info>
          <Info icon={Wallet}>{formatPrice(lobby.price_kzt)}</Info>
          <Info icon={Users}>{free > 0 ? `Свободно ${free} из ${total} мест` : `Все ${total} мест заняты`}</Info>
        </ul>
      </section>

      <div className="mt-8 space-y-2">
        <Link href={`/login?next=${next}`} className="btn-primary h-14 w-full text-lg">
          {canJoin ? "Хочу играть" : "Найти другую игру"}
        </Link>
        <p className="text-center text-xs text-muted">
          Продолжая, вы принимаете{" "}
          <Link href="/privacy" className="underline">
            политику конфиденциальности
          </Link>
        </p>
      </div>
    </main>
  );
}

function Info({ icon: Icon, children }: { icon: typeof Clock; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <Icon className="mt-0.5 size-5 shrink-0 text-muted" />
      <span>{children}</span>
    </li>
  );
}
