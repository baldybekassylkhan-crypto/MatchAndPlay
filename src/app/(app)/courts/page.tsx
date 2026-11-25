import { getT } from "@/lib/i18n/server";
import clsx from "clsx";
import { Landmark, Map, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CitySwitcher } from "@/components/CitySwitcher";
import { CourtReportCard } from "@/components/courts/CourtReportCard";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { getCities, getMyProfile } from "@/lib/auth";
import { OPEN_STATUSES, type CourtReport } from "@/lib/courts";
import { createClient } from "@/lib/supabase/server";
import { isAppAdmin } from "@/lib/tournaments";

export const metadata = { title: "Площадки города" };

export default async function CourtsPage({ searchParams }: { searchParams: Promise<{ city?: string; tab?: string }> }) {
  const t = await getT();
  const profile = await getMyProfile();
  if (!profile) redirect("/onboarding");
  const sp = await searchParams;
  const cities = await getCities();
  const cityId = cities.some((c) => String(c.id) === sp.city) ? Number(sp.city) : profile.city_id;
  const city = cities.find((c) => c.id === cityId);
  const tab = sp.tab === "fixed" ? "fixed" : "open";

  const supabase = await createClient();
  const [{ data }, { data: myVotes }, admin] = await Promise.all([
    supabase.from("court_reports").select("*").eq("city_id", cityId).order("votes", { ascending: false }).order("created_at", { ascending: false }).limit(200),
    supabase.from("court_report_votes").select("report_id").eq("user_id", profile.id),
    isAppAdmin(),
  ]);
  const reports = (data as CourtReport[] | null) ?? [];
  const voted = new Set((myVotes ?? []).map((v) => v.report_id as string));
  const open = reports.filter((r) => OPEN_STATUSES.includes(r.status));
  const fixed = reports.filter((r) => r.status === "fixed");
  const shown = tab === "open" ? open : fixed;
  const people = reports.reduce((s, r) => s + r.votes, 0);

  return (
    <>
      <PageHeader title={t("Площадки города")} back="/search" right={<CitySwitcher cities={cities} value={cityId} />} />
      <div className="space-y-5 px-4 pt-3 pb-10">
        <section className="card space-y-3 p-4">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-accent/15 text-accent" aria-hidden>
              <Landmark className="size-6" />
            </span>
            <div>
              <h2 className="font-semibold">Вместе с акиматом {city?.name_ru}</h2>
              <p className="text-sm text-muted">
                {t("Сломанное кольцо, нет сетки, не горит свет? Сообщите — мы соберём обращения жителей и передадим их в акимат, а здесь будет видно, что исправили.")}
              </p>
            </div>
          </div>
          <dl className="grid grid-cols-3 gap-2 text-center">
            <Stat label={t("открыто")} value={open.length} />
            <Stat label={t("исправлено")} value={fixed.length} />
            <Stat label={t("жителей")} value={people} />
          </dl>
          <Link href="/search" className="btn-secondary w-full">
            <Map className="size-5" /> Бесплатные площадки на карте
          </Link>
          {admin && (
            <Link href={`/admin/courts?city=${cityId}`} className="btn-secondary w-full">
              <ShieldCheck className="size-5" /> Обращения для акимата
            </Link>
          )}
        </section>

        <nav className="flex gap-2" aria-label={t("Обращения")}>
          <Link href={`/courts?city=${cityId}`} className={clsx("chip", tab === "open" && "chip-active")} aria-current={tab === "open" ? "page" : undefined}>
            Открытые · {open.length}
          </Link>
          <Link href={`/courts?city=${cityId}&tab=fixed`} className={clsx("chip", tab === "fixed" && "chip-active")} aria-current={tab === "fixed" ? "page" : undefined}>
            Исправлено · {fixed.length}
          </Link>
        </nav>

        {shown.length === 0 ? (
          <EmptyState
            icon={Landmark}
            title={tab === "open" ? t("Проблем пока нет") : t("Пока ничего не исправили")}
            text={t("Откройте площадку на карте и нажмите «Сообщить о проблеме».")}
            action={{ href: "/search", label: t("Открыть карту") }}
          />
        ) : (
          <div className="space-y-3">
            {shown.map((r) => (
              <CourtReportCard key={r.id} report={r} voted={voted.has(r.id)} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-surface-2 py-2">
      <dt className="sr-only">{label}</dt>
      <dd className="text-xl font-extrabold tabular-nums">{value}</dd>
      <dd className="text-xs text-muted" aria-hidden>
        {label}
      </dd>
    </div>
  );
}
