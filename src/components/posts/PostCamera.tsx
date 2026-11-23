"use client";

import clsx from "clsx";
import { Camera, ChevronUp, Images, Loader2, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type TouchEvent } from "react";
import { createPortal } from "react-dom";

/** На сколько пикселей нужно потянуть вверх, чтобы открылась галерея. */
const SWIPE_DISTANCE = 72;
const MAX_PULL = 200;

type Facing = "environment" | "user";
type Status = "loading" | "ready" | "blocked";

const subscribeNothing = () => () => {};

/** Полноэкранная камера для поста. Свайп вверх открывает фото с телефона. */
export function PostCamera({
  busy,
  error,
  onCapture,
  onGallery,
  onClose,
}: {
  busy: string | null;
  error: string | null;
  onCapture: (file: File) => void;
  onGallery: () => void;
  onClose: () => void;
}) {
  const mounted = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [facing, setFacing] = useState<Facing>("environment");
  const [status, setStatus] = useState<Status>("loading");
  const [flash, setFlash] = useState(0);
  const [pull, setPull] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<number | null>(null);
  const pullRef = useRef(0);

  // Камера работает, только пока экран виден: так она не держит батарею и индикатор iOS
  useEffect(() => {
    let run = 0;
    let stream: MediaStream | null = null;
    const stop = () => {
      run += 1;
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };
    const start = async () => {
      stop();
      const current = run;
      setStatus("loading");
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("unsupported");
        const next = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1920 } },
          audio: false,
        });
        if (current !== run) {
          next.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = next;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = next;
        await video.play();
        if (current === run) setStatus("ready");
      } catch {
        if (current === run) setStatus("blocked");
      }
    };
    const onVisibility = () => (document.hidden ? stop() : start());

    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
    };
  }, [facing]);

  // Страница под камерой не прокручивается
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const shoot = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || busy) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Фронтальная камера показана зеркально, и снимок совпадает с тем, что видно на экране
    if (facing === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0);
    setFlash((n) => n + 1);
    canvas.toBlob(
      (blob) => blob && onCapture(new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" })),
      "image/jpeg",
      0.92,
    );
  }, [busy, facing, onCapture]);

  const onTouchStart = (e: TouchEvent) => {
    if ((e.target as HTMLElement).closest("button") || busy) return;
    dragStart.current = e.touches[0].clientY;
    setDragging(true);
  };
  const onTouchMove = (e: TouchEvent) => {
    if (dragStart.current === null) return;
    pullRef.current = Math.min(MAX_PULL, Math.max(0, dragStart.current - e.touches[0].clientY));
    setPull(pullRef.current);
  };
  const onTouchEnd = () => {
    if (dragStart.current === null) return;
    const open = pullRef.current >= SWIPE_DISTANCE;
    dragStart.current = null;
    pullRef.current = 0;
    setDragging(false);
    setPull(0);
    // Выбор файла iOS разрешает только прямо внутри жеста
    if (open) onGallery();
  };

  if (!mounted) return <div className="fixed inset-0 z-[80] bg-black" />;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Камера"
      className="fixed inset-0 z-[80] touch-none overflow-hidden bg-black text-white select-none"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      <video
        ref={videoRef}
        muted
        playsInline
        autoPlay
        aria-hidden
        className={clsx(
          "absolute inset-0 size-full object-cover transition-opacity duration-300",
          status === "ready" ? "opacity-100" : "opacity-0",
          facing === "user" && "-scale-x-100",
        )}
      />
      {flash > 0 && <span key={flash} className="camera-flash pointer-events-none absolute inset-0 bg-white" aria-hidden />}

      {status === "loading" && (
        <span className="absolute inset-0 flex items-center justify-center" role="status" aria-label="Запускаем камеру">
          <Loader2 className="size-7 animate-spin text-white/70" />
        </span>
      )}
      {status === "blocked" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-10 text-center">
          <Camera className="size-9 text-white/60" aria-hidden />
          <p className="text-[20px] font-semibold">Нет доступа к камере</p>
          <p className="text-[15px] text-white/65">Разрешите камеру для Match&amp;Play в Настройках iPhone или выберите готовое фото.</p>
          <button type="button" onClick={onGallery} className="mt-2 h-11 rounded-full bg-white px-5 text-[15px] font-semibold text-black active:opacity-60">
            Открыть фото
          </button>
        </div>
      )}

      <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <button type="button" onClick={onClose} aria-label="Закрыть камеру" className="camera-button">
          <X className="size-6" />
        </button>
      </div>

      {(busy || error) && (
        <p role="status" className="absolute inset-x-6 top-[calc(4.5rem+env(safe-area-inset-top))] mx-auto flex w-fit items-center gap-2 rounded-2xl bg-black/70 px-4 py-2.5 text-center text-[15px]">
          {busy && <Loader2 className="size-4 shrink-0 animate-spin" />}
          {busy ?? error}
        </p>
      )}

      <div
        className={clsx("absolute inset-x-0 bottom-0 pb-[calc(0.75rem+env(safe-area-inset-bottom))]", !dragging && "transition-transform duration-300 ease-out-soft")}
        style={{ transform: `translateY(${-pull * 0.35}px)`, opacity: 1 - pull / (MAX_PULL * 1.4) }}
      >
        <div className="grid grid-cols-3 items-center px-8">
          <button type="button" onClick={onGallery} aria-label="Выбрать фото или видео" className="camera-button justify-self-start">
            <Images className="size-6" />
          </button>
          <button
            type="button"
            onClick={shoot}
            disabled={status !== "ready" || busy !== null}
            aria-label="Сделать снимок"
            className="flex size-[78px] items-center justify-center justify-self-center rounded-full border-[4px] border-white transition-transform active:scale-90 disabled:opacity-40"
          >
            <span className="size-[62px] rounded-full bg-white" />
          </button>
          <button
            type="button"
            onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
            aria-label="Сменить камеру"
            className="camera-button justify-self-end"
          >
            <RefreshCw className="size-6" />
          </button>
        </div>
        <span className="mt-3 flex flex-col items-center text-[13px] font-medium text-white/80">
          <ChevronUp className="size-4" aria-hidden />
          Смахните вверх, чтобы выбрать фото
        </span>
      </div>

      <div
        aria-hidden
        className={clsx(
          "absolute inset-x-0 bottom-0 flex h-[220px] flex-col items-center gap-2 rounded-t-3xl bg-[#1c1c1e] pt-6",
          !dragging && "transition-transform duration-300 ease-out-soft",
        )}
        style={{ transform: `translateY(${220 - pull}px)` }}
      >
        <Images className="size-7" />
        <span className="text-[15px] font-semibold">{pull >= SWIPE_DISTANCE ? "Отпустите, чтобы открыть фото" : "Тяните вверх"}</span>
      </div>
    </div>,
    document.body,
  );
}
