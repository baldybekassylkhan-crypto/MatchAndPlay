"use client";

import { Layers, List, Loader2, Map as MapIcon, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { smartSearch } from "@/app/actions/smart-search";
import { FilterSheet } from "@/components/search/FilterSheet";
import { Segmented } from "@/components/ui/Segmented";
import {
  countActiveFilters,
  EMPTY_FILTERS,
  filterChips,
  filtersToQuery,
  type LobbyFilters,
  type SearchMode,
} from "@/lib/filters";
import type { City } from "@/lib/types";

export function SearchControls({
  filters,
  mode,
  cities,
  cityId,
}: {
  filters: LobbyFilters;
  mode: SearchMode;
  cities: City[];
  cityId: number;
}) {
  const router = useRouter();
  const [q, setQ] = useState(filters.ai || filters.q);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [thinking, startThinking] = useTransition();
  // Переключатель реагирует сразу, не дожидаясь ответа сервера
  const [shownMode, setShownMode] = useState<SearchMode>(mode);
  useEffect(() => setShownMode(mode), [mode]);
  const active = countActiveFilters(filters);
  const chips = filterChips(filters);
  const sheetInitial = useMemo(() => ({ ...filters, city: filters.city ?? cityId }), [filters, cityId]);

  const go = (f: LobbyFilters, m: SearchMode = mode) => router.push(`/search${filtersToQuery(f, m)}`);

  const submit = () => {
    const text = q.trim();
    if (!text) {
      go({ ...EMPTY_FILTERS, city: filters.city, dist: filters.dist });
      return;
    }
    startThinking(async () => {
      try {
        const res = await smartSearch(text, { cityId: filters.city, dist: filters.dist, mode });
        router.push(res.href);
      } catch {
        // Сервер недоступен — хотя бы обычный текстовый поиск
        go({ ...EMPTY_FILTERS, city: filters.city, dist: filters.dist, q: text });
      }
    });
  };

  return (
    <div className="space-y-3 px-4 pt-3">
      <div className="flex gap-2">
        <form
          className="relative flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          role="search"
        >
          {thinking ? (
            <Loader2 className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 animate-spin text-muted" />
          ) : (
            <Sparkles className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted" />
          )}
          <input
            className="input pr-10 pl-11"
            type="search"
            enterKeyHint="search"
            placeholder="Баскетбол в субботу вечером, до 10 человек"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            maxLength={200}
            aria-label="Умный поиск игр"
            disabled={thinking}
          />
          {q && !thinking && (
            <button
              type="button"
              className="absolute top-1/2 right-1 flex size-11 -translate-y-1/2 items-center justify-center text-muted"
              onClick={() => {
                setQ("");
                if (filters.q || filters.ai) go({ ...EMPTY_FILTERS, city: filters.city, dist: filters.dist });
              }}
              aria-label="Очистить"
            >
              <X className="size-5" />
            </button>
          )}
        </form>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="glass relative flex size-12 shrink-0 items-center justify-center rounded-2xl text-ink"
          aria-label="Фильтры"
        >
          <SlidersHorizontal className="size-5" />
          {active > 0 && (
            <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-ink">
              {active}
            </span>
          )}
        </button>
      </div>

      {filters.ai && chips.length > 0 && (
        <p className="flex items-center gap-1.5 text-sm text-muted">
          <Sparkles className="size-4 text-ink" />
          Вот что мы поняли. Лишнее можно убрать:
        </p>
      )}

      <div className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1">
        <Segmented
          size="sm"
          layoutId="search-mode"
          ariaLabel="Вид результатов"
          className="shrink-0"
          value={shownMode}
          onChange={(m) => {
            setShownMode(m);
            go(filters, m);
          }}
          options={[
            { value: "map", label: "Карта", icon: <MapIcon className="size-4" /> },
            { value: "list", label: "Список", icon: <List className="size-4" /> },
            { value: "swipe", label: "Свайпы", icon: <Layers className="size-4" /> },
          ]}
        />
        {chips.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => {
              if (c.key === "q") setQ("");
              go(c.without);
            }}
            className="chip h-10 shrink-0"
          >
            {c.label}
            <X className="size-3.5 text-muted" />
          </button>
        ))}
      </div>

      <FilterSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        initial={sheetInitial}
        cities={cities}
        defaultCityId={cityId}
        onApply={(f) => {
          setSheetOpen(false);
          // На карте остаёмся на карте, иначе после фильтра — свайп-режим, как в ТЗ
          go(f, mode === "map" ? "map" : "swipe");
        }}
      />
    </div>
  );
}
