import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { SetupNotice } from "@/components/SetupNotice";
import { getCities, getMyProfile, getUser } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/env";
import { safeNext } from "@/lib/validation";

export const metadata = { title: "Знакомство" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (!supabaseConfigured) return <SetupNotice />;
  const next = safeNext((await searchParams).next);
  const user = await getUser();
  if (!user) redirect("/login");
  if (await getMyProfile()) redirect(next);
  const cities = await getCities();

  return <OnboardingWizard userId={user.id} cities={cities} nextPath={next} />;
}
