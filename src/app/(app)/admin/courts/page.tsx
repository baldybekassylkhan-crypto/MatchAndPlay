import { Landmark } from "lucide-react";
import { notFound } from "next/navigation";
import { CitySwitcher } from "@/components/CitySwitcher";
import { AppealBox, StatusControls } from "@/components/courts/AdminCourtControls";
import { CourtReportCard } from "@/components/courts/CourtReportCard";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { getCities, getMyProfile } from "@/lib/auth";
import { OPEN_STATUSES, akimatAppeal, type CourtReport } from "@/lib/courts";
import { createClient } from "@/lib/supabase/server";
import { isAppAdmin } from "@/lib/tournaments";

export const metadata = { title: "Обращения для акимата", robots: { index: false } };

export default async function AdminCourtsPage({ searchParams }: { searchParams: Promise<{ city?: string }> }) {
  if (!(await isAppAdmin())) notFound();
  const [profile, cities, sp] = await Promise.all([getMyProfile(), getCities(), searchParams]);
  const cityId = cities.some((c) => String(c.id) === sp.city) ? Number(sp.city) : (profile?.city_id ?? 1);
  const city = cities.find((c) => c.id === cityId);

  const supabase = await createClient();
  const { data } = await supabase
    .from("court_reports")
    .select("*")
    .eq("city_id", cityId)
    .in("status", OPEN_STATUSES)
    .order("votes", { ascending: false })
    .limit(200);
  const reports = (data as CourtReport[] | null) ?? [];
  const fresh = reports.filter((r) => r.status === "new");

  return (
    <>
      <PageHeader title="Обращения для акимата" back="/courts" right={<CitySwitcher cities={cities} value={cityId} />} />
      {reports.length === 0 ? (
        <EmptyState icon={Landmark} title="Открытых обращений нет" text="Новые обращения жителей появятся здесь." />
      ) : (
        <div className="space-y-4 px-4 pt-3 pb-10">
          {fresh.length > 0 && <AppealBox text={akimatAppeal(city?.name_ru ?? "", fresh)} count={fresh.length} />}
          {reports.map((r) => (
            <CourtReportCard key={r.id} report={r} voted>
              <StatusControls id={r.id} status={r.status} />
            </CourtReportCard>
          ))}
        </div>
      )}
    </>
  );
}
