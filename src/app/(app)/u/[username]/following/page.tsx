import { FollowListPage } from "@/components/FollowListPage";

export const metadata = { title: "Подписки" };

export default async function FollowingPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return <FollowListPage username={username} kind="following" />;
}
