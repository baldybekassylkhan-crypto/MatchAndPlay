import { getT } from "@/lib/i18n/server";
import clsx from "clsx";
import { ArrowDown, ArrowUp, ChevronRight, Info, Trophy } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CitySwitcher } from "@/components/CitySwitcher";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { TabLinks } from "@/components/ui/Segmented";
import { SportIcon } from "@/components/ui/SportIcon";
import { getCities, getMyProfile } from "@/lib/auth";
import {
  RANKED_SPORTS,
  currentKzMonth,
  daysUntilReset,
  getCrewRanking,
  isMonth,
  monthLabel,
  recentMonths,
  resetDateLabel,
  type CrewRankRow,
  type RankedSport,
} from "@/lib/ranking";
import { SPORTS } from "@/lib/sports";
import { plural } from "@/lib/time";

export const metadata = { title: "Рейтинг команд" };

const MEDALS = ["bg-[#f5c542] text-black", "bg-[#c9ced6] text-black", "bg-[#d4935a] text-black"];

export default async function RankingPage({
  searchParams,
}: {
  searchParams: Promise<{ sport?: string; city?: string; month?: string }>;
}) {
  const t = await getT();
  const profile = await getMyProfile();
  if (!profile) redirect("/onboarding");
  const sp = await searchParams;
  const sport: RankedSport = (RANKED_SPORTS as readonly string[]).includes(sp.sport ?? "") ? (sp.sport as RankedSport) : "football";
  const cities = await getCities();
  const cityId = cities.some((c) => String(c.id) === sp.city) ? Number(sp.city) : profile.city_id;
  const city = cities.find((c) => c.id === cityId);
  const months = recentMonths(6);
  const month = isMonth(sp.month) && months.includes(sp.month) ? sp.month : currentKzMonth();
  const isCurrent = month === currentKzMonth();
  const rows = await getCrewRanking(cityId, sport, month);

  const href = (p: { sport?: string; month?: string }) => {
    const q = new URLSearchParams({ sport: p.sport ?? sport, city: String(cityId), month: p.month ?? month });
    return `/crews/ranking?${q.toString()}`;
  };

  return (
    <>
      <PageHeader title={t("Рейтинг команд")} back="/crews" right={<CitySwitcher cities={cities} value={cityId} />} />

      <TabLinks
        fill
        layoutId="ranking-sport-tab"
        className="gap-2 px-4 py-2"
        items={RANKED_SPORTS.map((s) => ({
          href: href({ sport: s }),
          active: s === sport,
          label: (
            <>
              <SportIcon sport={s} className="size-4" /> {t(SPORTS[s].label)}
            </>
          ),
        }))}
      />

      <div className="space-y-5 px-4 pt-2 pb-10">
        <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" aria-label={t("Месяц")}>
          {months.map((m) => (
            <Link key={m} href={href({ month: m })} className={clsx("chip shrink-0", m === month && "chip-active")} aria-current={m === month ? "page" : undefined}>
              {monthLabel(m)}
            </Link>
          ))}
        </nav>

        <p className="text-sm text-muted">
          {city?.name_ru} · {isCurrent
            ? `обновится ${resetDateLabel()} (через ${daysUntilReset()} ${plural(daysUntilReset(), ["день", "дня", "дней"])})`
            : t("итоги месяца")}
        </p>

        {rows.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title={t("Рейтинг пока пуст")}
            text={`Команды получают очки за турниры. Зарегистрируйте свою команду на турнир по ${sport === "football" ? t("футболу") : t("баскетболу")} в этом месяце.`}
            action={{ href: "/tournaments", label: t("Турниры") }}
          />
        ) : (
          <>
            {rows.length >= 3 && <Podium rows={rows.slice(0, 3)} />}
            <ol className="card divide-y divide-line overflow-hidden">
              {(rows.length >= 3 ? rows.slice(3) : rows).map((r) => (
                <RankRow key={r.crew_id} row={r} />
              ))}
            </ol>
          </>
        )}

        <details className="card p-4 text-sm">
          <summary className="flex cursor-pointer items-center gap-2 font-semibold">
            <Info className="size-4" aria-hidden /> Как считаются очки
          </summary>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-muted">
            <li>{t("Очки дают только завершённые турниры, где команда играла под своим названием.")}</li>
            <li>{t("Место: победа — 100, финал — 60, полуфинал — 35, четвертьфинал — 20, 1/8 — 10, раньше — 5.")}</li>
            <li>{t("Чем больше турнир, тем больше очков: 8 команд — ×1,25, 16 — ×1,5, 32 — ×2.")}</li>
            <li>{t("+5 за каждый выигранный матч.")}</li>
            <li>{t("1-го числа рейтинг начинается заново. Итоги прошлых месяцев сохраняются.")}</li>
          </ul>
        </details>
      </div>
    </>
  );
}

async function Podium({ rows }: { rows: CrewRankRow[] }) {
  const t = await getT();
  // 2-е, 1-е, 3-е место — как на пьедестале
  const order = [rows[1], rows[0], rows[2]];
  return (
    <ol className="grid grid-cols-3 items-end gap-2" aria-label={t("Тройка лидеров")}>
      {order.map((r, i) => {
        const place = r.rank;
        return (
          <li key={r.crew_id}>
            <Link
              href={`/crews/${r.crew_id}`}
              className={clsx("card flex flex-col items-center gap-1.5 px-2 text-center active:bg-surface-2", i === 1 ? "pt-5 pb-4" : "pt-3 pb-3")}
            >
              <span className={clsx("flex items-center justify-center rounded-full font-extrabold", MEDALS[place - 1] ?? "bg-surface-2", i === 1 ? "size-12 text-xl" : "size-10 text-lg")}>
                {place}
              </span>
              <span className="line-clamp-2 min-h-10 text-[15px] leading-5 font-semibold">{r.name}</span>
              <span className="text-lg font-extrabold tabular-nums">{r.points}</span>
              <span className="text-xs text-muted">
                {r.titles > 0 ? `🏆 ${r.titles} · ` : ""}
                {r.tournaments} {plural(r.tournaments, ["турнир", "турнира", "турниров"])}
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

function RankRow({ row: r }: { row: CrewRankRow }) {
  const move = r.prev_rank == null ? null : r.prev_rank - r.rank;
  return (
    <li>
      <Link href={`/crews/${r.crew_id}`} className="flex items-center gap-3 px-4 py-3 active:bg-surface-2">
        <span className="w-7 shrink-0 text-center text-lg font-bold tabular-nums">{r.rank}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{r.name}</span>
          <span className="block truncate text-sm text-muted">
            {r.tournaments} {plural(r.tournaments, ["турнир", "турнира", "турниров"])} · {r.wins}{" "}
            {plural(r.wins, ["победа", "победы", "побед"])}
            {r.titles > 0 && ` · 🏆 ${r.titles}`}
          </span>
        </span>
        {move !== null && move !== 0 && (
          <span className={clsx("flex items-center text-xs font-semibold", move > 0 ? "text-accent" : "text-danger")}>
            {move > 0 ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />}
            {Math.abs(move)}
          </span>
        )}
        <span className="w-12 shrink-0 text-right font-extrabold tabular-nums">{r.points}</span>
        <ChevronRight className="size-4 shrink-0 text-muted/60" aria-hidden />
      </Link>
    </li>
  );
}
