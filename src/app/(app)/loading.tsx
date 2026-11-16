import { HeaderSkeleton, PostSkeleton } from "@/components/Skeleton";

/** Лента и все разделы без своего скелетона. */
export default function Loading() {
  return (
    <div role="status" aria-label="Загрузка">
      <HeaderSkeleton />
      <PostSkeleton />
      <PostSkeleton />
    </div>
  );
}
