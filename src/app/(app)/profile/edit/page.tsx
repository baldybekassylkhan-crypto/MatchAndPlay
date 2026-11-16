import { redirect } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { ProfileForm } from "@/components/ProfileForm";
import { getCities, getMyProfile } from "@/lib/auth";

export const metadata = { title: "Редактировать профиль" };

export default async function EditProfilePage() {
  const profile = await getMyProfile();
  if (!profile) redirect("/onboarding");
  const cities = await getCities();

  return (
    <>
      <PageHeader title="Редактировать профиль" back={`/u/${profile.username}`} />
      <div className="px-5 pt-6 pb-10">
        <ProfileForm mode="edit" userId={profile.id} cities={cities} profile={profile} />
        <form action="/auth/signout" method="post" className="mt-6">
          <button className="btn-secondary w-full text-danger">Выйти из аккаунта</button>
        </form>
      </div>
    </>
  );
}
