import { CalendarDays, Clock, Gift, MapPin, Pencil, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { PageHeader } from "@/components/PageHeader";
import { ReviewControls } from "@/components/tournaments/ReviewControls";
import {
  CancelTournamentButton,
  RegisterTeamForm,
  StartTournamentButton,
  WithdrawTeamButton,
} from "@/components/tournaments/TournamentActions";
import { TournamentBracket } from "@/components/tournaments/TournamentBracket";
import { TournamentStatusBadge } from "@/components/tournaments/TournamentCard";
import { getMyProfile } from "@/lib/auth";
import { getCaptainCrews } from "@/lib/crews";
import { formatDayTime } from "@/lib/time";
import { getTournament, getTournamentContact, getTournamentMatches, getTournamentTeams, isAppAdmin } from "@/lib/tournaments";
import { SportIcon } from "@/components/ui/SportIcon";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const t = await getTournament((await params).id);
  return { title: t?.name ?? "Турнир" };
}

export default async function TournamentPage({ params, searchParams }: { params: Params; searchParams: Promise<{ sent?: string }> }) {
  const { id } = await params;
  const { sent } = await searchParams;
  const [t, profile, admin] = await Promise.all([getTournament(id), getMyProfile(), isAppAdmin()]);
  if (!t) notFound();
  if (!profile) redirect("/onboarding");

  const isOrganizer = t.organizer_id === profile.id;
  const canManage = isOrganizer || admin;
  const [teams, matches, crews, contact] = await Promise.all([
    getTournamentTeams(t.id),
    getTournamentMatches(t.id),
    t.status === "registration" ? getCaptainCrews(profile.id) : Promise.resolve([]),
    canManage ? getTournamentContact(t.id) : Promise.resolve(null),
  ]);
  const myTeam = teams.find((team) => team.captain_id === profile.id) ?? null;
  const registrationOpen = t.status === "registration" && new Date(t.registration_ends_at).getTime() > Date.now();
  const hasSpace = teams.length < t.max_teams;

  return (
    <>
      <PageHeader title={t.name} back="/tournaments" />
      <div className="space-y-6 pt-5 pb-10">
        <div className="space-y-5 px-5">
          {sent && t.status === "pending" && (
            <p className="rounded-2xl bg-accent p-4 font-semibold text-accent-ink">Заявка отправлена. Мы сообщим, когда модератор её проверит.</p>
          )}
          {t.status === "rejected" && (
            <div className="rounded-2xl bg-danger/10 p-4 text-danger">
              <p className="font-bold">Турнир отклонён</p>
              {t.rejection_reason && <p className="mt-1 text-sm whitespace-pre-line">{t.rejection_reason}</p>}
            </div>
          )}

          <section className="flex items-start gap-4">
            <span className="flex size-16 shrink-0 items-center justify-center rounded-3xl bg-surface-2 text-3xl" aria-hidden>
              <SportIcon sport={t.sport} className="size-8" />
            </span>
            <div className="min-w-0 flex-1">
              <TournamentStatusBadge status={t.status} />
              <h2 className="mt-1 text-2xl leading-tight font-extrabold break-words">{t.name}</h2>
              {t.organizer && (
                <Link href={`/u/${t.organizer.username}`} className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                  <Avatar src={t.organizer.avatar_url} name={t.organizer.username} size={20} /> @{t.organizer.username}
                </Link>
              )}
            </div>
          </section>

          <p className="whitespace-pre-line">{t.description}</p>

          <ul className="space-y-2 text-[15px]">
            <Info icon={CalendarDays}>Начало: {formatDayTime(t.starts_at)}</Info>
            <Info icon={Clock}>Регистрация до: {formatDayTime(t.registration_ends_at)}</Info>
            <Info icon={MapPin}>
              {t.location_name}
              {t.city && <span className="text-muted">, {t.city.name_ru}</span>}
            </Info>
            <Info icon={Users}>
              {teams.length} из {t.max_teams} команд, по {t.team_size} игроков
            </Info>
            <Info icon={Wallet}>{t.entry_fee_kzt > 0 ? `${new Intl.NumberFormat("ru-RU").format(t.entry_fee_kzt)} ₸ с команды` : "Участие бесплатно"}</Info>
            {t.prize && <Info icon={Gift}>{t.prize}</Info>}
          </ul>

          {t.rules && (
            <section>
              <h2 className="mb-1 font-bold">Правила</h2>
              <p className="text-[15px] whitespace-pre-line text-muted">{t.rules}</p>
            </section>
          )}

          {canManage && contact && (
            <p className="rounded-2xl bg-surface-2 p-3 text-sm">
              <span className="font-semibold">Контакт организатора:</span> {contact}
              <span className="block text-xs text-muted">Виден только организатору и модератору</span>
            </p>
          )}

          {admin && t.status === "pending" && <ReviewControls tournamentId={t.id} />}

          {isOrganizer && (t.status === "pending" || t.status === "rejected") && (
            <Link href={`/tournaments/${t.id}/edit`} className="btn-secondary w-full">
              <Pencil className="size-4" /> {t.status === "rejected" ? "Исправить и отправить снова" : "Изменить заявку"}
            </Link>
          )}

          {registrationOpen && !myTeam && hasSpace && (
            <RegisterTeamForm tournamentId={t.id} crews={crews.map((c) => ({ id: c.id, name: c.name }))} teamSize={t.team_size} />
          )}
          {t.status === "registration" && !myTeam && !hasSpace && <p className="rounded-2xl bg-surface-2 p-4 text-center font-semibold">Все места заняты</p>}
          {t.status === "registration" && !registrationOpen && <p className="rounded-2xl bg-surface-2 p-4 text-center font-semibold">Регистрация закрыта</p>}
          {canManage && t.status === "registration" && <StartTournamentButton tournamentId={t.id} teams={teams.length} />}
        </div>

        {matches.length > 0 && (
          <TournamentBracket
            tournamentId={t.id}
            matches={matches}
            teams={teams}
            canEdit={canManage && (t.status === "in_progress" || t.status === "finished")}
            myTeamId={myTeam?.id ?? null}
            championId={t.winner_team_id}
          />
        )}

        {matches.length === 0 && teams.length > 0 && (
          <section className="px-5">
            <h2 className="mb-2 font-bold">Команды</h2>
            <ul className="divide-y divide-line card">
              {teams.map((team) => (
                <li key={team.id} className="flex items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3">
                    <Avatar src={team.captain?.avatar_url} name={team.captain?.username ?? "?"} size={36} />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{team.name}</span>
                      <span className="block truncate text-sm text-muted">Капитан @{team.captain?.username}</span>
                    </span>
                  </div>
                  {t.status === "registration" && (isOrganizer || team.captain_id === profile.id) && (
                    <WithdrawTeamButton teamId={team.id} tournamentId={t.id} name={team.name} />
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {canManage && !["finished", "cancelled"].includes(t.status) && (
          <div className="px-5">
            <CancelTournamentButton tournamentId={t.id} />
          </div>
        )}
      </div>
    </>
  );
}

function Info({ icon: Icon, children }: { icon: typeof Clock; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <Icon className="mt-0.5 size-5 shrink-0 text-muted" />
      <span className="min-w-0 break-words">{children}</span>
    </li>
  );
}
