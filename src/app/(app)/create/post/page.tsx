import { redirect } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { PostComposer } from "@/components/posts/PostComposer";
import { getMyProfile } from "@/lib/auth";
import { getRecentPlayedGames } from "@/lib/lobbies";

export const metadata = { title: "Новый пост" };

export default async function CreatePostPage({ searchParams }: { searchParams: Promise<{ lobby?: string }> }) {
  const profile = await getMyProfile();
  if (!profile) redirect("/onboarding");
  const { lobby } = await searchParams;
  const games = await getRecentPlayedGames(profile.id);

  return (
    <>
      <PageHeader title="Новый пост" back="/create" />
      <div className="px-5 pt-6 pb-10">
        <PostComposer userId={profile.id} games={games} defaultSport={profile.sports[0]} defaultLobbyId={lobby} />
      </div>
    </>
  );
}
