import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { City, Profile } from "@/lib/types";

/** Текущий пользователь (один запрос на рендер). */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/** Профиль текущего пользователя или null, если онбординг не пройден. */
export const getMyProfile = cache(async (): Promise<Profile | null> => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return (data as Profile | null) ?? null;
});

export const getCities = cache(async (): Promise<City[]> => {
  const supabase = await createClient();
  const { data } = await supabase.from("cities").select("*").order("sort_order");
  return (data as City[] | null) ?? [];
});
