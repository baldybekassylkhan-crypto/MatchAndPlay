"use client";

import { useT } from "@/components/I18nProvider";
import clsx from "clsx";
import { BadgeCheck, Loader2, MapPin, Smartphone, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { shakeCheckIn, updateOrganizerPosition } from "@/app/actions/checkin";
import { CHECKIN_MAX_ACCURACY_M, CHECKIN_RADIUS_M, createShakeDetector, motionForce } from "@/lib/checkin";

type Phase = "idle" | "waiting" | "sending" | "done";

interface Fix {
  lat: number;
  lng: number;
  accuracy: number;
  at: number;
}

type MotionPermission = { requestPermission?: () => Promise<"granted" | "denied"> };

/**
 * Отметка на игре встряхиванием телефона.
 * Пока экран открыт, GPS уточняет место; после встряхивания база проверяет,
 * что вы в 15 м от точки игры или от организатора.
 */
export function ShakeCheckIn({
  lobbyId,
  isOrganizer,
  checkedIn,
  total,
  initialCount,
}: {
  lobbyId: string;
  isOrganizer: boolean;
  checkedIn: boolean;
  total: number;
  initialCount: number;
}) {
  const t = useT();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>(checkedIn ? "done" : "idle");
  const [error, setError] = useState<string | null>(null);
  const [fix, setFix] = useState<Fix | null>(null);
  const [noSensor, setNoSensor] = useState(false);
  const [count, setCount] = useState(initialCount);
  // Организатор держит отметку открытой, чтобы игроки могли отметиться рядом с ним
  const [hosting, setHosting] = useState(false);
  const fixRef = useRef<Fix | null>(null);
  const sendingRef = useRef(false);

  const tracking = phase === "waiting" || phase === "sending" || hosting;

  // GPS: следим за местом, пока идёт отметка
  useEffect(() => {
    if (!tracking) return;
    if (!navigator.geolocation) {
      setError("Это устройство не умеет определять место.");
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const next = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, at: Date.now() };
        // Берём более точную точку, если прежняя ещё свежая
        const prev = fixRef.current;
        if (!prev || next.accuracy <= prev.accuracy || Date.now() - prev.at > 10_000) {
          fixRef.current = next;
          setFix(next);
        }
      },
      (e) => {
        setError(
          e.code === e.PERMISSION_DENIED
            ? t("Разрешите доступ к геолокации — без неё нельзя проверить, что вы на площадке.")
            : "Не удаётся определить место. Попробуйте выйти на открытое место.",
        );
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [tracking, t]);

  const send = useCallback(async () => {
    if (sendingRef.current) return;
    sendingRef.current = true;
    setPhase("sending");
    setError(null);
    navigator.vibrate?.(80);
    // Ждём точку GPS до 8 секунд
    const deadline = Date.now() + 8000;
    while ((!fixRef.current || fixRef.current.accuracy > CHECKIN_MAX_ACCURACY_M) && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 300));
    }
    const pos = fixRef.current;
    if (!pos) {
      setError("Не удалось определить место. Проверьте, что геолокация включена.");
      setPhase("waiting");
      sendingRef.current = false;
      return;
    }
    const res = await shakeCheckIn(lobbyId, pos);
    sendingRef.current = false;
    if (res.ok) {
      navigator.vibrate?.([60, 40, 60]);
      setPhase("done");
      if (isOrganizer) setHosting(true);
      router.refresh();
    } else {
      setError(res.error);
      if (isOrganizer && res.host) {
        setHosting(true);
        setPhase("idle");
      } else {
        setPhase("waiting");
      }
    }
  }, [lobbyId, isOrganizer, router]);

  // Датчик движения: ждём встряхивания
  useEffect(() => {
    if (phase !== "waiting") return;
    const detector = createShakeDetector();
    let seen = false;
    const onMotion = (e: DeviceMotionEvent) => {
      seen = true;
      if (detector.push(motionForce(e), e.timeStamp || performance.now())) send();
    };
    window.addEventListener("devicemotion", onMotion);
    // Нет событий датчика (компьютер или запрет) — показываем кнопку
    const timer = setTimeout(() => !seen && setNoSensor(true), 1500);
    return () => {
      window.removeEventListener("devicemotion", onMotion);
      clearTimeout(timer);
    };
  }, [phase, send]);

  // Организатор: передаём свою точку и обновляем счётчик
  useEffect(() => {
    if (!hosting) return;
    let active = true;
    let last = count;
    const tick = async () => {
      const pos = fixRef.current;
      if (pos && Date.now() - pos.at < 60_000) {
        const res = await updateOrganizerPosition(lobbyId, pos);
        if (active && res.ok) {
          setCount(res.count);
          if (res.count !== last) router.refresh();
          last = res.count;
        }
      }
    };
    tick();
    const id = setInterval(tick, 15_000);
    return () => {
      active = false;
      clearInterval(id);
    };
    // count нужен только как стартовое значение
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hosting, lobbyId, router]);

  const start = async () => {
    setError(null);
    setNoSensor(false);
    // iOS спрашивает разрешение на датчик движения только по нажатию
    const DME = (typeof DeviceMotionEvent !== "undefined" ? DeviceMotionEvent : null) as unknown as MotionPermission | null;
    if (DME?.requestPermission) {
      try {
        if ((await DME.requestPermission()) !== "granted") setNoSensor(true);
      } catch {
        setNoSensor(true);
      }
    }
    setPhase("waiting");
  };

  const counter = (
    <p className="text-center font-semibold">
      Отметились: {count} из {total}
    </p>
  );

  if (phase === "done") {
    return (
      <section className="space-y-3">
        <p className="flex items-center justify-center gap-2 rounded-2xl bg-accent p-4 font-semibold text-accent-ink">
          <BadgeCheck className="size-5" /> Вы отмечены на игре
        </p>
        <Link href="/rewards" className="block text-center text-sm font-semibold text-accent">
          {t("Игра идёт в зачёт наград от партнёров →")}
        </Link>
        {isOrganizer && (
          <div className="card space-y-1 p-4 text-center">
            {counter}
            <p className="text-sm text-muted">
              Держите экран открытым: игроки рядом с вами (до {CHECKIN_RADIUS_M} м) смогут отметиться, даже если точка на карте неточная.
            </p>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="card space-y-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-bold">{t("Вы на месте?")}</h2>
          <p className="text-sm text-muted">
            Встряхните телефон на площадке. Отметка сработает в {CHECKIN_RADIUS_M} м от точки игры или от организатора.
          </p>
        </div>
        {phase !== "idle" && (
          <button
            type="button"
            onClick={() => setPhase("idle")}
            className="flex size-10 shrink-0 items-center justify-center"
            aria-label={t("Остановить отметку")}
          >
            <X className="size-5" />
          </button>
        )}
      </div>

      {phase === "idle" ? (
        <button type="button" className="btn-primary w-full" onClick={start}>
          <Smartphone className="size-5" /> Отметиться встряхиванием
        </button>
      ) : (
        <div className="flex flex-col items-center gap-3 py-2">
          <span
            className={clsx(
              "flex size-24 items-center justify-center rounded-full bg-accent/15 text-accent",
              phase === "waiting" && "motion-safe:animate-[shake_1.2s_ease-in-out_infinite]",
            )}
            aria-hidden
          >
            {phase === "sending" ? <Loader2 className="size-10 animate-spin" /> : <Smartphone className="size-12" />}
          </span>
          <p className="font-semibold" role="status">
            {phase === "sending" ? t("Проверяем, что вы на площадке…") : t("Встряхните телефон")}
          </p>
          <p className="flex items-center gap-1.5 text-sm text-muted">
            <MapPin className="size-4" aria-hidden />
            {fix ? `Точность GPS ±${Math.round(fix.accuracy)} м` : t("Определяем место…")}
          </p>
          {noSensor && phase === "waiting" && (
            <button type="button" className="btn-secondary w-full" onClick={send}>
              {t("Отметиться без встряхивания")}
            </button>
          )}
        </div>
      )}

      {hosting && counter}
      {error && <p className="text-sm text-danger">{error}</p>}
    </section>
  );
}
