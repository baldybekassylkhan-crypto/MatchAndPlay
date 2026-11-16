import clsx from "clsx";

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse rounded-2xl bg-surface-2", className)} aria-hidden />;
}

export function HeaderSkeleton() {
  return (
    <div className="flex h-14 items-center border-b border-line px-4">
      <Skeleton className="h-5 w-32" />
    </div>
  );
}

/** Скелетон карточки игры — та же высота, что у настоящей, чтобы не прыгала вёрстка. */
export function LobbyCardSkeleton() {
  return (
    <div className="space-y-3 rounded-3xl border border-line bg-surface p-4">
      <div className="flex gap-3">
        <Skeleton className="size-12 shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-2 w-full" />
    </div>
  );
}

export function PostSkeleton() {
  return (
    <div className="border-b border-line pb-3">
      <div className="flex items-center gap-3 px-4 py-3">
        <Skeleton className="size-9 rounded-full" />
        <Skeleton className="h-4 w-28" />
      </div>
      <Skeleton className="aspect-[4/5] w-full rounded-none" />
      <div className="space-y-2 px-4 pt-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  );
}
