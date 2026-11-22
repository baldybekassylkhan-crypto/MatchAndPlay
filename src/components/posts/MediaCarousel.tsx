"use client";

import clsx from "clsx";
import { Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { mediaUrl } from "@/lib/media";
import type { PostMedia } from "@/lib/types";

/** Фото листаются свайпом (scroll-snap), видео играет без звука, когда видно на экране. */
export function MediaCarousel({ media, onDoubleTap }: { media: PostMedia[]; onDoubleTap?: () => void }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const lastTap = useRef(0);
  const first = media[0];
  const ratio = Math.min(Math.max(first.w / first.h, 4 / 5), 1.91);

  const onScroll = () => {
    const el = scroller.current;
    if (el) setIndex(Math.round(el.scrollLeft / el.clientWidth));
  };

  const onTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) onDoubleTap?.();
    lastTap.current = now;
  };

  return (
    <div className="relative bg-surface-2" style={{ aspectRatio: ratio }}>
      <div
        ref={scroller}
        onScroll={onScroll}
        onClick={onTap}
        className="flex size-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {media.map((m, i) => (
          <div key={m.path} className="size-full shrink-0 snap-center">
            {m.type === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element -- файлы уже сжаты при загрузке
              <img
                src={mediaUrl(m.path)}
                alt=""
                loading={i === 0 ? "eager" : "lazy"}
                className="size-full object-cover"
                draggable={false}
              />
            ) : (
              <AutoVideo src={mediaUrl(m.path)} />
            )}
          </div>
        ))}
      </div>
      {media.length > 1 && (
        <>
          <span className="absolute top-3 right-3 rounded-full bg-black/60 px-2 py-0.5 text-xs font-semibold text-white">
            {index + 1}/{media.length}
          </span>
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
            {media.map((m, i) => (
              <span key={m.path} className={clsx("size-1.5 rounded-full", i === index ? "bg-white" : "bg-white/50")} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function AutoVideo({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && e.intersectionRatio > 0.6) v.play().catch(() => {});
        else v.pause();
      },
      { threshold: [0, 0.6, 1] },
    );
    io.observe(v);
    return () => io.disconnect();
  }, []);

  return (
    <div className="relative size-full">
      <video ref={ref} src={src} muted={muted} loop playsInline preload="metadata" className="size-full object-cover" />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setMuted((m) => !m);
        }}
        className="absolute right-2 bottom-2 flex size-11 items-center justify-center rounded-full bg-black/60 text-white"
        aria-label={muted ? "Включить звук" : "Выключить звук"}
      >
        {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
      </button>
    </div>
  );
}
