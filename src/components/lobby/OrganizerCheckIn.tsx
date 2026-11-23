"use client";

import { Loader2, QrCode, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getCheckinCode } from "@/app/actions/checkin";

export function OrganizerCheckIn({ lobbyId, total }: { lobbyId: string; total: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastCount = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      let delay = 5000;
      try {
        const res = await getCheckinCode(lobbyId);
        if (!active) return;
        if (!res.ok) {
          setError(res.error);
        } else {
          setError(null);
          setCode(res.code);
          setCount(res.count);
          if (lastCount.current !== null && lastCount.current !== res.count) router.refresh();
          lastCount.current = res.count;
          const { toDataURL } = await import("qrcode");
          const image = await toDataURL(`${window.location.origin}/lobby/${lobbyId}?checkin=${res.code}`, {
            width: 560,
            margin: 2,
            errorCorrectionLevel: "M",
            color: { dark: "#000000", light: "#ffffff" },
          });
          if (!active) return;
          setQr(image);
          // Обновляем чаще смены кода, чтобы счётчик пришедших тоже был свежим
          delay = Math.min(5000, Math.max(1000, new Date(res.expiresAt).getTime() - Date.now() + 200));
        }
      } catch {
        if (active) setError("Нет соединения. Пробуем снова…");
      }
      if (active) timer = setTimeout(tick, delay);
    };

    tick();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [open, lobbyId, router]);

  if (!open) {
    return (
      <button type="button" className="btn-primary w-full" onClick={() => setOpen(true)}>
        <QrCode className="size-5" /> Показать QR для отметки
      </button>
    );
  }

  return (
    <section className="animate-fade-up space-y-3 card p-4 text-center">
      <div className="flex items-center justify-between">
        <h2 className="font-bold">Отметка на игре</h2>
        <button type="button" onClick={() => setOpen(false)} className="flex size-10 items-center justify-center" aria-label="Скрыть QR">
          <X className="size-5" />
        </button>
      </div>
      <div className="mx-auto flex aspect-square w-full max-w-72 items-center justify-center overflow-hidden rounded-2xl bg-white">
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element -- картинка создаётся на устройстве
          <img src={qr} alt="QR-код для отметки на игре" className="size-full" />
        ) : (
          <Loader2 className="size-6 animate-spin text-black" />
        )}
      </div>
      {code && (
        <p className="text-3xl font-extrabold tracking-[0.2em] tabular-nums" aria-label={`Код ${code.split("").join(" ")}`}>
          {code}
        </p>
      )}
      <p className="text-sm text-muted">Код меняется каждые 30 секунд, поэтому скриншот не поможет отметиться издалека.</p>
      {count !== null && (
        <p className="font-semibold">
          Пришли: {count} из {total}
        </p>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
    </section>
  );
}
