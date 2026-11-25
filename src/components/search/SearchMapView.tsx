"use client";

import { useT } from "@/components/I18nProvider";
import clsx from "clsx";
import { CircleAlert, Clock, Landmark, List, LocateFixed, Loader2, MapPin, MapPinOff, Plus, TicketCheck, TriangleAlert, X } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDistanceFilter } from "@/components/search/useDistanceFilter";
import type { LobbyFilters } from "@/lib/filters";
import { distanceKm } from "@/lib/geo";
import { SPORTS } from "@/lib/sports";
import { formatDayTime, formatPrice, plural } from "@/lib/time";
import { lobbySlots, type LobbyWithMeta } from "@/lib/types";
import { COURT_ISSUES, OPEN_STATUSES, courtReportHref, isFreeCourt, type CourtReport } from "@/lib/courts";
import { createClient } from "@/lib/supabase/client";
import { VENUE_KINDS, venueCreateHref, venueTitle, type Venue } from "@/lib/venues";
import { SportIcon } from "@/components/ui/SportIcon";
import { WomenOnlyBadge } from "@/components/lobby/LobbyCard";

// WebGL-карта работает только в браузере и грузится отдельно, чтобы не утяжелять остальные страницы
const CityMap3D = dynamic(() => import("@/components/map/CityMap3D"), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse bg-surface-2" />,
});

const MAX_CITY_KM = 80;

type Card = { lobby: LobbyWithMeta; km: number | null };

