"use client";

import { useT } from "@/components/I18nProvider";
import { Loader2, LocateOff, Search } from "lucide-react";
import Link from "next/link";
import { LobbyCard, StatusBadge } from "@/components/lobby/LobbyCard";
import { SwipeDeck } from "@/components/search/SwipeDeck";
import { useDistanceFilter } from "@/components/search/useDistanceFilter";
import type { LobbyFilters, SearchMode } from "@/lib/filters";
import { matchReason } from "@/lib/relevance";
import { formatDay } from "@/lib/time";
import type { LobbyWithMeta } from "@/lib/types";

type Item = { lobby: LobbyWithMeta; km: number | null };

export function SearchResults({
  lobbies,
  similar = [],
  ranked,
  filters,
  mode,
  myId,
  listHref,
  hasFilters,
}: {
  lobbies: LobbyWithMeta[];
  /** «Похожие варианты» (смягчённые условия) */
  similar?: LobbyWithMeta[];
  /** Умный поиск: плоский список по релевантности с подписью «почему подходит» */
  ranked: boolean;
  filters: LobbyFilters;
  mode: SearchMode;
  myId: string;
  listHref: string;
  hasFilters: boolean;
}) {
  const t = useT();
  const { items, geo } = useDistanceFilter(lobbies, filters.dist);
  const { items: similarItems } = useDistanceFilter(similar, filters.dist);

  if (geo === "locating") {
    return (
      <p className="flex items-center justify-center gap-2 py-16 text-muted">
        <Loader2 className="size-5 animate-spin" /> Определяем, где вы…
      </p>
    );
  }

  const geoNote =
    geo === "denied" ? (
      <p className="mx-4 mt-2 flex items-center gap-2 rounded-2xl bg-surface-2 p-3 text-sm text-muted">
        <LocateOff className="size-4 shrink-0" />
        {t("Нет доступа к геолокации — показываем игры по всему городу.")}
      </p>
    ) : null;

  if (mode === "swipe") {
    return (
      <>
        {geoNote}
        <SwipeDeck items={[...items, ...similarItems]} listHref={listHref} />
      </>
    );
  }

  const badge = ({ lobby, km }: Item) =>
    lobby.organizer_id === myId ? (
      <StatusBadge tone="ink">{t("Ваша")}</StatusBadge>
    ) : lobby.status === "full" ? (
      <StatusBadge tone="muted">{t("Мест нет")}</StatusBadge>
    ) : km != null ? (
      <StatusBadge tone="muted">{km < 1 ? t("< 1 км") : `${Math.round(km)} км`}</StatusBadge>
    ) : null;

  const card = (it: Item) => (
    <LobbyCard
      key={it.lobby.id}
      lobby={it.lobby}
      badge={badge(it)}
      reason={ranked ? matchReason(it.lobby, filters) : undefined}
    />
  );

  if (items.length === 0 && similarItems.length === 0) {
    return (
      <>
        {geoNote}
        <div className="flex flex-col items-center gap-3 px-8 py-16 text-center">
          <div className="flex size-16 items-center justify-center rounded-3xl bg-surface-2">
            <Search className="size-7 text-muted" />
          </div>
          <h2 className="text-lg font-bold">{hasFilters ? t("Ничего не нашлось") : t("Игр пока нет")}</h2>
          <p className="text-muted">
            {hasFilters
              ? t("Попробуйте другой день, вид спорта или уберите часть условий выше.")
              : t("В этом городе пока никто не ищет игроков. Создайте свою игру — и к вам присоединятся!")}
          </p>
          <Link href="/create/lobby" className="btn-primary mt-2">
            {t("Создать игру")}
          </Link>
        </div>
      </>
    );
  }

  if (ranked) {
    return (
      <>
        {geoNote}
        <div className="space-y-3 px-4 pt-3 pb-8">
          {items.length > 0 ? (
            <h2 className="px-1 text-sm font-bold tracking-wide text-muted uppercase">
              Подходящие игры · {items.length}
            </h2>
          ) : (
            <p className="rounded-2xl bg-surface-2 p-4 text-sm">
              {t("Точных совпадений нет, но есть похожие варианты")}
            </p>
          )}
          {items.map(card)}
          {similarItems.length > 0 && (
            <>
              <h2 className="px-1 pt-4 text-sm font-bold tracking-wide text-muted uppercase">{t("Похожие варианты")}</h2>
              <p className="-mt-1 px-1 text-sm text-muted">{t("Соседние дни и часы, другое число игроков")}</p>
              {similarItems.map(card)}
            </>
          )}
        </div>
      </>
    );
  }

  const groups = new Map<string, Item[]>();
  for (const it of items) {
    const key = t.d(formatDay(it.lobby.start_time));
    groups.set(key, [...(groups.get(key) ?? []), it]);
  }

  return (
    <>
      {geoNote}
      <div className="space-y-6 px-4 pt-3 pb-8">
        {[...groups].map(([day, list]) => (
          <section key={day}>
            <h2 className="mb-2 px-1 text-sm font-bold tracking-wide text-muted uppercase">{day}</h2>
            <div className="space-y-3">{list.map(card)}</div>
          </section>
        ))}
      </div>
    </>
  );
}
