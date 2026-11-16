import { HeaderSkeleton, Skeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div role="status" aria-label="Загрузка профиля">
      <HeaderSkeleton />
      <div className="px-5 pt-5">
        <div className="flex items-center gap-5">
          <Skeleton className="size-[84px] rounded-full" />
          <div className="grid flex-1 grid-cols-3 gap-3">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        </div>
        <Skeleton className="mt-4 h-4 w-1/3" />
        <Skeleton className="mt-2 h-4 w-2/3" />
        <Skeleton className="mt-4 h-10 w-full" />
      </div>
      <div className="mt-5 grid grid-cols-3 gap-0.5">
        {Array.from({ length: 9 }, (_, i) => (
          <Skeleton key={i} className="aspect-square rounded-none" />
        ))}
      </div>
    </div>
  );
}
