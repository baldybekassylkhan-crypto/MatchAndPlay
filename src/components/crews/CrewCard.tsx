import { getT } from "@/lib/i18n/server";
import { ChevronRight, Lock } from "lucide-react";
import Link from "next/link";
import type { Crew } from "@/lib/crews";
import { SPORTS } from "@/lib/sports";
import { plural } from "@/lib/time";
import { SportIcon } from "@/components/ui/SportIcon";

/** Строка команды внутри сгруппированного списка. */
export async function CrewCard({ crew }: { crew: Crew }) {
  const t = await getT();
  return (
    <Link href={`/crews/${crew.id}`} className="flex min-h-[68px] items-center gap-3 px-4 py-2.5 active:bg-surface-2">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-accent/15 text-accent" aria-hidden>
        <SportIcon sport={crew.sport} className="size-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[17px] font-medium">{crew.name}</span>
          {!crew.is_open && <Lock className="size-3.5 shrink-0 text-muted" aria-label={t("Вступление по заявке")} />}
        </span>
        <span className="mt-0.5 block truncate text-[14px] text-muted">
          {t(SPORTS[crew.sport]?.label)} · {crew.member_count} {plural(crew.member_count, ["игрок", "игрока", "игроков"])}
        </span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-muted/60" aria-hidden />
    </Link>
  );
}
