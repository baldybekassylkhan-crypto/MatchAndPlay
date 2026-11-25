import { notFound, redirect } from "next/navigation";
import { LobbyForm } from "@/components/LobbyForm";
import { PageHeader } from "@/components/PageHeader";
import { getCities, getMyProfile, getUser } from "@/lib/auth";
import { getLobby } from "@/lib/lobbies";
import { hasStarted } from "@/lib/time";

export const metadata = { title: "Изменить игру" };

export default async function EditLobbyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [lobby, user] = await Promise.all([getLobby(id), getUser()]);
  if (!lobby) notFound();
  const editable = (lobby.status === "active" || lobby.status === "full") && !hasStarted(lobby.start_time);
  if (lobby.organizer_id !== user?.id || !editable) redirect(`/lobby/${id}`);
  const [cities, me] = await Promise.all([getCities(), getMyProfile()]);

  return (
    <>
      <PageHeader title="Изменить игру" back={`/lobby/${id}`} />
      <div className="px-5 pt-6 pb-10">
        <LobbyForm cities={cities} defaultCityId={lobby.city_id} lobby={lobby} canWomenOnly={me?.gender === "female"} />
      </div>
    </>
  );
}
