import { getT } from "@/lib/i18n/server";
import { BadgeCheck, Building2, CalendarDays, Clock, MapPin, MessagesSquare, Signal, Sun, Venus, Wallet } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Avatar } from "@/components/Avatar";
import { MapView } from "@/components/map/Map";
import { CrewMatchJoin } from "@/components/crews/CrewMatchJoin";
import { OrganizerPanel } from "@/components/lobby/OrganizerPanel";
import { PlayerActions } from "@/components/lobby/PlayerActions";
import { GameWeather } from "@/components/lobby/GameWeather";
import { ShakeCheckIn } from "@/components/lobby/ShakeCheckIn";
import { RemovePlayerButton } from "@/components/lobby/RemovePlayerButton";
import { ShareGameButton } from "@/components/lobby/ShareGameButton";
import { SlotsBar } from "@/components/lobby/SlotsBar";
import { PageHeader } from "@/components/PageHeader";
import { TopToast } from "@/components/ui/TopToast";
import { getUser } from "@/lib/auth";
import { isCheckinOpen } from "@/lib/checkin";
import { getCrewMatch } from "@/lib/crews";
import { getLobby, getLobbyApplications, getLobbyCheckinIds, isLobbySaved } from "@/lib/lobbies";
import { SaveButton } from "@/components/lobby/SaveButton";
import { SPORTS } from "@/lib/sports";
import { formatLongDate, formatPrice, formatTime, hasStarted } from "@/lib/time";
import { LEVELS } from "@/lib/types";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { id } = await params;
  const lobby = await getLobby(id);
  return { title: lobby ? `${SPORTS[lobby.sport]?.label ?? "Игра"} · ${formatTime(lobby.start_time)}` : "Игра" };
}

