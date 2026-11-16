import { HeaderSkeleton, LobbyCardSkeleton, Skeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div role="status" aria-label="Загрузка игр">
      <HeaderSkeleton />
      <div className="flex gap-2 border-b border-line px-4 py-3">
        <Skeleton className="h-9 w-28 rounded-full" />
        <Skeleton className="h-9 w-28 rounded-full" />
        <Skeleton className="h-9 w-24 rounded-full" />
      </div>
      <div className="space-y-3 px-4 pt-4">
        <LobbyCardSkeleton />
        <LobbyCardSkeleton />
      </div>
    </div>
  );
}
