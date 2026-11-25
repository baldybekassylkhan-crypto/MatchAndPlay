"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setLocale } from "@/app/actions/locale";
import { Segmented } from "@/components/ui/Segmented";
import { useT } from "@/components/I18nProvider";
import { LOCALE_NAMES, LOCALES, type Locale } from "@/lib/i18n/core";

export function LanguageSwitch({ className }: { className?: string }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className={className} aria-busy={pending}>
      <Segmented<Locale>
        layoutId="language-switch"
        ariaLabel={t("Язык интерфейса")}
        value={t.locale}
        options={LOCALES.map((l) => ({ value: l, label: LOCALE_NAMES[l] }))}
        onChange={(l) =>
          start(async () => {
            await setLocale(l);
            router.refresh();
          })
        }
      />
    </div>
  );
}
