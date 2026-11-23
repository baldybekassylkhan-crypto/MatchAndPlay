import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { ProfileForm } from "@/components/ProfileForm";
import { BlockedList, type BlockedUser } from "@/components/safety/BlockedList";
import { DeleteAccount } from "@/components/safety/DeleteAccount";
import { getCities, getMyProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Редактировать профиль" };

export default async function EditProfilePage() {
  const profile = await getMyProfile();
  if (!profile) redirect("/onboarding");
  const supabase = await createClient();
  const [cities, { data: blockedRows }] = await Promise.all([
    getCities(),
    supabase
      .from("blocks")
      .select("user:profiles!blocks_blocked_id_fkey(id, username, avatar_url)")
      .eq("blocker_id", profile.id)
      .order("created_at", { ascending: false }),
  ]);
  const blocked = ((blockedRows as unknown as { user: BlockedUser | null }[] | null) ?? [])
    .map((r) => r.user)
    .filter((u): u is BlockedUser => u !== null);

  return (
    <>
      <PageHeader title="Редактировать профиль" back={`/u/${profile.username}`} />
      <div className="px-5 pt-6 pb-10">
        <ProfileForm mode="edit" userId={profile.id} cities={cities} profile={profile} />
        <BlockedList users={blocked} />
        <form action="/auth/signout" method="post" className="mt-6">
          <button className="btn-secondary w-full text-danger">Выйти из аккаунта</button>
        </form>
        <DeleteAccount username={profile.username} />
        <Link href="/privacy" className="mt-2 block py-2 text-center text-sm text-muted underline">
          Политика конфиденциальности
        </Link>
      </div>
    </>
  );
}
