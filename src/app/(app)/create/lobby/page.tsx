import { redirect } from "next/navigation";
import { LobbyForm } from "@/components/LobbyForm";
import { PageHeader } from "@/components/PageHeader";
import { getCities, getMyProfile } from "@/lib/auth";

export const metadata = { title: "Новая игра" };

export default async function CreateLobbyPage() {
  const profile = await getMyProfile();
  if (!profile) redirect("/onboarding");
  const cities = await getCities();

  return (
    <>
      <PageHeader title="Новая игра" back="/create" />
      <div className="px-5 pt-6 pb-10">
        <LobbyForm cities={cities} defaultCityId={profile.city_id} defaultSport={profile.sports[0]} />
      </div>
    </>
  );
}
