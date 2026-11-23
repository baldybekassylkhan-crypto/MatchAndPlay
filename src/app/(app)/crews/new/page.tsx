import { redirect } from "next/navigation";
import { CrewForm } from "@/components/crews/CrewForm";
import { PageHeader } from "@/components/PageHeader";
import { getCities, getMyProfile } from "@/lib/auth";

export const metadata = { title: "Новая команда" };

export default async function NewCrewPage() {
  const profile = await getMyProfile();
  if (!profile) redirect("/onboarding");
  const cities = await getCities();

  return (
    <>
      <PageHeader title="Новая команда" back="/crews" />
      <div className="px-5 pt-5 pb-10">
        <CrewForm cities={cities} cityId={profile.city_id} sport={profile.sports[0] ?? "football"} />
      </div>
    </>
  );
}
