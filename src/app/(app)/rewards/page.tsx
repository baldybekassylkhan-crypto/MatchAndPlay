import { getT } from "@/lib/i18n/server";
import { BadgeCheck, Gift, Smartphone } from "lucide-react";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { RewardCard } from "@/components/rewards/RewardCard";
import { getMyProfile } from "@/lib/auth";
import { currentKzMonth, daysUntilReset, monthLabel } from "@/lib/ranking";
import { getMyRewards, getVerifiedThisMonth } from "@/lib/rewards";
import { plural } from "@/lib/time";

export const metadata = { title: "Награды" };

export default async function RewardsPage() {
  const t = await getT();
  const profile = await getMyProfile();
  if (!profile) redirect("/onboarding");
  const [offers, verified] = await Promise.all([getMyRewards(), getVerifiedThisMonth(profile.id)]);
  const days = daysUntilReset();

  return (
    <>
      <PageHeader title={t("Награды")} back={`/u/${profile.username}`} />
      <div className="space-y-5 px-4 pt-3 pb-10">
        <section className="card flex items-center gap-4 p-4">
          <span className="flex size-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-accent text-accent-ink">
            <span className="text-2xl leading-none font-extrabold tabular-nums">{verified}</span>
            <BadgeCheck className="mt-0.5 size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="font-semibold">
              {verified} {plural(verified, ["подтверждённая игра", "подтверждённые игры", "подтверждённых игр"])} · {monthLabel(currentKzMonth()).toLowerCase()}
            </h2>
            <p className="text-sm text-muted">
              Счётчик обнулится через {days} {plural(days, ["день", "дня", "дней"])}. Полученные коды остаются.
            </p>
          </div>
        </section>

        <section className="flex items-start gap-3 rounded-2xl bg-surface-2 p-4 text-sm">
          <Smartphone className="mt-0.5 size-5 shrink-0" aria-hidden />
          <p>
            Игра засчитывается, когда вы отметились встряхиванием на площадке и там отметился ещё хотя бы один игрок. Партнёры платят за
            настоящие игры, поэтому накрутить нельзя.
          </p>
        </section>

        {offers.length === 0 ? (
          <EmptyState icon={Gift} title={t("Наград пока нет")} text={t("Скоро здесь появятся предложения от спортивных магазинов, кафе и клубов вашего города.")} />
        ) : (
          <div className="space-y-3">
            {offers.map((o) => (
              <RewardCard key={o.offer_id} offer={o} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
