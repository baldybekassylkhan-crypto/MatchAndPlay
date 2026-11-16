import { redirect } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";
import { SetupNotice } from "@/components/SetupNotice";
import { getMyProfile, getUser } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/env";

// Страницы зависят от сессии пользователя — всегда рендерим на сервере по запросу.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!supabaseConfigured) return <SetupNotice />;
  if (!(await getUser())) redirect("/login");
  const profile = await getMyProfile();
  if (!profile) redirect("/onboarding");

  return (
    <div className="mx-auto min-h-dvh max-w-lg pb-(--nav-space)">
      {children}
      <BottomNav username={profile.username} />
    </div>
  );
}
