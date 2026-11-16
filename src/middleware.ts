import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Всё, кроме статики, иконок, манифеста и service worker
    "/((?!_next/static|_next/image|favicon.ico|icons/|apple-icon|manifest.webmanifest|robots.txt|sw.js|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)",
  ],
};
