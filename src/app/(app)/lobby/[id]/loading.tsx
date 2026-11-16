import { HeaderSkeleton, Skeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div role="status" aria-label="Загрузка игры">
      <HeaderSkeleton />
      <div className="space-y-5 px-5 pt-5">
        <Skeleton className="h-6 w-4/5" />
        <div className="space-y-2.5">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  );
}
