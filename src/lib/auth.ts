import { createClient as createPlainClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";
import { getAuthUserId } from "@/lib/supabase/auth-user";
import { createClient } from "@/lib/supabase/server";
import type { City, Profile } from "@/lib/types";

/** Текущий пользователь (один раз на рендер, без сетевого запроса — см. getAuthUserId). */
export const getUser = cache(async (): Promise<{ id: string } | null> => {
  const supabase = await createClient();
  const id = await getAuthUserId(supabase);
  return id ? { id } : null;
});

/** Профиль текущего пользователя или null, если онбординг не пройден. */
export const getMyProfile = cache(async (): Promise<Profile | null> => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return (data as Profile | null) ?? null;
});

/**
 * Список городов почти никогда не меняется — кэшируем на сервере на сутки
 * для всех пользователей, вместо запроса к базе при каждом открытии страницы.
 * Города публичны, поэтому читаем без cookies пользователя.
 */
const loadCities = unstable_cache(
  async (): Promise<City[]> => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return [];
    const supabase = createPlainClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const { data, error } = await supabase.from("cities").select("*").order("sort_order");
    if (error) throw error; // ошибку не кэшируем
    return (data as City[] | null) ?? [];
  },
  ["cities-v1"],
  { revalidate: 86_400, tags: ["cities"] },
);

export const getCities = cache(async (): Promise<City[]> => {
  try {
    return await loadCities();
  } catch {
    return [];
  }
});
