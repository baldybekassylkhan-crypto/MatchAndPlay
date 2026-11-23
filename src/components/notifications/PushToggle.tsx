"use client";

import { BellOff, BellRing, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { removePushSubscription, savePushSubscription } from "@/app/actions/notifications";
import { isNativeApp } from "@/lib/native";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

type State = "loading" | "native" | "unsupported" | "ios-install" | "no-sw" | "denied" | "off" | "on";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function getRegistration() {
  // В режиме разработки service worker не регистрируется
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ?? null;
}

export function PushToggle() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (isNativeApp()) {
        setState("native");
        return;
      }
      const isIos =/iphone|ipad|ipod/i.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setState(isIos && !standalone ? "ios-install" : "unsupported");
        return;
      }
      if (!VAPID_PUBLIC_KEY) {
        setState("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setState("denied");
        return;
      }
      const reg = await getRegistration();
      if (!reg) {
        setState("no-sw");
        return;
      }
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  async function enable() {
    setBusy(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await getRegistration();
      if (!reg) {
        setState("no-sw");
        return;
      }
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        }));
      const res = await savePushSubscription(sub.toJSON(), navigator.userAgent);
      if (!res.ok) throw new Error("save");
      setState("on");
    } catch {
      setError("Не удалось включить уведомления. Попробуйте ещё раз.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading") return null;

  const hint: Partial<Record<State, string>> = {
    native: "В этой версии приложения push-уведомления недоступны. Новые уведомления появляются здесь, когда приложение открыто.",
    unsupported: "Этот браузер не поддерживает push-уведомления. Уведомления будут видны здесь, в приложении.",
    "ios-install": "На iPhone push работают, если добавить Match&Play на экран «Домой»: «Поделиться» → «На экран „Домой“».",
    "no-sw": "Push-уведомления работают в установленной (production) версии приложения.",
    denied: "Уведомления запрещены в настройках браузера. Разрешите их для этого сайта, чтобы получать push.",
  };

  if (hint[state]) {
    return (
      <div className="mx-4 mt-4 flex items-start gap-3 rounded-2xl bg-surface-2 p-4 text-sm text-muted">
        <BellOff className="mt-0.5 size-5 shrink-0" />
        <p>{hint[state]}</p>
      </div>
    );
  }

  return (
    <div className="mx-4 mt-4 rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center gap-3">
        <BellRing className="size-6 shrink-0" />
        <div className="flex-1">
          <p className="font-semibold">Push-уведомления</p>
          <p className="text-sm text-muted">
            {state === "on" ? "Включены на этом устройстве" : "Заявки, решения организатора и напоминания перед игрой"}
          </p>
        </div>
        <button
          type="button"
          onClick={state === "on" ? disable : enable}
          disabled={busy}
          className={state === "on" ? "btn-secondary h-10 px-4 text-sm" : "btn-primary h-10 px-4 text-sm"}
        >
          {busy && <Loader2 className="size-4 animate-spin" />}
          {state === "on" ? "Выключить" : "Включить"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
