import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { SetupNotice } from "@/components/SetupNotice";
import { getCities, getMyProfile, getUser } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/env";

export const metadata = { title: "Знакомство" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  if (!supabaseConfigured) return <SetupNotice />;
  const user = await getUser();
  if (!user) redirect("/login");
  if (await getMyProfile()) redirect("/");
  const cities = await getCities();

  return <OnboardingWizard userId={user.id} cities={cities} />;
}
