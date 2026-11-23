import { Lock, MapPin, Users } from "lucide-react";
import Link from "next/link";
import type { Crew } from "@/lib/crews";
import { plural } from "@/lib/time";
import { SportIcon } from "@/components/ui/SportIcon";

export function CrewCard({ crew }: { crew: Crew }) {
  return (
    <Link href={`/crews/${crew.id}`} className="card flex items-center gap-3 p-3.5 transition active:opacity-60">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-2" aria-hidden>
        <SportIcon sport={crew.sport} className="size-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate font-semibold">{crew.name}</span>
          {!crew.is_open && <Lock className="size-3.5 shrink-0 text-muted" aria-label="По заявке" />}
        </span>
        <span className="mt-0.5 flex items-center gap-3 text-sm text-muted">
          <span className="flex items-center gap-1">
            <Users className="size-3.5" />
            {crew.member_count} {plural(crew.member_count, ["игрок", "игрока", "игроков"])}
          </span>
          {crew.city && (
            <span className="flex min-w-0 items-center gap-1">
              <MapPin className="size-3.5 shrink-0" />
              <span className="truncate">{crew.city.name_ru}</span>
            </span>
          )}
        </span>
      </span>
    </Link>
  );
}
