import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { TournamentForm } from "@/components/tournaments/TournamentForm";
import { getCities, getMyProfile } from "@/lib/auth";
import { getTournament, getTournamentContact } from "@/lib/tournaments";

export const metadata = { title: "Изменить турнир" };

export default async function EditTournamentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [t, profile] = await Promise.all([getTournament(id), getMyProfile()]);
  if (!t) notFound();
  if (!profile) redirect("/onboarding");
  if (t.organizer_id !== profile.id || !["pending", "rejected"].includes(t.status)) redirect(`/tournaments/${t.id}`);
  const [cities, contact] = await Promise.all([getCities(), getTournamentContact(t.id)]);

  return (
    <>
      <PageHeader title="Изменить турнир" back={`/tournaments/${t.id}`} />
      <div className="px-5 pt-5 pb-10">
        <TournamentForm cities={cities} cityId={t.city_id} sport={t.sport} tournament={t} contact={contact} />
      </div>
    </>
  );
}
