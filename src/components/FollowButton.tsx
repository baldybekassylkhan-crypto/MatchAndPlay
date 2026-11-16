"use client";

import clsx from "clsx";
import { useOptimistic, useTransition } from "react";
import { toggleFollow } from "@/app/actions/profile";

export function FollowButton({ targetId, initialFollowing }: { targetId: string; initialFollowing: boolean }) {
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
      className={clsx("h-10 flex-1 text-sm", following ? "btn-secondary" : "btn-primary")}
    >
      {following ? "Вы подписаны" : "Подписаться"}
    </button>
  );
}
