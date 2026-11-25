import { getT } from "@/lib/i18n/server";
import { Plus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { Logo } from "@/components/Logo";
import { PageHeader } from "@/components/PageHeader";
import { Feed } from "@/components/posts/Feed";
import { FeedEnd } from "@/components/posts/FeedEnd";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { getMyProfile } from "@/lib/auth";
import { getFeedGames } from "@/lib/lobbies";
import { getSuggestedPeople } from "@/lib/people";
import { FEED_START, getFeedPage, getHighlightAuthors } from "@/lib/posts";
import { createClient } from "@/lib/supabase/server";

async function countUnread(userId: string) {
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("read", false);
  return count ?? 0;
}

export default async function FeedPage() {
  const t = await getT();
  const profile = await getMyProfile();
  if (!profile) redirect("/onboarding");

  const [page, highlightAuthors, unread, games, people] = await Promise.all([
    getFeedPage(profile.id, FEED_START),
    getHighlightAuthors(profile.id),
    countUnread(profile.id),
    getFeedGames(),
    getSuggestedPeople(profile),
  ]);

  return (
    <>
      <PageHeader
        title={<Logo className="text-xl" />}
        right={
          <div className="flex items-center">
            <Link href="/create/post" className="flex size-10 items-center justify-center" aria-label={t("Новый пост")}>
              <Plus className="size-6" />
            </Link>
            <NotificationBell userId={profile.id} initialUnread={unread} />
          </div>
        }
      />

      {highlightAuthors.length > 0 && (
        <nav aria-label={t("Хайлайты с игр")} className="no-scrollbar flex gap-4 overflow-x-auto px-4 py-2">
          {highlightAuthors.map((a) => (
            <Link key={a.id} href={`/u/${a.username}?tab=highlights`} className="flex w-16 shrink-0 flex-col items-center gap-1">
              <span className="rounded-full bg-accent p-[2px]">
                <span className="block rounded-full bg-bg p-[2px]">
                  <Avatar src={a.avatar_url} name={a.username} size={56} />
                </span>
              </span>
              <span className="w-full truncate text-center text-xs">{a.id === profile.id ? t("Вы") : a.username}</span>
            </Link>
          ))}
        </nav>
      )}

      <Feed
        initialPosts={page.posts}
        initialCursor={page.cursor}
        initialDone={page.done}
        people={people}
        end={<FeedEnd games={games} hasPosts={page.posts.length > 0} />}
      />
    </>
  );
}
