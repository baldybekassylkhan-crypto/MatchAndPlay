"use client";

import { useEffect } from "react";
import { markAllRead } from "@/app/actions/notifications";

/** Открыли список — отмечаем всё прочитанным (после показа, чтобы новые успели подсветиться). */
export function MarkRead({ hasUnread }: { hasUnread: boolean }) {
  useEffect(() => {
    if (!hasUnread) return;
    const t = setTimeout(() => void markAllRead(), 1500);
    return () => clearTimeout(t);
  }, [hasUnread]);
  return null;
}
