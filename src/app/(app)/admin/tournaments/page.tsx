import { CalendarDays, MapPin, ShieldCheck, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { ReviewControls } from "@/components/tournaments/ReviewControls";
import { formatDayTime, timeAgo } from "@/lib/time";
import { getPendingTournaments, isAppAdmin } from "@/lib/tournaments";

export const metadata = { title: "Модерация турниров", robots: { index: false } };

export default async function AdminTournamentsPage() {
  // Для всех, кроме администратора, страницы как будто не существует
  if (!(await isAppAdmin())) notFound();
  const pending = await getPendingTournaments();

  return (
    <>
      <PageHeader title="Модерация турниров" back="/tournaments" />
      {pending.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="Заявок нет" text="Новые турниры появятся здесь, и вы получите уведомление." />
      ) : (
        <div className="space-y-4 px-4 pt-4 pb-8">
          {pending.map((t) => (
            <article key={t.id} className="space-y-3 card p-4">
              <header>
                <Link href={`/tournaments/${t.id}`} className="text-lg font-extrabold break-words underline-offset-2 hover:underline">
                  {t.name}
                </Link>
                <p className="text-sm text-muted">
                  {t.organizer && (
                    <Link href={`/u/${t.organizer.username}`} className="font-semibold">
                      @{t.organizer.username}
                    </Link>
                  )}{" "}
                  · {timeAgo(t.created_at)}
                </p>
              </header>
              <p className="text-[15px] whitespace-pre-line">{t.description}</p>
              <ul className="space-y-1 text-sm text-muted">
                <li className="flex gap-2">
                  <CalendarDays className="size-4 shrink-0" /> {formatDayTime(t.starts_at)}, регистрация до {formatDayTime(t.registration_ends_at)}
                </li>
                <li className="flex gap-2">
                  <MapPin className="size-4 shrink-0" /> {t.location_name}
                  {t.city && `, ${t.city.name_ru}`}
                </li>
                <li className="flex gap-2">
                  <Users className="size-4 shrink-0" /> {t.max_teams} команд по {t.team_size} игроков
                </li>
                <li className="flex gap-2">
                  <Wallet className="size-4 shrink-0" />
                  {t.entry_fee_kzt > 0 ? `${new Intl.NumberFormat("ru-RU").format(t.entry_fee_kzt)} ₸ с команды` : "Бесплатно"}
                  {t.prize && ` · ${t.prize}`}
                </li>
              </ul>
              {t.rules && <p className="rounded-xl bg-surface-2 p-3 text-sm whitespace-pre-line">{t.rules}</p>}
              <p className="rounded-xl bg-surface-2 p-3 text-sm">
                <span className="font-semibold">Контакт:</span> {t.contact ?? "не указан"}
              </p>
              <ReviewControls tournamentId={t.id} />
            </article>
          ))}
        </div>
      )}
    </>
  );
}