export default async function LobbyPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<{ created?: string }>;
}) {
  const t = await getT();
  const { id } = await params;
  const { created } = await searchParams;
  const [lobby, user] = await Promise.all([getLobby(id), getUser()]);
  if (!lobby) notFound();

  const isOrganizer = user?.id === lobby.organizer_id;
  const [apps, saved, checkinIds, crewMatch] = await Promise.all([
    getLobbyApplications(lobby.id),
    user && !isOrganizer ? isLobbySaved(user.id, lobby.id) : Promise.resolve(false),
    getLobbyCheckinIds(lobby.id),
    lobby.crew_challenge_id && user ? getCrewMatch(lobby.crew_challenge_id, user.id) : Promise.resolve(null),
  ]);
  const isCrewMatch = Boolean(lobby.crew_challenge_id);
  const myApp = apps.find((a) => a.user_id === user?.id) ?? null;
  const accepted = apps.filter((a) => a.status === "accepted");
  const pendingApps = apps.filter((a) => a.status === "pending");

  const started = hasStarted(lobby.start_time);
  const live = lobby.status === "active" || lobby.status === "full";
  const open = live && !started;
  const sport = SPORTS[lobby.sport];
  const level = LEVELS.find((l) => l.id === lobby.level);
  const checkinOpen = isCheckinOpen(lobby);
  const weatherLat = lobby.lat ?? lobby.city?.lat ?? null;
  const weatherLng = lobby.lng ?? lobby.city?.lng ?? null;

  return (
    <>
      <PageHeader
        title={t(sport?.label ?? "Игра")}
        back="/search"
        right={!isOrganizer && open && !isCrewMatch ? <SaveButton lobbyId={lobby.id} initialSaved={saved} /> : undefined}
      />
      {created && <TopToast message={t("Игра опубликована")} clearParam="created" />}

      <div className="space-y-6 px-5 pt-5 pb-10">
        {lobby.status === "cancelled" && (
          <p className="rounded-2xl bg-danger/10 p-4 font-semibold text-danger">{t("Организатор отменил эту игру")}</p>
        )}
        {live && started && <p className="rounded-2xl bg-surface-2 p-4 font-semibold">{t("Игра уже началась")}</p>}
        {lobby.status === "finished" && <p className="rounded-2xl bg-surface-2 p-4 font-semibold">{t("Игра завершена")}</p>}
        {crewMatch && (
          <p className="rounded-2xl bg-surface-2 p-4 font-semibold">
            Матч команд:{" "}
            <Link href={`/crews/${crewMatch.challenge.from_crew_id}`} className="underline">
              {crewMatch.challenge.from_crew?.name}
            </Link>{" "}
            —{" "}
            <Link href={`/crews/${crewMatch.challenge.to_crew_id}`} className="underline">
              {crewMatch.challenge.to_crew?.name}
            </Link>
          </p>
        )}

        {lobby.women_only && (
          <p className="flex items-center gap-2 rounded-2xl bg-[#ff2d92]/10 p-4 font-semibold text-[#e0247f]">
            <Venus className="size-5 shrink-0" aria-hidden /> Только для девушек
          </p>
        )}

        <section className="space-y-3">
          <p className="text-lg whitespace-pre-line">{lobby.description}</p>
          <ul className="space-y-2 text-[15px]">
            <Info icon={CalendarDays}>{t.d(formatLongDate(lobby.start_time))}</Info>
            <Info icon={Clock}>
              {formatTime(lobby.start_time)}
            </Info>
            <Info icon={MapPin}>
              {lobby.location_name}
              {lobby.city && <span className="text-muted">, {lobby.city.name_ru}</span>}
            </Info>
            <Info icon={Wallet}>{t.d(formatPrice(lobby.price_kzt))}</Info>
            {level && <Info icon={Signal}>Уровень: {level.label.toLowerCase()}</Info>}
            {lobby.is_outdoor != null && <Info icon={lobby.is_outdoor ? Sun : Building2}>{lobby.is_outdoor ? t("На улице") : t("В зале")}</Info>}
          </ul>
        </section>

        {lobby.lat != null && lobby.lng != null && (
          <div className="h-48 overflow-hidden rounded-2xl border border-line">
            <MapView
              center={{ lat: lobby.lat, lng: lobby.lng }}
              marker={{ lat: lobby.lat, lng: lobby.lng }}
              zoom={15}
              className="h-full w-full"
            />
          </div>
        )}

        {lobby.is_outdoor && live && weatherLat != null && weatherLng != null && (
          <Suspense fallback={null}>
            <GameWeather lat={weatherLat} lng={weatherLng} start={lobby.start_time} duration={lobby.duration_min} />
          </Suspense>
        )}

        <SlotsBar lobby={lobby} />

        {checkinOpen && (isOrganizer || myApp?.status === "accepted") && user && (
          <ShakeCheckIn
            lobbyId={lobby.id}
            isOrganizer={isOrganizer}
            checkedIn={checkinIds.has(user.id)}
            total={accepted.length + 1}
            initialCount={checkinIds.size}
          />
        )}

        {open && !isCrewMatch && (
          <ShareGameButton
            lobbyId={lobby.id}
            text={`${t(sport?.label ?? "Игра")}, ${t.d(formatLongDate(lobby.start_time))} в ${formatTime(lobby.start_time)}, ${lobby.location_name}. Присоединяйся!`.trim()}
          />
        )}

        {(isOrganizer || myApp?.status === "accepted") && (
          <Link href={`/lobby/${lobby.id}/chat`} className="btn-secondary w-full">
            <MessagesSquare className="size-5" /> Чат игры
          </Link>
        )}

        {isCrewMatch && !isOrganizer && open && crewMatch?.canJoin && myApp?.status !== "accepted" && myApp?.status !== "rejected" && (
          <CrewMatchJoin lobbyId={lobby.id} full={lobby.status === "full"} />
        )}
        {!isOrganizer && (!isCrewMatch || myApp?.status === "accepted") && (
          <PlayerActions
            lobbyId={lobby.id}
            startTime={lobby.start_time}
            open={open}
            full={lobby.status === "full"}
            application={myApp ? { id: myApp.id, status: myApp.status } : null}
          />
        )}

        {isOrganizer && (
          <OrganizerPanel lobbyId={lobby.id} editable={open} full={lobby.status === "full"} pendingApps={pendingApps} />
        )}

        <section>
          <h2 className="mb-2 font-bold">{t("Участники")}</h2>
          <ul className="divide-y divide-line card">
            {lobby.organizer && (
              <PersonRow
                username={lobby.organizer.username}
                avatar={lobby.organizer.avatar_url}
                note={lobby.players_current > 1 ? `Организатор + ещё ${lobby.players_current - 1}` : t("Организатор")}
                checkedIn={checkinIds.has(lobby.organizer_id)}
              />
            )}
            {accepted.map((a) =>
              a.user ? (
                <PersonRow
                  key={a.id}
                  username={a.user.username}
                  avatar={a.user.avatar_url}
                  checkedIn={checkinIds.has(a.user_id)}
                  action={
                    isOrganizer && open ? (
                      <RemovePlayerButton applicationId={a.id} lobbyId={lobby.id} username={a.user.username} />
                    ) : undefined
                  }
                />
              ) : null,
            )}
          </ul>
        </section>
      </div>
    </>
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

async function PersonRow({
  username,
  avatar,
  note,
  action,
  checkedIn,
}: {
  username: string;
  avatar: string | null;
  note?: string;
  action?: React.ReactNode;
  checkedIn?: boolean;
}) {
  const t = await getT();
  return (
    <li className="flex items-center">
      <Link href={`/u/${username}`} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3">
        <Avatar src={avatar} name={username} size={36} />
        <span className="flex min-w-0 flex-1 items-center gap-1.5 font-medium">
          <span className="truncate">@{username}</span>
          {checkedIn && <BadgeCheck className="size-4 shrink-0 text-accent" aria-label={t("Отмечен на игре")} />}
        </span>
        {note && <span className="text-sm text-muted">{note}</span>}
      </Link>
      {action}
    </li>
  );
}
