import { CalendarCheck, Camera, Heart, History, Inbox, Trophy } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/EmptyState";
import { LobbyCard, StatusBadge } from "@/components/lobby/LobbyCard";
import { PageHeader } from "@/components/PageHeader";
import { TabLinks } from "@/components/ui/Segmented";
import { getUser } from "@/lib/auth";
import { SaveButton } from "@/components/lobby/SaveButton";
import { getGameHistory, getMyApplications, getMyLobbies, getSavedLobbies } from "@/lib/lobbies";
import { hasStarted, plural } from "@/lib/time";
import type { ApplicationStatus } from "@/lib/types";

export const metadata = { title: "Мои игры" };

const TABS = [
  { id: "saved", label: "Сохранённые" },
  { id: "applications", label: "Мои заявки" },
  { id: "hosting", label: "Мои лобби" },
  { id: "history", label: "История" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const APP_BADGE: Record<ApplicationStatus, { tone: "accent" | "muted" | "danger" | "ink"; label: string }> = {
  accepted: { tone: "accent", label: "Вы в игре" },
  pending: { tone: "muted", label: "Ждёт решения" },
  rejected: { tone: "danger", label: "Отклонена" },
  cancelled: { tone: "muted", label: "Отменена" },
};

export default async function GamesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  // Нужен только id — берём из токена, не дожидаясь загрузки профиля (его проверяет layout)
  const profile = await getUser();
  if (!profile) redirect("/onboarding");
  const { tab: rawTab } = await searchParams;
  const tab: Tab = TABS.some((t) => t.id === rawTab) ? (rawTab as Tab) : "saved";

  return (
    <>
      <PageHeader title="Мои игры" />
      <div className="no-scrollbar sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 overflow-x-auto glass-bar px-4 py-2">
        <TabLinks
          layoutId="games-tab"
          items={TABS.map((t) => ({ href: `/games?tab=${t.id}`, label: t.label, active: tab === t.id }))}
        />
      </div>
      <div key={tab} className="animate-fade-up space-y-3 px-4 pt-4 pb-8">
        {tab === "saved" && <Saved userId={profile.id} />}
        {tab === "applications" && <Applications userId={profile.id} />}
        {tab === "hosting" && <Hosting userId={profile.id} />}
        {tab === "history" && <HistoryList userId={profile.id} />}
      </div>
    </>
  );
}

async function Saved({ userId }: { userId: string }) {
  const lobbies = await getSavedLobbies(userId);
  if (lobbies.length === 0) {
    return (
      <EmptyState
        icon={Heart}
        title="Сохранённых игр нет"
        text="Свайпните карточку вправо или нажмите на сердце на странице игры. Когда игра начнётся, отменится или заполнится, она исчезнет отсюда сама."
        action={{ href: "/search?mode=swipe", label: "Листать игры" }}
      />
    );
  }
  return lobbies.map((l) => (
    <div key={l.id} className="relative">
      <LobbyCard lobby={l} />
      <SaveButton lobbyId={l.id} initialSaved className="absolute top-3 right-3 bg-surface-2" />
    </div>
  ));
}

async function Applications({ userId }: { userId: string }) {
  const apps = await getMyApplications(userId);
  if (apps.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="Заявок пока нет"
        text="Найдите игру и нажмите «Хочу играть» — заявка появится здесь."
        action={{ href: "/search", label: "Найти игру" }}
      />
    );
  }
  return apps.map((a) => {
    if (!a.lobby) return null;
    const badge =
      a.lobby.status === "cancelled"
        ? { tone: "danger" as const, label: "Игра отменена" }
        : hasStarted(a.lobby.start_time)
          ? { tone: "muted" as const, label: "Началась" }
          : APP_BADGE[a.status];
    return <LobbyCard key={a.id} lobby={a.lobby} badge={<StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>} />;
  });
}

async function Hosting({ userId }: { userId: string }) {
  const lobbies = await getMyLobbies(userId);
  if (lobbies.length === 0) {
    return (
      <EmptyState
        icon={CalendarCheck}
        title="Вы ещё не создавали игр"
        text="Соберите команду: укажите время, место и сколько игроков нужно."
        action={{ href: "/create/lobby", label: "Создать игру" }}
      />
    );
  }
  return lobbies.map((l) => (
    <LobbyCard
      key={l.id}
      lobby={l}
      badge={
        l.status === "cancelled" ? (
          <StatusBadge tone="danger">Отменена</StatusBadge>
        ) : l.pendingCount > 0 ? (
          <StatusBadge tone="accent">
            {l.pendingCount} {plural(l.pendingCount, ["заявка", "заявки", "заявок"])}
          </StatusBadge>
        ) : l.status === "full" ? (
          <StatusBadge tone="ink">Собрана</StatusBadge>
        ) : null
      }
    />
  ));
}

async function HistoryList({ userId }: { userId: string }) {
  const games = await getGameHistory(userId);
  if (games.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="Сыгранных игр пока нет"
        text="После каждой игры она появится здесь, а счётчик в профиле вырастет."
      />
    );
  }
  return games.map((l) => (
    <div key={l.id} className="space-y-2">
      <LobbyCard
        lobby={l}
        badge={
          <StatusBadge tone="muted">
            <Trophy className="mr-0.5 inline size-3" /> Сыграна
          </StatusBadge>
        }
      />
      {Date.now() - new Date(l.start_time).getTime() < 30 * 86_400_000 && (
        <Link href={`/create/post?lobby=${l.id}`} className="btn-secondary h-10 w-full text-sm">
          <Camera className="size-4" /> Выложить хайлайт
        </Link>
      )}
    </div>
  ));
}
