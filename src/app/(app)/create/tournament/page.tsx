import { redirect } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { TournamentForm } from "@/components/tournaments/TournamentForm";
import { getCities, getMyProfile } from "@/lib/auth";

export const metadata = { title: "Новый турнир" };

export default async function CreateTournamentPage() {
  const profile = await getMyProfile();
  if (!profile) redirect("/onboarding");
  const cities = await getCities();

  return (
    <>
      <PageHeader title="Новый турнир" back="/create" />
      <div className="px-5 pt-5 pb-10">
        <TournamentForm cities={cities} cityId={profile.city_id} sport={profile.sports[0] ?? "football"} />
      </div>
    </>
  );
}
