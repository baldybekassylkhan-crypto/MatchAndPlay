import clsx from "clsx";
import { MessageCircle, Plus, Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { CrewCard } from "@/components/crews/CrewCard";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { TabLinks } from "@/components/ui/Segmented";
import { SportIcon } from "@/components/ui/SportIcon";
import { getMyProfile } from "@/lib/auth";
import type { ChatListItem } from "@/lib/chat-list";
import { getAllChats } from "@/lib/chats";
import { getCityCrews, getMyCrews } from "@/lib/crews";
import { timeAgo } from "@/lib/time";

export const metadata = { title: "Общение" };

const KIND_LABEL = { crew: "Команда", lobby: "Игра" } as const;

export default async function CrewsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const profile = await getMyProfile();
  if (!profile) redirect("/onboarding");
  const tab = (await searchParams).tab === "chats" ? "chats" : "crews";

  const [myCrews, chats] = await Promise.all([getMyCrews(profile.id), getAllChats(profile.id)]);
  const cityCrews = tab === "crews" ? await getCityCrews(profile.city_id, myCrews.map((c) => c.id)) : [];
  const unread = chats.filter((c) => c.unread > 0).length;

  return (
    <>
      <PageHeader
        title="Общение"
        right={
          <Link href="/crews/new" className="flex size-10 items-center justify-center" aria-label="Создать команду">
            <Plus className="size-6" />
          </Link>
        }
      />

      <TabLinks
        fill
        layoutId="crews-section-tab"
        className="gap-2 px-4 py-2"
        items={[
          { href: "/crews", label: "Команды", active: tab === "crews" },
          {
            href: "/crews?tab=chats",
            active: tab === "chats",
            label: (
              <>
                Чаты
                {unread > 0 && <span className="rounded-full bg-danger px-1.5 text-xs leading-5 text-white">{unread}</span>}
              </>
            ),
          },
        ]}
      />

      {tab === "chats" ? (
        chats.length === 0 ? (
          <div key="chats" className="animate-fade-up">
            <EmptyState
              icon={MessageCircle}
              title="Чатов пока нет"
              text="Здесь появятся личные сообщения, чаты команд и чаты ваших игр."
              action={{ href: "/search", label: "Найти игру" }}
            />
          </div>
        ) : (
          <ul key="chats" className="card animate-fade-up mx-4 mt-2 mb-8 divide-y divide-line overflow-hidden">
            {chats.map((c) => (
              <ChatRow key={c.key} chat={c} />
            ))}
          </ul>
        )
      ) : (
        <div key="crews" className="animate-fade-up space-y-6 px-4 pt-4 pb-8">
          {myCrews.length > 0 && (
            <section className="space-y-2">
              <h2 className="px-1 font-bold">Мои команды</h2>
              {myCrews.map((crew) => (
                <CrewCard key={crew.id} crew={crew} />
              ))}
            </section>
          )}

          <section className="space-y-2">
            <h2 className="px-1 font-bold">Команды в вашем городе</h2>
            {cityCrews.length > 0 ? (
              cityCrews.map((crew) => <CrewCard key={crew.id} crew={crew} />)
            ) : (
              <div className="flex flex-col items-center gap-3 px-6 py-8 text-center">
                <Users className="size-8 text-muted" aria-hidden />
                <p className="text-muted">{myCrews.length ? "Других команд пока нет." : "Здесь пока нет команд. Станьте первым капитаном!"}</p>
              </div>
            )}
          </section>

          <Link href="/crews/new" className="btn-primary w-full">
            <Plus className="size-5" /> Создать команду
          </Link>
        </div>
      )}
    </>
  );
}

function ChatRow({ chat: c }: { chat: ChatListItem }) {
  return (
    <li>
      <Link href={c.href} className="flex items-center gap-3 px-4 py-3 active:bg-surface-2">
        {c.kind === "direct" ? (
          <Avatar src={c.other?.avatar_url} name={c.other?.username ?? "?"} size={48} />
        ) : (
          <span
            className={clsx(
              "flex size-12 shrink-0 items-center justify-center rounded-full",
              c.kind === "lobby" ? "bg-accent/15 text-accent" : "bg-surface-2",
            )}
            aria-hidden
          >
            {c.sport ? <SportIcon sport={c.sport} className="size-6" /> : <Users className="size-6" />}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate font-semibold">{c.title}</span>
            <span className="shrink-0 text-xs text-muted">{timeAgo(c.at)}</span>
          </span>
          <span className="flex items-center justify-between gap-2">
            <span className={clsx("truncate text-sm", c.unread > 0 ? "font-semibold text-ink" : "text-muted")}>
              {c.kind !== "direct" && <span className="text-muted">{KIND_LABEL[c.kind]} · </span>}
              {c.preview}
            </span>
            {c.unread > 0 &&
              (c.kind === "lobby" ? (
                <span className="size-2.5 shrink-0 rounded-full bg-danger" role="img" aria-label="Есть новые сообщения" />
              ) : (
                <span className="shrink-0 rounded-full bg-danger px-1.5 text-xs leading-5 font-semibold text-white">{c.unread > 99 ? "99+" : c.unread}</span>
              ))}
          </span>
        </span>
      </Link>
    </li>
  );
}
