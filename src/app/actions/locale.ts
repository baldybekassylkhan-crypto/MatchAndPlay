"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, isLocale, type Locale } from "@/lib/i18n/core";
import { getAuthUserId } from "@/lib/supabase/auth-user";
import { createClient } from "@/lib/supabase/server";

/** Меняет язык: cookie (работает и до входа) + профиль (чтобы язык сохранялся на других устройствах). */
export async function setLocale(locale: Locale) {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  const supabase = await createClient();
  const uid = await getAuthUserId(supabase);
  if (uid) await supabase.from("profiles").update({ locale }).eq("id", uid);
  revalidatePath("/", "layout");
}
