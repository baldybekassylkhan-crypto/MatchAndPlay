"use client";

import { useT } from "@/components/I18nProvider";
import { lobbySlots, type Lobby } from "@/lib/types";

export function SlotsBar({ lobby, compact = false }: { lobby: Lobby; compact?: boolean }) {
  const { total, joined, free } = lobbySlots(lobby);
  const t = useT();
  const pct = Math.min(100, Math.round((joined / total) * 100));

  return (
    <div>
      <div className="flex items-baseline justify-between text-[13px] text-muted">
        <span>
          {t("{joined} из {total}", { joined, total })} {t.n(total, ["игрока", "игроков", "игроков"])}
        </span>
        <span className={free > 0 ? "font-medium text-ink" : undefined}>
          {free > 0 ? `${free} ${t.n(free, ["место", "места", "мест"])}` : t("Мест нет")}
        </span>
      </div>
      <div className={`mt-1.5 overflow-hidden rounded-full bg-surface-2 ${compact ? "h-1" : "h-1.5"}`}>
        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
