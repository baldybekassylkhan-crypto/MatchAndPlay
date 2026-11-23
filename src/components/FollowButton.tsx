"use client";

import clsx from "clsx";
import { useOptimistic, useTransition } from "react";
import { toggleFollow } from "@/app/actions/profile";

export function FollowButton({
  targetId,
  initialFollowing,
  compact = false,
}: {
  targetId: string;
  initialFollowing: boolean;
  /** Для узких карточек */
  compact?: boolean;
}) {
  const [following, setOptimistic] = useOptimistic(initialFollowing);
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          setOptimistic(!following);
          await toggleFollow(targetId, !following);
        })
      }
      className={clsx("flex-1 text-sm", compact ? "h-9 rounded-xl px-1.5! text-[13px]" : "h-10", following ? "btn-secondary" : "btn-primary")}
    >
      {following ? "Вы подписаны" : "Подписаться"}
    </button>
  );
}
