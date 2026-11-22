"use client";

import { Clock, Heart, Loader2, MapPin, RotateCcw, Users, X } from "lucide-react";
import { AnimatePresence, motion, useMotionValue, useTransform, type PanInfo } from "motion/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { recordSwipe, resetSkipped } from "@/app/actions/swipe";
import { Avatar } from "@/components/Avatar";
import { SlotsBar } from "@/components/lobby/SlotsBar";
import { SPORTS } from "@/lib/sports";
import { formatDayTime, formatPrice } from "@/lib/time";
import { LEVELS, type LobbyWithMeta } from "@/lib/types";

type Dir = "left" | "right";
const SWIPE_DISTANCE = 110;
const SWIPE_VELOCITY = 500;

export function SwipeDeck({
  items,
  listHref,
}: {
  items: { lobby: LobbyWithMeta; km: number | null }[];
  listHref: string;
}) {
  const router = useRouter();
  // Локально помним свайпнутые карточки: сервер может обновить выдачу в любой момент,
  // и колода не должна «прыгать» назад.
  const [gone, setGone] = useState<Set<string>>(() => new Set());
  const [exitDir, setExitDir] = useState<Dir>("left");
  const [toast, setToast] = useState<string | null>(null);
  const [resetting, startReset] = useTransition();

  const deck = items.filter((it) => !gone.has(it.lobby.id));
  const current = deck[0];
  const next = deck[1];

  const swipe = useCallback(
    (dir: Dir) => {
      if (!current) return;
      setExitDir(dir);
      setGone((prev) => new Set(prev).add(current.lobby.id));
      void recordSwipe(current.lobby.id, dir);
      if (dir === "right") {
        setToast("Сохранено ♥");
        setTimeout(() => setToast(null), 1400);
      }
    },
    [current],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowLeft") swipe("left");
      if (e.key === "ArrowRight") swipe("right");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [swipe]);

  if (!current) {
    return (
      <div className="flex flex-col items-center gap-3 px-8 py-14 text-center">
        <div className="flex size-16 items-center justify-center rounded-3xl bg-surface-2 text-3xl">🏁</div>
        <h2 className="text-lg font-bold">Больше нет игр</h2>
        <p className="text-muted">Вы посмотрели все подходящие игры. Измените фильтры выше или загляните позже.</p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <button
            className="btn-secondary"
            disabled={resetting}
            onClick={() =>
              startReset(async () => {
                await resetSkipped();
                setGone(new Set());
                router.refresh();
              })
            }
          >
            {resetting ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
            Показать пропущенные
          </button>
          <button className="btn-primary" onClick={() => router.push(listHref)}>
            Списком
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-2 pb-6">
      <div className="relative mx-auto h-[min(62dvh,520px)] max-w-md">
        {next && <CardFace key={`bg-${next.lobby.id}`} item={next} background />}
        <AnimatePresence custom={exitDir}>
          <DraggableCard
            key={current.lobby.id}
            item={current}
            onSwipe={swipe}
            onOpen={() => router.push(`/lobby/${current.lobby.id}`)}
          />
        </AnimatePresence>
      </div>

      <div className="mt-5 flex items-center justify-center gap-6">
        <button
          onClick={() => swipe("left")}
          className="glass flex size-16 items-center justify-center rounded-full transition active:scale-90"
          aria-label="Не подходит"
        >
          <X className="size-7 text-danger" strokeWidth={2.5} />
        </button>
        <span className="text-sm text-muted tabular-nums">ещё {deck.length}</span>
        <button
          onClick={() => swipe("right")}
          className="glass-accent flex size-16 items-center justify-center rounded-full text-accent-ink transition active:scale-90"
          aria-label="Сохранить"
        >
          <Heart className="size-7" strokeWidth={2.5} />
        </button>
      </div>
      <p className="mt-3 text-center text-xs text-muted">Влево — не то, вправо — в сохранённые. Нажмите на карточку, чтобы открыть.</p>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-bg"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const exitVariants = {
  exit: (dir: Dir) => ({
    x: dir === "right" ? 600 : -600,
    rotate: dir === "right" ? 25 : -25,
    opacity: 0,
    transition: { duration: 0.3 },
  }),
};

function DraggableCard({
  item,
  onSwipe,
  onOpen,
}: {
  item: { lobby: LobbyWithMeta; km: number | null };
  onSwipe: (dir: Dir) => void;
  onOpen: () => void;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-250, 250], [-14, 14]);
  const likeOpacity = useTransform(x, [30, 120], [0, 1]);
  const nopeOpacity = useTransform(x, [-120, -30], [1, 0]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x > SWIPE_DISTANCE || info.velocity.x > SWIPE_VELOCITY) onSwipe("right");
    else if (info.offset.x < -SWIPE_DISTANCE || info.velocity.x < -SWIPE_VELOCITY) onSwipe("left");
  };

  return (
    <motion.div
      className="absolute inset-0 cursor-grab touch-pan-y active:cursor-grabbing"
      style={{ x, rotate }}
      drag="x"
      dragSnapToOrigin
      dragElastic={0.9}
      onDragEnd={onDragEnd}
      onTap={onOpen}
      initial={{ scale: 0.96, opacity: 0.6 }}
      animate={{ scale: 1, opacity: 1 }}
      variants={exitVariants}
      exit="exit"
    >
      <CardFace item={item}>
        <motion.span
          style={{ opacity: likeOpacity }}
          className="absolute top-6 left-6 -rotate-12 rounded-xl border-4 border-accent px-3 py-1 text-2xl font-black text-accent"
        >
          ХОЧУ
        </motion.span>
        <motion.span
          style={{ opacity: nopeOpacity }}
          className="absolute top-6 right-6 rotate-12 rounded-xl border-4 border-danger px-3 py-1 text-2xl font-black text-danger"
        >
          НЕ ТО
        </motion.span>
      </CardFace>
    </motion.div>
  );
}

function CardFace({
  item,
  background,
  children,
}: {
  item: { lobby: LobbyWithMeta; km: number | null };
  background?: boolean;
  children?: React.ReactNode;
}) {
  const { lobby, km } = item;
  const sport = SPORTS[lobby.sport];
  const level = LEVELS.find((l) => l.id === lobby.level);

  return (
    <div
      className={`absolute inset-0 flex flex-col overflow-hidden rounded-[2rem] border border-line bg-surface shadow-xl select-none ${
        background ? "translate-y-3 scale-[0.95] opacity-70" : ""
      }`}
    >
      <div className="relative flex h-[38%] items-center justify-center bg-surface-2">
        <span className="text-8xl drop-shadow-sm" aria-hidden>
          {sport?.emoji}
        </span>
        <span className="absolute bottom-3 left-4 rounded-full bg-black/70 px-3 py-1 text-sm font-bold text-white">
          {sport?.label}
        </span>
        {km != null && (
          <span className="absolute right-4 bottom-3 rounded-full bg-black/70 px-3 py-1 text-sm font-semibold text-white">
            {km < 1 ? `${Math.round(km * 1000)} м` : `${km.toFixed(1).replace(".", ",")} км`}
          </span>
        )}
        {children}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="space-y-1 text-[15px]">
          <p className="flex items-center gap-2 font-semibold">
            <Clock className="size-4 shrink-0" />
            {formatDayTime(lobby.start_time)}
          </p>
          <p className="flex items-center gap-2 text-muted">
            <MapPin className="size-4 shrink-0" />
            <span className="truncate">{lobby.location_name}</span>
          </p>
          <p className="flex items-center gap-2 text-muted">
            <Users className="size-4 shrink-0" />
            {level ? `Уровень: ${level.label.toLowerCase()}` : "Любой уровень"} · {formatPrice(lobby.price_kzt).replace(" с человека", "")}
          </p>
        </div>
        <p className="line-clamp-3 text-[15px]">{lobby.description}</p>
        <div className="mt-auto space-y-3">
          <SlotsBar lobby={lobby} compact />
          {lobby.organizer && (
            <p className="flex items-center gap-2 text-sm text-muted">
              <Avatar src={lobby.organizer.avatar_url} name={lobby.organizer.username} size={24} />
              @{lobby.organizer.username}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
