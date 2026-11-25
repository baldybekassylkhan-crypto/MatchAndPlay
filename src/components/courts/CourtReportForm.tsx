"use client";

import { useT } from "@/components/I18nProvider";
import clsx from "clsx";
import { Camera, Check, Loader2, X } from "lucide-react";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { reportCourtIssue } from "@/app/actions/courts";
import { COURT_ISSUES, type CourtIssue } from "@/lib/courts";
import { compressImage, imageExt } from "@/lib/image";
import { POSTS_BUCKET } from "@/lib/media";
import { createClient } from "@/lib/supabase/client";

export function CourtReportForm({
  userId,
  venue,
  issues,
}: {
  userId: string;
  venue: { id: string; name: string; lat: number; lng: number; cityId: number };
  issues: CourtIssue[];
}) {
  const t = useT();
  const [kind, setKind] = useState<CourtIssue | null>(null);
  const [comment, setComment] = useState("");
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<null | { existing: boolean }>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const blob = await compressImage(file, { maxSide: 1080, maxBytes: 600 * 1024 });
      setPhoto({ blob, url: URL.createObjectURL(blob) });
    } catch {
      setError("Не удалось прочитать фото");
    }
  };

  const submit = () =>
    start(async () => {
      if (!kind) return;
      setError(null);
      let photoPath: string | null = null;
      if (photo) {
        const path = `${userId}/court-${Date.now()}.${imageExt(photo.blob)}`;
        const { error: upErr } = await createClient()
          .storage.from(POSTS_BUCKET)
          .upload(path, photo.blob, { contentType: photo.blob.type || "image/jpeg", cacheControl: "31536000" });
        if (upErr) {
          setError("Не удалось загрузить фото. Проверьте интернет.");
          return;
        }
        photoPath = path;
      }
      const res = await reportCourtIssue({
        venueId: venue.id, cityId: venue.cityId, venueName: venue.name, lat: venue.lat, lng: venue.lng, kind, comment, photoPath,
      });
      if (res.ok) setDone({ existing: res.existing });
      else setError(res.error);
    });

  if (done) {
    return (
      <section className="card space-y-3 p-5 text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-accent text-accent-ink">
          <Check className="size-7" />
        </span>
        <h2 className="text-lg font-bold">{done.existing ? t("Ваш голос учтён") : t("Спасибо! Обращение принято")}</h2>
        <p className="text-sm text-muted">
          {done.existing
            ? t("Об этой проблеме уже сообщили — чем больше голосов, тем выше она в списке для акимата.")
            : t("Мы соберём обращения жителей и передадим их в акимат. Когда статус изменится, придёт уведомление.")}
        </p>
        <Link href="/courts" className="btn-primary w-full">
          {t("Все обращения города")}
        </Link>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <span className="label">{t("Что случилось?")}</span>
        <div className="flex flex-wrap gap-2">
          {issues.map((k) => (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={clsx("chip", kind === k && "chip-active")}>
              {t(COURT_ISSUES[k].label)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label" htmlFor="comment">
          Подробности <span className="font-normal">{t("(необязательно)")}</span>
        </label>
        <textarea
          id="comment"
          className="input h-24 resize-none py-3"
          maxLength={300}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={t("Например: кольцо на левом щите оторвано, торчат болты")}
        />
      </div>

      <div>
        <span className="label">
          Фото <span className="font-normal">{t("(помогает акимату быстрее найти проблему)")}</span>
        </span>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        {photo ? (
          <div className="relative w-40 overflow-hidden rounded-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element -- превью до загрузки */}
            <img src={photo.url} alt={t("Фото проблемы")} className="aspect-[4/5] w-full object-cover" />
            <button
              type="button"
              onClick={() => setPhoto(null)}
              className="absolute top-1.5 right-1.5 flex size-8 items-center justify-center rounded-full bg-black/60 text-white"
              aria-label={t("Убрать фото")}
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()}>
            <Camera className="size-5" /> Добавить фото
          </button>
        )}
      </div>

      {error && <p className="rounded-2xl bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      <button type="button" className="btn-primary w-full" disabled={!kind || pending} onClick={submit}>
        {pending && <Loader2 className="size-4 animate-spin" />} Отправить обращение
      </button>
    </div>
  );
}
