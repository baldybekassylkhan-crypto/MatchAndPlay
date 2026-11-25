import { getT } from "@/lib/i18n/server";
import clsx from "clsx";
import { ChevronRight, MessageCircle, Plus, Trophy, Users } from "lucide-react";
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
  const t = await getT();
  const profile = await getMyProfile();
  if (!profile) redirect("/onboarding");
  const tab = (await searchParams).tab === "chats" ? "chats" : "crews";

  const [myCrews, chats] = await Promise.all([getMyCrews(profile.id), getAllChats(profile.id)]);
  const cityCrews = tab === "crews" ? await getCityCrews(profile.city_id, myCrews.map((c) => c.id)) : [];
  const unread = chats.filter((c) => c.unread > 0).length;

  return (
    <>
      <PageHeader
        title={t("Общение")}
        right={
          <Link href="/crews/new" className="flex size-10 items-center justify-center" aria-label={t("Создать команду")}>
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
                {t("Чаты")}
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
              title={t("Чатов пока нет")}
              text={t("Здесь появятся личные сообщения, чаты команд и чаты ваших игр.")}
              action={{ href: "/search", label: t("Найти игру") }}
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
        <div key="crews" className="animate-fade-up space-y-6 px-4 pt-3 pb-8">
          <Link href="/crews/ranking" className="card flex items-center gap-3 p-4 active:bg-surface-2">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-[#f5c542] text-black" aria-hidden>
              <Trophy className="size-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[17px] font-semibold">{t("Рейтинг команд города")}</span>
              <span className="block truncate text-[14px] text-muted">{t("Футбол и баскетбол · очки за турниры · каждый месяц заново")}</span>
            </span>
            <ChevronRight className="size-5 shrink-0 text-muted/60" aria-hidden />
          </Link>

          {myCrews.length > 0 ? (
            <CrewSection title={t("Мои команды")}>
              {myCrews.map((crew) => (
                <li key={crew.id}>
                  <CrewCard crew={crew} />
                </li>
              ))}
              <li>
                <Link href="/crews/new" className="flex h-12 items-center gap-3 px-4 text-[17px] text-accent active:bg-surface-2">
                  <Plus className="size-5" aria-hidden /> Новая команда
                </Link>
              </li>
            </CrewSection>
          ) : (
            <section className="card flex flex-col items-center px-5 pt-6 pb-5 text-center">
              <span className="flex items-center" aria-hidden>
                {(["basketball", "football", "volleyball"] as const).map((sport, i) => (
                  <span
                    key={sport}
                    className={clsx(
                      "flex items-center justify-center rounded-full border-[3px] border-surface",
                      i === 1 ? "z-10 -mx-2.5 size-[60px] bg-accent text-accent-ink" : "size-12 bg-[color-mix(in_srgb,var(--accent)_22%,var(--surface))] text-accent",
                    )}
                  >
                    <SportIcon sport={sport} className={i === 1 ? "size-7" : "size-5"} />
                  </span>
                ))}
              </span>
              <h2 className="mt-4 text-[20px] font-semibold">{t("Своя команда")}</h2>
              <p className="mt-1 max-w-[17rem] text-[15px] text-muted">{t("Постоянный состав, общий чат и матчи против других команд.")}</p>
              <Link href="/crews/new" className="btn-primary mt-4 w-full">
                {t("Создать команду")}
              </Link>
            </section>
          )}

          {cityCrews.length > 0 && (
            <CrewSection title={t("Рядом с вами")}>
              {cityCrews.map((crew) => (
                <li key={crew.id}>
                  <CrewCard crew={crew} />
                </li>
              ))}
            </CrewSection>
          )}
        </div>
      )}
    </>
  );
}

function CrewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-1.5 px-4 text-[13px] text-muted">{title}</h2>
      <ul className="card divide-y divide-line overflow-hidden">{children}</ul>
    </section>
  );
}

async function ChatRow({ chat: c }: { chat: ChatListItem }) {
  const t = await getT();
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
            <span className="shrink-0 text-xs text-muted">{t.d(timeAgo(c.at))}</span>
          </span>
          <span className="flex items-center justify-between gap-2">
            <span className={clsx("truncate text-sm", c.unread > 0 ? "font-semibold text-ink" : "text-muted")}>
              {c.kind !== "direct" && <span className="text-muted">{t(KIND_LABEL[c.kind])} · </span>}
              {c.preview}
            </span>
            {c.unread > 0 &&
              (c.kind === "lobby" ? (
                <span className="size-2.5 shrink-0 rounded-full bg-danger" role="img" aria-label={t("Есть новые сообщения")} />
              ) : (
                <span className="shrink-0 rounded-full bg-danger px-1.5 text-xs leading-5 font-semibold text-white">{c.unread > 99 ? "99+" : c.unread}</span>
              ))}
          </span>
        </span>
      </Link>
    </li>
  );
}
