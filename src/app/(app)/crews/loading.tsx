import { HeaderSkeleton, Skeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div role="status" aria-label="Загрузка команд">
      <HeaderSkeleton />
      <div className="grid grid-cols-3 gap-2 border-b border-line px-4 py-3">
        <Skeleton className="h-10 rounded-full" />
        <Skeleton className="h-10 rounded-full" />
        <Skeleton className="h-10 rounded-full" />
      </div>
      <div className="space-y-2 px-4 pt-4">
        <Skeleton className="h-20 rounded-3xl" />
        <Skeleton className="h-20 rounded-3xl" />
        <Skeleton className="h-20 rounded-3xl" />
      </div>
    </div>
  );
}
