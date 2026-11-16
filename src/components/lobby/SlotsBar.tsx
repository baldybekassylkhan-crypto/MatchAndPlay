import { lobbySlots, type Lobby } from "@/lib/types";
import { plural } from "@/lib/time";

export function SlotsBar({ lobby, compact = false }: { lobby: Lobby; compact?: boolean }) {
  const { total, joined, free } = lobbySlots(lobby);
  const pct = Math.min(100, Math.round((joined / total) * 100));

  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-semibold">
          {joined}/{total} {plural(total, ["игрок", "игрока", "игроков"])}
        </span>
        <span className={free > 0 ? "font-medium" : "text-muted"}>
          {free > 0 ? `${free} ${plural(free, ["место", "места", "мест"])} свободно` : "Мест нет"}
        </span>
      </div>
      <div className={`mt-1.5 overflow-hidden rounded-full bg-surface-2 ${compact ? "h-1.5" : "h-2"}`}>
        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
