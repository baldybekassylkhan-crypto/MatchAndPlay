import { Plus, ShieldCheck, Trophy } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { TournamentCard } from "@/components/tournaments/TournamentCard";
import { getMyProfile } from "@/lib/auth";
import { getCityTournaments, getMyTournaments, getPendingTournaments, isAppAdmin } from "@/lib/tournaments";

export const metadata = { title: "Турниры" };

export default async function TournamentsPage() {
  const profile = await getMyProfile();
  if (!profile) redirect("/onboarding");
  const [city, mine, admin] = await Promise.all([getCityTournaments(profile.city_id), getMyTournaments(profile.id), isAppAdmin()]);
  const queue = admin ? (await getPendingTournaments()).length : 0;
  const mineIds = new Set(mine.map((t) => t.id));
  const others = city.filter((t) => !mineIds.has(t.id));

  return (
    <>
      <PageHeader
        title="Турниры"
        back="/games"
        right={
          <Link href="/create/tournament" className="flex size-10 items-center justify-center" aria-label="Создать турнир">
            <Plus className="size-6" />
          </Link>
        }
      />
      <div className="space-y-6 px-4 pt-4 pb-8">
        {admin && (
          <Link href="/admin/tournaments" className="flex items-center gap-3 rounded-3xl bg-ink p-4 text-bg">
            <ShieldCheck className="size-6 shrink-0" />
            <span className="flex-1 font-bold">Модерация турниров</span>
            {queue > 0 && <span className="rounded-full bg-danger px-2 py-0.5 text-sm font-bold text-white">{queue}</span>}
          </Link>
        )}
        {mine.length > 0 && (
          <section className="space-y-2">
            <h2 className="px-1 font-bold">Мои турниры</h2>
            {mine.map((t) => (
              <TournamentCard key={t.id} tournament={t} />
            ))}
          </section>
        )}
        {others.length > 0 ? (
          <section className="space-y-2">
            <h2 className="px-1 font-bold">Турниры в вашем городе</h2>
            {others.map((t) => (
              <TournamentCard key={t.id} tournament={t} />
            ))}
          </section>
        ) : (
          mine.length === 0 && (
            <EmptyState
              icon={Trophy}
              title="Турниров пока нет"
              text="Предложите первый турнир в вашем городе. После проверки он откроется для записи команд."
              action={{ href: "/create/tournament", label: "Создать турнир" }}
            />
          )
        )}
      </div>
    </>
  );
}
