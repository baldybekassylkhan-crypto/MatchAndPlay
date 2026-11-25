"use client";

import { createContext, useContext, useMemo } from "react";
import { makeT, type Locale, type T } from "@/lib/i18n/core";

const I18nContext = createContext<Locale>("ru");

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <I18nContext.Provider value={locale}>{children}</I18nContext.Provider>;
}

export function useT(): T {
  const locale = useContext(I18nContext);
  return useMemo(() => makeT(locale), [locale]);
}
