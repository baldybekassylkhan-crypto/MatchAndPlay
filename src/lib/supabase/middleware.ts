import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigured } from "@/lib/env";
import { getAuthUserId } from "@/lib/supabase/auth-user";

// /api/push вызывает база данных — он защищён собственным секретом, а не сессией.
const PUBLIC_PATHS = ["/login", "/auth", "/offline", "/api/push", "/g", "/privacy"];

function isPublic(path: string) {
  return PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}

export async function updateSession(request: NextRequest) {
  // Без ключей Supabase показываем экран настройки, а не падаем.
  if (!supabaseConfigured) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Проверка подписи JWT на месте, без запроса к Supabase Auth (раньше ~0,3 с на каждую страницу)
  const userId = await getAuthUserId(supabase);
  const user = userId ? { id: userId } : null;

  const path = request.nextUrl.pathname;

  const redirectTo = (pathname: string, next?: string) => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    url.search = next ? `?next=${encodeURIComponent(next)}` : "";
    const res = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  };

  if (!user && !isPublic(path)) return redirectTo("/login", path === "/" ? undefined : path);
  if (user && path === "/login") return redirectTo("/");

  return response;
}
