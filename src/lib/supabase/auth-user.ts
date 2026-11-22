import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * id текущего пользователя из проверенного JWT.
 *
 * getClaims() проверяет подпись токена прямо на сервере (асимметричные ключи Supabase,
 * открытые ключи кэшируются), без запроса к Supabase Auth — это экономит ~0,3 с
 * на каждой странице и каждом действии. Если у проекта старые симметричные ключи,
 * getClaims сам откатится на проверку через Auth-сервер — безопасно в любом случае.
 * Просроченный токен при этом обновляется, а новые cookies записываются.
 */
export async function getAuthUserId(supabase: SupabaseClient): Promise<string | null> {
  const { data, error } = await supabase.auth.getClaims();
  if (error) return null;
  const sub = data?.claims?.sub;
  return typeof sub === "string" && sub.length > 0 ? sub : null;
}
