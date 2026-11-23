"use client";

import clsx from "clsx";
import { Film, ImagePlus, Loader2, Trophy, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { createPost, discardUploads } from "@/app/actions/posts";
import { compressImage, imageExt } from "@/lib/image";
import { MAX_IMAGE_BYTES, MAX_IMAGE_SIDE, MAX_POST_IMAGES, MAX_VIDEO_BYTES, MAX_VIDEO_SECONDS, POSTS_BUCKET } from "@/lib/media";
import { SportGrid } from "@/components/ui/SportGrid";
import { SPORTS, type SportId } from "@/lib/sports";
import { createClient } from "@/lib/supabase/client";
import { formatDayTime } from "@/lib/time";
import type { LobbyWithMeta, PostMedia } from "@/lib/types";

interface Draft {
  key: string;
  preview: string;
  type: "image" | "video";
  blob: Blob;
  w: number;
  h: number;
  duration?: number;
}

function videoMeta(file: File) {
  return new Promise<{ w: number; h: number; duration: number }>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      resolve({ w: v.videoWidth || 720, h: v.videoHeight || 1280, duration: v.duration });
      URL.revokeObjectURL(url);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Не удалось прочитать видео"));
    };
    v.src = url;
  });
}

export function PostComposer({
  userId,
  games,
  defaultSport,
  defaultLobbyId,
}: {
  userId: string;
  games: LobbyWithMeta[];
  defaultSport?: SportId;
  defaultLobbyId?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [caption, setCaption] = useState("");
  const [lobbyId, setLobbyId] = useState<string | null>(
    defaultLobbyId && games.some((g) => g.id === defaultLobbyId) ? defaultLobbyId : null,
  );
  const [sport, setSport] = useState<SportId | null>(
    games.find((g) => g.id === defaultLobbyId)?.sport ?? defaultSport ?? null,
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasVideo = drafts.some((d) => d.type === "video");

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    setBusy("Обрабатываем файлы…");
    try {
      const picked = Array.from(files);
      const videos = picked.filter((f) => f.type.startsWith("video/"));
      const images = picked.filter((f) => f.type.startsWith("image/"));

      if (videos.length) {
        if (videos.length > 1 || images.length || drafts.length) {
          throw new Error("Видео публикуется отдельно: одно видео без фото");
        }
        const file = videos[0];
        if (file.size > MAX_VIDEO_BYTES) throw new Error("Видео больше 20 МБ — обрежьте или сожмите его");
        const meta = await videoMeta(file);
        if (meta.duration > MAX_VIDEO_SECONDS + 0.5) throw new Error(`Видео длиннее ${MAX_VIDEO_SECONDS} секунд`);
        setDrafts([{ key: crypto.randomUUID(), preview: URL.createObjectURL(file), type: "video", blob: file, ...meta }]);
        return;
      }

      if (hasVideo) throw new Error("К видео нельзя добавить фото");
      if (drafts.length + images.length > MAX_POST_IMAGES) throw new Error(`Не больше ${MAX_POST_IMAGES} фото в одном посте`);

      const next: Draft[] = [];
      for (const file of images) {
        const blob = await compressImage(file, { maxSide: MAX_IMAGE_SIDE, maxBytes: MAX_IMAGE_BYTES });
        const bmp = await createImageBitmap(blob);
        next.push({ key: crypto.randomUUID(), preview: URL.createObjectURL(blob), type: "image", blob, w: bmp.width, h: bmp.height });
        bmp.close();
      }
      setDrafts((d) => [...d, ...next]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось добавить файл");
    } finally {
      setBusy(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function remove(key: string) {
    setDrafts((d) => {
      const item = d.find((x) => x.key === key);
      if (item) URL.revokeObjectURL(item.preview);
      return d.filter((x) => x.key !== key);
    });
  }

  async function publish() {
    if (!drafts.length) {
      setError("Добавьте фото или видео");
      return;
    }
    setError(null);
    const supabase = createClient();
    const uploaded: string[] = [];
    try {
      const media: PostMedia[] = [];
      for (const [i, d] of drafts.entries()) {
        setBusy(`Загружаем ${i + 1} из ${drafts.length}…`);
        const ext = d.type === "image" ? imageExt(d.blob) : (d.blob.type.split("/")[1] ?? "mp4").replace("quicktime", "mov");
        const path = `${userId}/${Date.now()}-${i}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from(POSTS_BUCKET)
          .upload(path, d.blob, { contentType: d.blob.type || (d.type === "image" ? "image/jpeg" : "video/mp4"), cacheControl: "31536000" });
        if (upErr) throw new Error("Не удалось загрузить файл. Проверьте интернет.");
        uploaded.push(path);
        media.push({ type: d.type, path, w: d.w, h: d.h, ...(d.duration ? { duration: Math.round(d.duration * 10) / 10 } : {}) });
      }

      setBusy("Публикуем…");
      const res = await createPost({ caption, sport, lobby_id: lobbyId, media });
      if (!res.ok) {
        await discardUploads(uploaded);
        setError(res.error);
        return;
      }
      drafts.forEach((d) => URL.revokeObjectURL(d.preview));
      router.push(`/p/${res.id}`);
    } catch (e) {
      if (uploaded.length) await discardUploads(uploaded);
      setError(e instanceof Error ? e.message : "Не удалось опубликовать пост");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        {drafts.length === 0 ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex aspect-[4/5] w-full flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-line bg-surface text-muted"
            disabled={busy !== null}
          >
            {busy ? <Loader2 className="size-8 animate-spin" /> : <ImagePlus className="size-10" />}
            <span className="font-semibold text-ink">{busy ?? "Добавить фото или видео"}</span>
            <span className="text-sm">До {MAX_POST_IMAGES} фото или одно видео до {MAX_VIDEO_SECONDS} секунд</span>
          </button>
        ) : (
          <div className="flex snap-x gap-2 overflow-x-auto pb-1">
            {drafts.map((d) => (
              <div key={d.key} className="relative aspect-[4/5] w-48 shrink-0 snap-start overflow-hidden rounded-2xl bg-surface-2">
                {d.type === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element -- локальный предпросмотр
                  <img src={d.preview} alt="" className="size-full object-cover" />
                ) : (
                  <video src={d.preview} className="size-full object-cover" muted playsInline loop autoPlay />
                )}
                <button
                  type="button"
                  onClick={() => remove(d.key)}
                  className="absolute top-1.5 right-1.5 flex size-10 items-center justify-center rounded-full bg-black/60 text-white"
                  aria-label="Убрать"
                  disabled={busy !== null}
                >
                  <X className="size-4" />
                </button>
                {d.type === "video" && (
                  <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">
                    <Film className="size-3" /> {Math.round(d.duration ?? 0)} с
                  </span>
                )}
              </div>
            ))}
            {!hasVideo && drafts.length < MAX_POST_IMAGES && (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex aspect-[4/5] w-32 shrink-0 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-line text-muted"
                disabled={busy !== null}
              >
                <ImagePlus className="size-6" />
                <span className="text-sm">Ещё</span>
              </button>
            )}
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/mp4,video/webm,video/quicktime"
          multiple
          hidden
          onChange={(e) => onFiles(e.target.files)}
        />
      </div>

      <div>
        <label className="label" htmlFor="caption">
          Подпись
        </label>
        <textarea
          id="caption"
          className="input h-28 resize-none py-3"
          maxLength={1000}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Как прошла игра? Отметьте лучший момент"
        />
      </div>

      {games.length > 0 && (
        <div>
          <span className="label">
            <Trophy className="mr-1 inline size-3.5" />
            Хайлайт с игры <span className="font-normal">(необязательно)</span>
          </span>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setLobbyId(null)}
              className={clsx("chip justify-start", lobbyId === null && "chip-active")}
            >
              Просто пост, без игры
            </button>
            {games.slice(0, 8).map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => {
                  setLobbyId(g.id);
                  setSport(g.sport);
                }}
                className={clsx("chip justify-start text-left", lobbyId === g.id && "chip-active")}
              >
                {SPORTS[g.sport]?.label} · {formatDayTime(g.start_time)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <span className="label">Вид спорта</span>
        <SportGrid selected={sport ? [sport] : []} onToggle={(id) => setSport(sport === id ? null : id)} ariaLabel="Вид спорта" />
      </div>

      {error && <p className="rounded-2xl bg-danger/10 p-3 text-sm text-danger">{error}</p>}

      <button type="button" onClick={publish} className="btn-primary w-full" disabled={busy !== null || drafts.length === 0}>
        {busy && <Loader2 className="size-4 animate-spin" />}
        {busy ?? "Опубликовать"}
      </button>
    </div>
  );
}
