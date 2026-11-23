"use client";

import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { unblockUser } from "@/app/actions/safety";
import { Avatar } from "@/components/Avatar";

export interface BlockedUser {
  id: string;
  username: string;
  avatar_url: string | null;
}

export function BlockedList({ users }: { users: BlockedUser[] }) {
  const [list, setList] = useState(users);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (list.length === 0) return null;

  const unblock = (id: string) =>
    startTransition(async () => {
      setBusyId(id);
      const res = await unblockUser(id);
      if (res.ok) setList((prev) => prev.filter((u) => u.id !== id));
      setBusyId(null);
    });

  return (
    <section className="mt-8">
      <h2 className="mb-2 font-bold">Заблокированные</h2>
      <ul className="divide-y divide-line card">
        {list.map((u) => (
          <li key={u.id} className="flex items-center gap-3 px-4 py-3">
            <Avatar src={u.avatar_url} name={u.username} size={36} />
            <span className="min-w-0 flex-1 truncate font-medium">@{u.username}</span>
            <button type="button" className="btn-secondary h-9 px-3 text-sm" disabled={pending} onClick={() => unblock(u.id)}>
              {busyId === u.id && <Loader2 className="size-4 animate-spin" />} Разблокировать
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
