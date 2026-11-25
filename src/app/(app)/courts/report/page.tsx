import { getT } from "@/lib/i18n/server";
import { MapPin } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { CourtReportForm } from "@/components/courts/CourtReportForm";
import { PageHeader } from "@/components/PageHeader";
import { getCities, getMyProfile } from "@/lib/auth";
import { issuesFor } from "@/lib/courts";
import { VENUE_KINDS, VENUE_KIND_IDS, type VenueKind } from "@/lib/venues";

export const metadata = { title: "Сообщить о проблеме" };

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => ((Array.isArray(v) ? v[0] : v) ?? "").trim();

export default async function CourtReportPage({ searchParams }: { searchParams: Promise<Params> }) {
  const t = await getT();
  const profile = await getMyProfile();
  if (!profile) redirect("/onboarding");
  const sp = await searchParams;
  const cities = await getCities();
  const id = one(sp.venue);
  const k = one(sp.k) as VenueKind;
  const lat = Number(one(sp.lat));
  const lng = Number(one(sp.lng));
  const cityId = Number(one(sp.city));
  if (!/^[a-z]\d{3,30}$/i.test(id) || !VENUE_KIND_IDS.includes(k) || !Number.isFinite(lat) || !Number.isFinite(lng) || !cities.some((c) => c.id === cityId)) {
    notFound();
  }
  const kind = VENUE_KINDS[k];
  const name = one(sp.name).slice(0, 120) || kind.label;
  const address = one(sp.a).slice(0, 120);

  return (
    <>
      <PageHeader title={t("Проблема на площадке")} back="/search" />
      <div className="space-y-5 px-5 pt-5 pb-10">
        <section className="flex items-start gap-3 rounded-2xl bg-surface-2 p-4">
          <MapPin className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div className="min-w-0">
            <p className="font-semibold">{name}</p>
            <p className="text-sm text-muted">
              {t(kind.label)}
              {address && ` · ${address}`}
            </p>
          </div>
        </section>
        <CourtReportForm
          userId={profile.id}
          venue={{ id, name: address && name === kind.label ? `${t(kind.label)}, ${address}` : name, lat, lng, cityId }}
          issues={issuesFor(k)}
        />
      </div>
    </>
  );
}
