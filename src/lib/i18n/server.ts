import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { LOCALE_COOKIE, isLocale, makeT, type Locale } from "@/lib/i18n/core";

export const getLocale = cache(async (): Promise<Locale> => {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : "ru";
});

export async function getT() {
  return makeT(await getLocale());
}
