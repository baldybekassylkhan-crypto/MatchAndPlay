"use client";

import { BadgeCheck, Camera, Loader2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { submitCheckin } from "@/app/actions/checkin";
import { codeFromQr } from "@/lib/checkin";

export function PlayerCheckIn({
  lobbyId,
  checkedIn,
  initialCode,
}: {
  lobbyId: string;
  checkedIn: boolean;
  initialCode: string | null;
}) {
  const [done, setDone] = useState(checkedIn);
  const [scanning, setScanning] = useState(false);
  const [code, setCode] = useState(initialCode ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = useCallback(
    (value: string) =>
      startTransition(async () => {
        setError(null);
        const res = await submitCheckin(lobbyId, value);
        if (res.ok) setDone(true);
        else setError(res.error ?? "Ошибка");
      }),
    [lobbyId],
  );

  const onScanned = useCallback(
    (value: string) => {
      setScanning(false);
      setCode(value);
      submit(value);
    },
    [submit],
  );

  if (done) {
    return (
      <p className="flex items-center justify-center gap-2 rounded-2xl bg-accent p-4 font-semibold text-accent-ink">
        <BadgeCheck className="size-5" /> Вы отмечены на игре
      </p>
    );
  }

  return (
    <section className="space-y-3 card p-4">
      <div>
        <h2 className="font-bold">Вы на месте?</h2>
        <p className="text-sm text-muted">Отсканируйте QR у организатора или введите код с его экрана.</p>
      </div>

      {scanning ? (
        <Scanner lobbyId={lobbyId} onCode={onScanned} onClose={() => setScanning(false)} onError={setError} />
      ) : (
        <button type="button" className="btn-primary w-full" disabled={pending} onClick={() => { setError(null); setScanning(true); }}>
          <Camera className="size-5" /> Сканировать QR
        </button>
      )}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (code.length === 6) submit(code);
        }}
      >
        <input
          className="input min-w-0 flex-1 text-center tracking-[0.2em] tabular-nums"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="000000"
          aria-label="Код отметки"
        />
        <button className="btn-secondary shrink-0 px-5" disabled={pending || code.length !== 6}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : "Отметиться"}
        </button>
      </form>

      {error && <p className="text-sm text-danger">{error}</p>}
    </section>
  );
}

function Scanner({
  lobbyId,
  onCode,
  onClose,
  onError,
}: {
  lobbyId: string;
  onCode: (code: string) => void;
  onClose: () => void;
  onError: (message: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [starting, setStarting] = useState(true);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout>;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("unsupported");
        const [{ default: jsQR }, media] = await Promise.all([
          import("jsqr"),
          navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false }),
        ]);
        stream = media;
        if (!active) {
          media.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current;
        if (!video || !ctx) return;
        video.srcObject = media;
        await video.play();
        setStarting(false);

        const scan = () => {
          if (!active) return;
          if (video.videoWidth > 0) {
            const scale = Math.min(1, 720 / Math.max(video.videoWidth, video.videoHeight));
            canvas.width = Math.round(video.videoWidth * scale);
            canvas.height = Math.round(video.videoHeight * scale);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const found = jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" });
            if (found?.data) {
              const code = codeFromQr(found.data, lobbyId);
              if (code) {
                onCode(code);
                return;
              }
              setHint("Это QR другой игры");
            }
          }
          timer = setTimeout(scan, 200);
        };
        scan();
      } catch {
        if (!active) return;
        onError("Нет доступа к камере. Разрешите её в настройках или введите код вручную.");
        onClose();
      }
    })();

    return () => {
      active = false;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [lobbyId, onCode, onClose, onError]);

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-black">
      <video ref={videoRef} className="size-full object-cover" playsInline muted aria-label="Камера для сканирования QR" />
      <div className="pointer-events-none absolute inset-[14%] rounded-2xl border-2 border-white/80" aria-hidden />
      {starting && <Loader2 className="absolute top-1/2 left-1/2 size-6 -translate-1/2 animate-spin text-white" />}
      {hint && <p className="absolute inset-x-3 bottom-3 rounded-xl bg-black/70 px-3 py-2 text-center text-sm text-white">{hint}</p>}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-2 right-2 flex size-10 items-center justify-center rounded-full bg-black/60 text-white"
        aria-label="Закрыть камеру"
      >
        <X className="size-5" />
      </button>
    </div>
  );
}
