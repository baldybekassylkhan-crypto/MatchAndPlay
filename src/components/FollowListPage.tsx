import { Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { getFollowList, getProfileByUsername } from "@/lib/profiles";

export async function FollowListPage({ username, kind }: { username: string; kind: "followers" | "following" }) {
  const profile = await getProfileByUsername(username);
  if (!profile) notFound();
  const people = await getFollowList(profile.id, kind);

  return (
    <>
      <PageHeader title={kind === "followers" ? "Подписчики" : "Подписки"} back={`/u/${profile.username}`} />
      {people.length === 0 ? (
        <EmptyState
          icon={Users}
          title={kind === "followers" ? "Подписчиков пока нет" : "Подписок пока нет"}
          text="Находите игроков на играх и подписывайтесь друг на друга."
        />
      ) : (
        <ul className="divide-y divide-line">
          {people.map((p) => (
            <li key={p.id}>
              <Link href={`/u/${p.username}`} className="flex items-center gap-3 px-5 py-3">
                <Avatar src={p.avatar_url} name={p.username} size={44} />
                <div className="min-w-0">
                  <p className="truncate font-semibold">@{p.username}</p>
                  {p.full_name && <p className="truncate text-sm text-muted">{p.full_name}</p>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