export function SearchMapView({
  lobbies,
  similar,
  filters,
  cityId,
  center,
  listHref,
  controls,
}: {
  lobbies: LobbyWithMeta[];
  similar: LobbyWithMeta[];
  filters: LobbyFilters;
  cityId: number;
  center: { lat: number; lng: number };
  listHref: string;
  controls: React.ReactNode;
}) {
  const t = useT();
  const all = useMemo(() => [...lobbies, ...similar], [lobbies, similar]);
  const { items } = useDistanceFilter(all, filters.dist);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [is3D, setIs3D] = useState(true);
  const [recenter, setRecenter] = useState(0);
  const [failed, setFailed] = useState(false);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
  const [showVenues, setShowVenues] = useState(true);
  const [freeOnly, setFreeOnly] = useState(false);
  const [issues, setIssues] = useState<Pick<CourtReport, "venue_id" | "kind" | "votes">[]>([]);
  const carousel = useRef<HTMLDivElement>(null);
  const programmatic = useRef(false);
  const programmaticTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const cards = useMemo<Card[]>(() => {
    const withKm = items.map(({ lobby }) => ({
      lobby,
      km: userPos && lobby.lat != null && lobby.lng != null ? distanceKm(userPos.lat, userPos.lng, lobby.lat, lobby.lng) : null,
    }));
    return withKm.sort((a, b) => {
      if (a.km != null && b.km != null) return a.km - b.km;
      if (a.km != null) return -1;
      if (b.km != null) return 1;
      return a.lobby.start_time.localeCompare(b.lobby.start_time);
    });
  }, [items, userPos]);

  const pinned = useMemo(() => cards.filter((c) => c.lobby.lat != null && c.lobby.lng != null).map((c) => c.lobby), [cards]);
  const selectedVenue = useMemo(() => venues.find((v) => v.id === selectedVenueId) ?? null, [venues, selectedVenueId]);
  const shownVenues = useMemo(() => (freeOnly ? venues.filter(isFreeCourt) : venues), [venues, freeOnly]);

  // Открытые обращения о проблемах на площадках города
  useEffect(() => {
    let active = true;
    createClient()
      .from("court_reports")
      .select("venue_id, kind, votes")
      .eq("city_id", cityId)
      .in("status", OPEN_STATUSES)
      .limit(500)
      .then(({ data }) => active && setIssues((data as typeof issues | null) ?? []));
    return () => {
      active = false;
    };
  }, [cityId]);

  // Площадки города лежат отдельным файлом и грузятся только вместе с картой
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/venues/${cityId}.json`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Venue[]) => setVenues(Array.isArray(data) ? data : []))
      .catch(() => {});
    return () => controller.abort();
  }, [cityId]);

  const selectVenue = useCallback((id: string | null) => {
    setSelectedVenueId(id);
    if (id) setSelectedId(null);
  }, []);

  const applyPosition = useCallback(
    (lat: number, lng: number, moveCamera: boolean) => {
      if (distanceKm(lat, lng, center.lat, center.lng) > MAX_CITY_KM) {
        if (moveCamera) setNotice("Вы далеко от этого города. Показываем его центр.");
        return;
      }
      setNotice(null);
      setUserPos({ lat, lng });
      if (moveCamera) setRecenter((n) => n + 1);
    },
    [center.lat, center.lng],
  );

  const locate = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setNotice("Геолокация недоступна на этом устройстве.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        applyPosition(coords.latitude, coords.longitude, true);
        setLocating(false);
      },
      () => {
        setNotice("Нет доступа к геолокации. Разрешите её в настройках телефона.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }, [applyPosition]);

  // Если доступ уже разрешён, сразу показываем точку и ближайшие игры, без лишнего запроса
  useEffect(() => {
    let active = true;
    navigator.permissions
      ?.query({ name: "geolocation" })
      .then((status) => {
        if (!active || status.state !== "granted") return;
        navigator.geolocation.getCurrentPosition(
          ({ coords }) => active && applyPosition(coords.latitude, coords.longitude, false),
          () => {},
          { timeout: 10000, maximumAge: 300000 },
        );
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [applyPosition]);

  const selectFromMap = useCallback((id: string | null) => {
    setSelectedId(id);
    if (!id) return;
    setSelectedVenueId(null);
    // Карточки могли быть скрыты панелью площадки: ждём, пока они появятся
    requestAnimationFrame(() => {
      const card = carousel.current?.querySelector<HTMLElement>(`[data-lobby="${id}"]`);
      if (!card) return;
      programmatic.current = true;
      clearTimeout(programmaticTimer.current);
      programmaticTimer.current = setTimeout(() => (programmatic.current = false), 700);
      card.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    });
  }, []);

  // Пролистали карточки — камера переходит к игре в центре
  const onCarouselScroll = () => {
    if (programmatic.current) return;
    clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => {
      const box = carousel.current;
      if (!box) return;
      const middle = box.getBoundingClientRect().left + box.clientWidth / 2;
      let best: string | null = null;
      let bestDistance = Infinity;
      box.querySelectorAll<HTMLElement>("[data-lobby]").forEach((el) => {
        const rect = el.getBoundingClientRect();
        const distance = Math.abs(rect.left + rect.width / 2 - middle);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = el.dataset.lobby ?? null;
        }
      });
      if (best) setSelectedId(best);
    }, 140);
  };

  useEffect(
    () => () => {
      clearTimeout(programmaticTimer.current);
      clearTimeout(scrollTimer.current);
    },
    [],
  );

  const onFail = useCallback(() => setFailed(true), []);

  return (
    <>
      <div className="fixed inset-0 z-0 bg-surface-2">
        {failed ? (
          <div className="flex size-full flex-col items-center justify-center gap-3 px-8 text-center">
            <MapPinOff className="size-8 text-muted" aria-hidden />
            <p className="font-bold">{t("Карта не загрузилась")}</p>
            <p className="text-sm text-muted">{t("Проверьте интернет или откройте игры списком.")}</p>
            <Link href={listHref} className="btn-primary mt-1">
              {t("Показать списком")}
            </Link>
          </div>
        ) : (
          <CityMap3D
            center={center}
            lobbies={pinned}
            selectedId={selectedId}
            onSelect={selectFromMap}
            venues={shownVenues}
            selectedVenueId={selectedVenueId}
            onSelectVenue={selectVenue}
            showVenues={showVenues}
            userPos={userPos}
            is3D={is3D}
            recenter={recenter}
            onFail={onFail}
          />
        )}
      </div>

      {/* Без z-index: панели фильтров и выбора города внутри должны открываться поверх нижнего меню */}
      <div className="map-controls pointer-events-none relative mx-auto max-w-lg pt-[env(safe-area-inset-top)]">
        <div className="pointer-events-auto">{controls}</div>
        {notice && (
          <p role="status" className="glass pointer-events-auto mx-4 mt-2 rounded-2xl px-3 py-2 text-sm">
            {notice}
          </p>
        )}
      </div>

      {!failed && (
        <div className="pointer-events-none fixed inset-x-0 bottom-(--nav-space) z-20 mx-auto max-w-lg">
          <div className="mb-2 flex justify-end px-3">
            <div className="glass pointer-events-auto flex flex-col divide-y divide-line overflow-hidden rounded-full">
            <MapButton
              label={showVenues ? t("Скрыть площадки") : t("Показать площадки")}
              pressed={showVenues}
              onClick={() => {
                setShowVenues((v) => !v);
                setSelectedVenueId(null);
              }}
            >
              <Landmark className="size-5" />
            </MapButton>
            <MapButton
              label={freeOnly ? t("Показать все площадки") : t("Только бесплатные площадки")}
              pressed={freeOnly}
              onClick={() => {
                setFreeOnly((v) => !v);
                setShowVenues(true);
                setSelectedVenueId(null);
              }}
            >
              <TicketCheck className="size-5" />
            </MapButton>
            <MapButton label={is3D ? t("Плоская карта") : t("Объёмная карта")} onClick={() => setIs3D((v) => !v)}>
              <span className="text-[13px] font-semibold">{is3D ? "2D" : "3D"}</span>
            </MapButton>
            <MapButton label={t("Показать, где я")} onClick={locate} disabled={locating}>
              {locating ? <Loader2 className="size-5 animate-spin" /> : <LocateFixed className="size-5" />}
            </MapButton>
            </div>
          </div>

          {selectedVenue ? (
            <VenueCard
              venue={selectedVenue}
              cityId={cityId}
              userPos={userPos}
              gamesHere={pinned.filter((l) => distanceKm(l.lat!, l.lng!, selectedVenue.lat, selectedVenue.lng) < 0.15).length}
              issues={issues.filter((i) => i.venue_id === selectedVenue.id)}
              onClose={() => setSelectedVenueId(null)}
            />
          ) : cards.length === 0 ? (
            <div className="glass map-sheet pointer-events-auto mx-3 mb-2 flex items-center gap-3 rounded-[1.5rem] p-3.5">
              <p className="min-w-0 flex-1 text-sm font-semibold">{t("Рядом пока нет игр. Создайте первую!")}</p>
              <Link href="/create/lobby" className="btn-primary h-9 shrink-0 rounded-full px-3.5 text-[15px]">
                <Plus className="size-4" /> Игра
              </Link>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-4 pb-1.5">
                <span className="glass rounded-full px-3 py-1.5 text-[13px] font-medium">
                  {cards.length} {plural(cards.length, ["игра", "игры", "игр"])} {userPos ? t("рядом") : t("в городе")}
                </span>
                <Link href={listHref} className="glass pointer-events-auto flex h-8 items-center gap-1 rounded-full px-3 text-[13px] font-medium">
                  <List className="size-3.5" /> Списком
                </Link>
              </div>
              <div
                ref={carousel}
                onScroll={onCarouselScroll}
                className="no-scrollbar pointer-events-auto flex snap-x snap-mandatory gap-2.5 overflow-x-auto scroll-px-3 px-3 pb-2"
              >
                {cards.map((card) => (
                  <GameCard key={card.lobby.id} card={card} selected={card.lobby.id === selectedId} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

function MapButton({
  label,
  onClick,
  disabled,
  pressed,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "flex size-11 items-center justify-center active:opacity-60",
        pressed ? "text-accent" : "text-ink",
      )}
    >
      {children}
    </button>
  );
}

function VenueCard({
  venue,
  cityId,
  userPos,
  gamesHere,
  issues,
  onClose,
}: {
  venue: Venue;
  cityId: number;
  userPos: { lat: number; lng: number } | null;
  gamesHere: number;
  issues: Pick<CourtReport, "kind" | "votes">[];
  onClose: () => void;
}) {
  const t = useT();
  const free = isFreeCourt(venue);
  const kind = VENUE_KINDS[venue.k];
  const km = userPos ? distanceKm(userPos.lat, userPos.lng, venue.lat, venue.lng) : null;

  return (
    <section aria-label={venueTitle(venue)} className="glass map-sheet pointer-events-auto mx-3 mb-2 animate-fade-up rounded-[1.5rem] p-3.5">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: kind.color }} aria-hidden>
          <SportIcon venue={venue.k} className="size-6 text-white" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold">{venueTitle(venue)}</h2>
          <p className="truncate text-sm text-muted">
            {t(kind.label)}
            {km != null && ` · ${km < 1 ? `${Math.round(km * 1000)} м` : `${km.toFixed(1)} км`}`}
          </p>
          {venue.a && <p className="truncate text-sm text-muted">{venue.a}</p>}
          {free && (
            <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent">
              <TicketCheck className="size-3.5" aria-hidden /> Открытая площадка · бесплатно
            </p>
          )}
        </div>
        <button type="button" onClick={onClose} className="-mt-1 -mr-1 flex size-10 shrink-0 items-center justify-center text-muted" aria-label={t("Закрыть площадку")}>
          <X className="size-5" />
        </button>
      </div>
      {gamesHere > 0 && (
        <p className="mt-2 text-sm font-semibold">
          Здесь {gamesHere === 1 ? t("уже есть игра") : `уже ${gamesHere} ${plural(gamesHere, ["игра", "игры", "игр"])}`}
        </p>
      )}
      {issues.length > 0 && (
        <p className="mt-2 flex items-start gap-1.5 text-sm text-danger">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {issues.map((i) => COURT_ISSUES[i.kind].label).join(", ")} · жители сообщили {issues.reduce((s, i) => s + i.votes, 0)} раз
          </span>
        </p>
      )}
      <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
        <Link href={venueCreateHref(venue, cityId)} className="btn-primary">
          <Plus className="size-5" /> Собрать игру
        </Link>
        <Link href={courtReportHref(venue, cityId)} className="btn-secondary px-3" aria-label={t("Сообщить о проблеме на площадке")}>
          <CircleAlert className="size-5" /> Проблема
        </Link>
      </div>
      <Link href={`/courts?city=${cityId}`} className="mt-2 block text-center text-sm text-muted underline-offset-2 hover:underline">
        {t("Обращения жителей в акимат")}
      </Link>
    </section>
  );
}

function GameCard({ card: { lobby, km }, selected }: { card: Card; selected: boolean }) {
  const t = useT();
  const sport = SPORTS[lobby.sport];
  const { free } = lobbySlots(lobby);
  const hasPin = lobby.lat != null && lobby.lng != null;

  return (
    <Link
      href={`/lobby/${lobby.id}`}
      data-lobby={lobby.id}
      className={clsx(
        "glass map-sheet block w-[84%] max-w-80 shrink-0 snap-center rounded-[1.5rem] p-3.5 transition",
        selected && "outline-2 outline-accent",
      )}
    >
      <span className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2" aria-hidden>
          <SportIcon sport={lobby.sport} className="size-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="truncate font-semibold">{t(sport?.label ?? "Игра")}</span>
              {lobby.women_only && <WomenOnlyBadge />}
            </span>
            {km != null && <span className="shrink-0 text-[13px] font-medium text-accent">{km < 1 ? `${Math.round(km * 1000)} м` : `${km.toFixed(1)} км`}</span>}
          </span>
          <span className="mt-0.5 flex items-center gap-1 text-sm text-muted">
            <Clock className="size-3.5 shrink-0" />
            <span className="truncate">{t.d(formatDayTime(lobby.start_time))}</span>
          </span>
          <span className="flex items-center gap-1 text-sm text-muted">
            {hasPin ? <MapPin className="size-3.5 shrink-0" /> : <MapPinOff className="size-3.5 shrink-0" />}
            <span className="truncate">{lobby.location_name}</span>
          </span>
        </span>
      </span>
      <span className="mt-2 flex items-center justify-between text-sm font-semibold">
        <span className={free > 0 ? "text-ink" : "text-muted"}>
          {free > 0 ? `${free} ${plural(free, ["место", "места", "мест"])}` : t("Мест нет")}
        </span>
        <span className="text-muted">{t.d(formatPrice(lobby.price_kzt)).replace(" с человека", "")}</span>
      </span>
    </Link>
  );
}
