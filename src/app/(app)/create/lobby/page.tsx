import { redirect } from "next/navigation";
import { LobbyForm } from "@/components/LobbyForm";
import { PageHeader } from "@/components/PageHeader";
import { getCities, getMyProfile } from "@/lib/auth";
import { parseVenuePrefill } from "@/lib/venues";

export const metadata = { title: "Новая игра" };

export default async function CreateLobbyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [profile, params] = await Promise.all([getMyProfile(), searchParams]);
  if (!profile) redirect("/onboarding");
  const cities = await getCities();
  const venue = parseVenuePrefill(params, cities.map((c) => c.id));

  return (
    <>
      <PageHeader title="Новая игра" back={venue ? "/search" : "/create"} />
      <div className="px-5 pt-6 pb-10">
        <LobbyForm
          cities={cities}
          defaultCityId={venue?.cityId ?? profile.city_id}
          defaultSport={venue?.sport ?? profile.sports[0]}
          venue={venue}
          canWomenOnly={profile.gender === "female"}
        />
      </div>
    </>
  );
}
