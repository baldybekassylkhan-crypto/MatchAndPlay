import { FollowListPage } from "@/components/FollowListPage";

export const metadata = { title: "Подписчики" };

export default async function FollowersPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return <FollowListPage username={username} kind="followers" />;
}
