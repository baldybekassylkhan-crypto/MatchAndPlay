import { Skeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div role="status" aria-label="Загружаем карту и игры">
      <div className="fixed inset-0 z-0 animate-pulse bg-surface-2" />
      <div className="relative mx-auto max-w-lg space-y-3 px-4 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <div className="flex justify-end">
          <Skeleton className="h-10 w-28 rounded-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-12 flex-1" />
          <Skeleton className="size-12" />
        </div>
        <Skeleton className="h-9 w-56 rounded-full" />
      </div>
    </div>
  );
}
