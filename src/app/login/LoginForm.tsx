"use client";

import { Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Reveal } from "@/components/ui/Reveal";
import { Segmented } from "@/components/ui/Segmented";
import { isNativeApp } from "@/lib/native";
import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "signup";

const ERRORS: Record<string, string> = {
  "Invalid login credentials": "Неверный email или пароль",
  "User already registered": "Этот email уже зарегистрирован — войдите",
  "Email not confirmed": "Подтвердите email по ссылке из письма",
};

export function LoginForm({ next, initialError }: { next: string; initialError: string | null }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"form" | "google" | null>(null);
  const [error, setError] = useState<string | null>(initialError);
  const [info, setInfo] = useState<string | null>(null);

  // Google запрещает вход во встроенном окне приложения, поэтому в iOS-версии остаётся вход по email
  const [native, setNative] = useState(false);
  useEffect(() => setNative(isNativeApp()), []);

  // Новый пользователь сначала заполнит профиль, затем вернётся на страницу, с которой пришёл
  const afterAuth = next === "/" ? "/" : `/onboarding?next=${encodeURIComponent(next)}`;
  const callbackUrl = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(afterAuth)}`;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy("form");
    const supabase = createClient();

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(ERRORS[error.message] ?? error.message);
        setBusy(null);
        return;
      }
      router.replace(afterAuth);
      router.refresh();
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: callbackUrl() },
    });
    setBusy(null);
    if (error) {
      setError(ERRORS[error.message] ?? error.message);
      return;
    }
    if (data.session) {
      router.replace(next === "/" ? "/onboarding" : afterAuth);
      router.refresh();
    } else {
      setInfo(`Мы отправили письмо на ${email}. Перейдите по ссылке, чтобы подтвердить аккаунт.`);
    }
  }

  async function onGoogle() {
    setError(null);
    setBusy("google");
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl() },
    });
    if (error) {
      setError("Вход через Google недоступен. Проверьте настройки провайдера в Supabase.");
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <Segmented
        layoutId="auth-mode"
        ariaLabel="Вход или регистрация"
        value={mode}
        onChange={(m) => {
          setMode(m);
          setError(null);
          setInfo(null);
        }}
        options={[
          { value: "login", label: "Вход" },
          { value: "signup", label: "Регистрация" },
        ]}
      />

      <form onSubmit={onSubmit} className="space-y-3">
        <input
          className="input"
          type="email"
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="input"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          placeholder={mode === "login" ? "Пароль" : "Пароль (минимум 6 символов)"}
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <AnimatePresence initial={false}>
          {error && <Reveal key="error" className="text-sm text-danger">{error}</Reveal>}
          {info && (
            <Reveal key="info" className="rounded-2xl bg-surface-2 p-3 text-sm">
              {info}
            </Reveal>
          )}
        </AnimatePresence>
        <button className="btn-primary w-full overflow-hidden" disabled={busy !== null}>
          {busy === "form" && <Loader2 className="size-4 animate-spin" />}
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={mode}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              {mode === "login" ? "Войти" : "Создать аккаунт"}
            </motion.span>
          </AnimatePresence>
        </button>
      </form>

      {!native && (
        <>
          <div className="flex items-center gap-3 text-xs text-muted">
            <div className="h-px flex-1 bg-line" />
            или
            <div className="h-px flex-1 bg-line" />
          </div>

          <button type="button" onClick={onGoogle} className="btn-secondary w-full" disabled={busy !== null}>
            {busy === "google" ? <Loader2 className="size-4 animate-spin" /> : <GoogleMark />}
            Продолжить с Google
          </button>
        </>
      )}

      <p className="text-center text-xs text-muted">
        Продолжая, вы принимаете{" "}
        <Link href="/privacy" className="underline">
          политику конфиденциальности
        </Link>
      </p>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2-1.9 3.3-4.7 3.3-8Z" />
      <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.3V7H2.1a11 11 0 0 0 0 9.9l3.7-2.8Z" />
      <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4Z" />
    </svg>
  );
}
