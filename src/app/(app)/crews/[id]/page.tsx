import { Crown, Lock, MapPin, MessagesSquare, Swords, Users } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { ChallengeCard } from "@/components/crews/ChallengeCard";
import { RemoveMemberButton, RequestControls } from "@/components/crews/CrewMemberControls";
import { CrewJoinButton } from "@/components/crews/CrewJoinButton";
import { PageHeader } from "@/components/PageHeader";
import { getMyProfile } from "@/lib/auth";
import { getCaptainCrews, getCrew, getCrewChallenges, getCrewMembers } from "@/lib/crews";
import { SPORTS } from "@/lib/sports";
import { createClient } from "@/lib/supabase/server";
import { plural } from "@/lib/time";
import { SportIcon } from "@/components/ui/SportIcon";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const crew = await getCrew((await params).id);
  return { title: crew?.name ?? "Команда" };
}

export default async function CrewPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<{ challenged?: string }>;
}) {
  const { id } = await params;
  const { challenged } = await searchParams;
  const [crew, profile] = await Promise.all([getCrew(id), getMyProfile()]);
  if (!crew) notFound();
  if (!profile) redirect("/onboarding");

  const supabase = await createClient();
  const [members, challenges, captainCrews, { data: conversation }] = await Promise.all([
    getCrewMembers(crew.id),
    getCrewChallenges(crew.id),
    getCaptainCrews(profile.id),
    supabase.from("conversations").select("id").eq("crew_id", crew.id).maybeSingle(),
  ]);

  const me = members.find((m) => m.user_id === profile.id) ?? null;
  const isMember = me?.status === "active";
  const isCaptain = crew.captain_id === profile.id;
  const active = members.filter((m) => m.status === "active");
  const requests = isCaptain ? members.filter((m) => m.status === "pending") : [];
  const canChallenge = !isCaptain && captainCrews.some((c) => c.id !== crew.id);
  const sport = SPORTS[crew.sport];

  return (
    <>
      <PageHeader title={crew.name} back="/crews" />

      <div className="space-y-6 px-5 pt-5 pb-10">
        {challenged && <p className="rounded-2xl bg-accent p-4 font-semibold text-accent-ink">Вызов отправлен капитану команды!</p>}

        <section className="flex items-center gap-4">
          <span className="flex size-20 shrink-0 items-center justify-center rounded-3xl bg-surface-2 text-4xl" aria-hidden>
            <SportIcon sport={crew.sport} className="size-9" />
          </span>
          <div className="min-w-0 space-y-1">
            <h2 className="truncate text-2xl font-extrabold">{crew.name}</h2>
            <p className="flex items-center gap-1 text-sm text-muted">
              <MapPin className="size-3.5 shrink-0" />
              {crew.city?.name_ru} · {sport?.label}
            </p>
            <p className="flex items-center gap-1 text-sm text-muted">
              {crew.is_open ? <Users className="size-3.5" /> : <Lock className="size-3.5" />}
              {crew.member_count} {plural(crew.member_count, ["игрок", "игрока", "игроков"])}
              {!crew.is_open && " · по заявке"}
            </p>
          </div>
        </section>

        {crew.description && <p className="whitespace-pre-line">{crew.description}</p>}

        <div className="space-y-2">
          {isMember && conversation && (
            <Link href={`/messages/${conversation.id}`} className="btn-primary w-full">
              <MessagesSquare className="size-5" /> Чат команды
            </Link>
          )}
          {canChallenge && (
            <Link href={`/crews/${crew.id}/challenge`} className="btn-secondary w-full">
              <Swords className="size-5" /> Бросить вызов
            </Link>
          )}
          <CrewJoinButton
            crewId={crew.id}
            status={me?.status ?? null}
            isOpen={crew.is_open}
            isCaptain={isCaptain}
            memberCount={crew.member_count}
          />
        </div>

        {requests.length > 0 && (
          <section>
            <h2 className="mb-2 font-bold">
              Заявки <span className="text-muted">{requests.length}</span>
            </h2>
            <ul className="divide-y divide-line card">
              {requests.map((m) =>
                m.user ? (
                  <MemberRow key={m.user_id} username={m.user.username} avatar={m.user.avatar_url}>
                    <RequestControls crewId={crew.id} userId={m.user_id} username={m.user.username} />
                  </MemberRow>
                ) : null,
              )}
            </ul>
          </section>
        )}

        {challenges.length > 0 && (
          <section className="space-y-2">
            <h2 className="font-bold">Матчи и вызовы</h2>
            {challenges.map((c) => (
              <ChallengeCard key={c.id} challenge={c} crewId={crew.id} isCaptain={isCaptain} />
            ))}
          </section>
        )}

        <section>
          <h2 className="mb-2 font-bold">Состав</h2>
          <ul className="divide-y divide-line card">
            {active.map((m) =>
              m.user ? (
                <MemberRow key={m.user_id} username={m.user.username} avatar={m.user.avatar_url} captain={m.user_id === crew.captain_id}>
                  {isCaptain && m.user_id !== crew.captain_id && (
                    <RemoveMemberButton crewId={crew.id} userId={m.user_id} username={m.user.username} />
                  )}
                </MemberRow>
              ) : null,
            )}
          </ul>
        </section>
      </div>
    </>
  );
}

function MemberRow({
  username,
  avatar,
  captain,
  children,
}: {
  username: string;
  avatar: string | null;
  captain?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <li className="flex items-center">
      <Link href={`/u/${username}`} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3">
        <Avatar src={avatar} name={username} size={36} />
        <span className="truncate font-medium">@{username}</span>
        {captain && (
          <span className="flex shrink-0 items-center gap-1 text-sm text-muted">
            <Crown className="size-3.5" /> Капитан
          </span>
        )}
      </Link>
      {children}
    </li>
  );
}
