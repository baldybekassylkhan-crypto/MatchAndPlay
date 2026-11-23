import { BadgeCheck, CalendarDays, Clock, MapPin, MessagesSquare, Signal, Wallet } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { MapView } from "@/components/map/Map";
import { CrewMatchJoin } from "@/components/crews/CrewMatchJoin";
import { OrganizerCheckIn } from "@/components/lobby/OrganizerCheckIn";
import { OrganizerPanel } from "@/components/lobby/OrganizerPanel";
import { PlayerActions } from "@/components/lobby/PlayerActions";
import { PlayerCheckIn } from "@/components/lobby/PlayerCheckIn";
import { RemovePlayerButton } from "@/components/lobby/RemovePlayerButton";
import { ShareGameButton } from "@/components/lobby/ShareGameButton";
import { SlotsBar } from "@/components/lobby/SlotsBar";
import { PageHeader } from "@/components/PageHeader";
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
  searchParams: Promise<{ created?: string; checkin?: string }>;
}) {
  const { id } = await params;
  const { created, checkin } = await searchParams;
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

  return (
    <>
      <PageHeader
        title={sport?.label ?? "Игра"}
        back="/search"
        right={!isOrganizer && open && !isCrewMatch ? <SaveButton lobbyId={lobby.id} initialSaved={saved} /> : undefined}
      />

      <div className="space-y-6 px-5 pt-5 pb-10">
        {created && (
          <p className="rounded-2xl bg-accent p-4 font-semibold text-accent-ink">
            Игра опубликована! Теперь её видят игроки из вашего города.
          </p>
        )}
        {lobby.status === "cancelled" && (
          <p className="rounded-2xl bg-danger/10 p-4 font-semibold text-danger">Организатор отменил эту игру</p>
        )}
        {live && started && <p className="rounded-2xl bg-surface-2 p-4 font-semibold">Игра уже началась</p>}
        {lobby.status === "finished" && <p className="rounded-2xl bg-surface-2 p-4 font-semibold">Игра завершена</p>}
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

        <section className="space-y-3">
          <p className="text-lg whitespace-pre-line">{lobby.description}</p>
          <ul className="space-y-2 text-[15px]">
            <Info icon={CalendarDays}>{formatLongDate(lobby.start_time)}</Info>
            <Info icon={Clock}>
              {formatTime(lobby.start_time)}
            </Info>
            <Info icon={MapPin}>
              {lobby.location_name}
              {lobby.city && <span className="text-muted">, {lobby.city.name_ru}</span>}
            </Info>
            <Info icon={Wallet}>{formatPrice(lobby.price_kzt)}</Info>
            {level && <Info icon={Signal}>Уровень: {level.label.toLowerCase()}</Info>}
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

        <SlotsBar lobby={lobby} />

        {checkinOpen && isOrganizer && <OrganizerCheckIn lobbyId={lobby.id} total={accepted.length + 1} />}
        {checkinOpen && myApp?.status === "accepted" && (
          <PlayerCheckIn
            lobbyId={lobby.id}
            checkedIn={checkinIds.has(myApp.user_id)}
            initialCode={checkin && /^\d{6}$/.test(checkin) ? checkin : null}
          />
        )}

        {open && !isCrewMatch && (
          <ShareGameButton
            lobbyId={lobby.id}
            text={`${sport?.label ?? "Игра"}, ${formatLongDate(lobby.start_time)} в ${formatTime(lobby.start_time)}, ${lobby.location_name}. Присоединяйся!`.trim()}
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
          <h2 className="mb-2 font-bold">Участники</h2>
          <ul className="divide-y divide-line card">
            {lobby.organizer && (
              <PersonRow
                username={lobby.organizer.username}
                avatar={lobby.organizer.avatar_url}
                note={lobby.players_current > 1 ? `Организатор + ещё ${lobby.players_current - 1}` : "Организатор"}
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

function PersonRow({
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
  return (
    <li className="flex items-center">
      <Link href={`/u/${username}`} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3">
        <Avatar src={avatar} name={username} size={36} />
        <span className="flex min-w-0 flex-1 items-center gap-1.5 font-medium">
          <span className="truncate">@{username}</span>
          {checkedIn && <BadgeCheck className="size-4 shrink-0 text-accent" aria-label="Отмечен на игре" />}
        </span>
        {note && <span className="text-sm text-muted">{note}</span>}
      </Link>
      {action}
    </li>
  );
}
