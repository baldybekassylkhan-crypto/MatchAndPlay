import { HeaderSkeleton, LobbyCardSkeleton, Skeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div role="status" aria-label="Ищем игры">
      <HeaderSkeleton />
      <div className="space-y-3 px-4 pt-3">
        <div className="flex gap-2">
          <Skeleton className="h-12 flex-1" />
          <Skeleton className="size-12" />
        </div>
        <Skeleton className="h-9 w-44 rounded-full" />
        <LobbyCardSkeleton />
        <LobbyCardSkeleton />
        <LobbyCardSkeleton />
      </div>
    </div>
  );
}
