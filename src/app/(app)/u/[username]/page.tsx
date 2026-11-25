import { getT } from "@/lib/i18n/server";
import { BadgeCheck, ChevronRight, Gift, MapPin, Settings } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { MessageButton } from "@/components/crews/MessageButton";
import { FollowButton } from "@/components/FollowButton";
import { PageHeader } from "@/components/PageHeader";
import { ProfilePostsTabs } from "@/components/posts/ProfilePostsTabs";
import { UserSafetyMenu } from "@/components/safety/UserSafetyMenu";
import { getUser } from "@/lib/auth";
import { getProfilePosts } from "@/lib/posts";
import { getFollowCounts, getProfileByUsername, isFollowing } from "@/lib/profiles";
import { SPORTS } from "@/lib/sports";
import { getMyRewards, nextReward } from "@/lib/rewards";
import { createClient } from "@/lib/supabase/server";
import { LEVELS } from "@/lib/types";
import { SportIcon } from "@/components/ui/SportIcon";

type Params = Promise<{ username: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { username } = await params;
  return { title: `@${username}` };
}

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<{ tab?: string }>;
}) {
  const t = await getT();
  const { username } = await params;
  const { tab } = await searchParams;
  const [profile, me] = await Promise.all([getProfileByUsername(username), getUser()]);
  if (!profile) notFound();

  const isMe = me?.id === profile.id;
  const activeTab = tab === "highlights" ? "highlights" : "posts";
  const supabase = await createClient();
  const [counts, following, posts, blockRow, verified, canMessage] = await Promise.all([
    getFollowCounts(profile.id),
    me && !isMe ? isFollowing(me.id, profile.id) : Promise.resolve(false),
    // Все посты сразу: вкладка «Хайлайты» фильтрует их на устройстве, без запроса
    getProfilePosts(profile.id),
    me && !isMe
      ? supabase.from("blocks").select("blocked_id").eq("blocker_id", me.id).eq("blocked_id", profile.id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.rpc("verified_games_count", { p_user_id: profile.id }),
    me && !isMe ? supabase.rpc("can_message_user", { p_user_id: profile.id }) : Promise.resolve({ data: false }),
  ]);
  const verifiedGames = (verified.data as number | null) ?? 0;
  const next = isMe ? nextReward(await getMyRewards()) : undefined;
  const blocked = Boolean(blockRow.data);
  const level = LEVELS.find((l) => l.id === profile.level);

  return (
    <>
      <PageHeader
        title={`@${profile.username}`}
        right={
          isMe ? (
            <Link href="/profile/edit" className="flex size-10 items-center justify-center" aria-label={t("Настройки")}>
              <Settings className="size-5" />
            </Link>
          ) : (
            <UserSafetyMenu key={String(blocked)} targetId={profile.id} username={profile.username} initialBlocked={blocked} />
          )
        }
      />

      <section className="px-5 pt-5">
        <div className="flex items-center gap-5">
          <Avatar src={profile.avatar_url} name={profile.username} size={84} />
          <dl className="grid flex-1 grid-cols-3 text-center">
            <Stat label={t("игр")} value={profile.games_played} />
            <Stat label={t("подписчики")} value={counts.followers} href={`/u/${profile.username}/followers`} />
            <Stat label={t("подписки")} value={counts.following} href={`/u/${profile.username}/following`} />
          </dl>
        </div>

        <div className="mt-4 space-y-1">
          {profile.full_name && <p className="font-semibold">{profile.full_name}</p>}
          <p className="flex items-center gap-1 text-sm text-muted">
            <MapPin className="size-3.5" />
            {profile.city?.name_ru ?? "Казахстан"}
            {level && <span>· {t(level.label)}</span>}
          </p>
          {verifiedGames > 0 && (
            <p className="flex items-center gap-1 text-sm font-semibold">
              <BadgeCheck className="size-4 text-accent" />
              Подтверждённых игр: {verifiedGames}
            </p>
          )}
          {profile.bio && <p className="whitespace-pre-line">{profile.bio}</p>}
        </div>

        {profile.sports.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {profile.sports.map((s) => (
              <li key={s} className="flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium">
                <SportIcon sport={s} className="size-3.5" /> {SPORTS[s]?.label ?? s}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 flex gap-2">
          {isMe ? (
            <Link href="/profile/edit" className="btn-secondary h-10 flex-1 text-sm">
              {t("Редактировать профиль")}
            </Link>
          ) : blocked ? (
            <p className="w-full rounded-xl bg-surface-2 px-4 py-2.5 text-center text-sm text-muted">{t("Вы заблокировали этого игрока")}</p>
          ) : (
            <>
              <FollowButton targetId={profile.id} initialFollowing={following} />
              {canMessage.data === true && <MessageButton userId={profile.id} />}
            </>
          )}
        </div>
      </section>

      {isMe && next !== undefined && (
        <Link href="/rewards" className="card mx-5 mt-4 flex items-center gap-3 p-3.5 active:bg-surface-2">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent" aria-hidden>
            <Gift className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{t("Награды за игры")}</span>
            <span className="block truncate text-sm text-muted">
              {next ? `${next.sponsor_name}: ещё ${next.games_required - next.progress} до «${next.title}»` : t("Скидки и подарки от партнёров")}
            </span>
          </span>
          <ChevronRight className="size-5 shrink-0 text-muted/60" aria-hidden />
        </Link>
      )}

      <ProfilePostsTabs posts={posts} isMe={isMe} initialTab={activeTab} />
    </>
  );
}

function Stat({ label, value, href }: { label: string; value: number; href?: string }) {
  const body = (
    <>
      <dd className="text-lg font-bold">{value}</dd>
      <dt className="text-xs text-muted">{label}</dt>
    </>
  );
  return href ? (
    <Link href={href} className="flex flex-col-reverse">
      {body}
    </Link>
  ) : (
    <div className="flex flex-col-reverse">{body}</div>
  );
}
