"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type UsernameStatus = "idle" | "invalid" | "checking" | "free" | "taken";

export const USERNAME_RE = /^[a-z0-9_.]{3,20}$/;

/** Проверяет ник на занятость с задержкой 400 мс после ввода. */
export function useUsernameCheck(username: string, ownUsername?: string | null): UsernameStatus {
  const [status, setStatus] = useState<UsernameStatus>("idle");

  useEffect(() => {
    if (!username) {
      setStatus("idle");
      return;
    }
    if (!USERNAME_RE.test(username)) {
      setStatus("invalid");
      return;
    }
    if (ownUsername && username === ownUsername) {
      setStatus("free");
      return;
    }
    setStatus("checking");
    let cancelled = false;
    const t = setTimeout(async () => {
      const { count, error } = await createClient()
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("username", username);
      if (cancelled) return;
      // При ошибке сети не блокируем — сервер всё равно проверит уникальность
      setStatus(error ? "idle" : (count ?? 0) > 0 ? "taken" : "free");
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [username, ownUsername]);

  return status;
}
