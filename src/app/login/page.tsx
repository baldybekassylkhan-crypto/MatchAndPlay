import { LanguageSwitch } from "@/components/LanguageSwitch";
import { getT } from "@/lib/i18n/server";
import { LoginForm } from "@/app/login/LoginForm";
import { Logo } from "@/components/Logo";
import { SetupNotice } from "@/components/SetupNotice";
import { supabaseConfigured } from "@/lib/env";
import { safeNext } from "@/lib/validation";

export const metadata = { title: "Вход" };
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  if (!supabaseConfigured) return <SetupNotice />;
  const { next, error } = await searchParams;
  const t = await getT();

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-10">
      <div className="mb-6 flex justify-end">
        <LanguageSwitch />
      </div>
      <Logo className="text-4xl" />
      <p className="mt-3 mb-8 text-lg text-muted">{t("Найди, с кем сыграть. Футбол, баскетбол и не только — по всему Казахстану.")}</p>
      <LoginForm next={safeNext(next)} initialError={error ? t("Не удалось войти. Попробуйте ещё раз.") : null} />
    </main>
  );
}
