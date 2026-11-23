"use client";

import clsx from "clsx";
import { Clock, Landmark, List, LocateFixed, Loader2, MapPin, MapPinOff, Plus, X } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDistanceFilter } from "@/components/search/useDistanceFilter";
import type { LobbyFilters } from "@/lib/filters";
import { distanceKm } from "@/lib/geo";
import { SPORTS } from "@/lib/sports";
import { formatDayTime, formatPrice, plural } from "@/lib/time";
import { lobbySlots, type LobbyWithMeta } from "@/lib/types";
import { VENUE_KINDS, venueCreateHref, venueTitle, type Venue } from "@/lib/venues";
import { SportIcon } from "@/components/ui/SportIcon";

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
            <p className="font-bold">Карта не загрузилась</p>
            <p className="text-sm text-muted">Проверьте интернет или откройте игры списком.</p>
            <Link href={listHref} className="btn-primary mt-1">
              Показать списком
            </Link>
          </div>
        ) : (
          <CityMap3D
            center={center}
            lobbies={pinned}
            selectedId={selectedId}
            onSelect={selectFromMap}
            venues={venues}
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
              label={showVenues ? "Скрыть площадки" : "Показать площадки"}
              pressed={showVenues}
              onClick={() => {
                setShowVenues((v) => !v);
                setSelectedVenueId(null);
              }}
            >
              <Landmark className="size-5" />
            </MapButton>
            <MapButton label={is3D ? "Плоская карта" : "Объёмная карта"} onClick={() => setIs3D((v) => !v)}>
              <span className="text-[13px] font-semibold">{is3D ? "2D" : "3D"}</span>
            </MapButton>
            <MapButton label="Показать, где я" onClick={locate} disabled={locating}>
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
              onClose={() => setSelectedVenueId(null)}
            />
          ) : cards.length === 0 ? (
            <div className="glass map-sheet pointer-events-auto mx-3 mb-2 flex items-center gap-3 rounded-[1.5rem] p-3.5">
              <p className="min-w-0 flex-1 text-sm font-semibold">Рядом пока нет игр. Создайте первую!</p>
              <Link href="/create/lobby" className="btn-primary h-9 shrink-0 rounded-full px-3.5 text-[15px]">
                <Plus className="size-4" /> Игра
              </Link>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-4 pb-1.5">
                <span className="glass rounded-full px-3 py-1.5 text-[13px] font-medium">
                  {cards.length} {plural(cards.length, ["игра", "игры", "игр"])} {userPos ? "рядом" : "в городе"}
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
  onClose,
}: {
  venue: Venue;
  cityId: number;
  userPos: { lat: number; lng: number } | null;
  gamesHere: number;
  onClose: () => void;
}) {
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
            {kind.label}
            {km != null && ` · ${km < 1 ? `${Math.round(km * 1000)} м` : `${km.toFixed(1)} км`}`}
          </p>
          {venue.a && <p className="truncate text-sm text-muted">{venue.a}</p>}
        </div>
        <button type="button" onClick={onClose} className="-mt-1 -mr-1 flex size-10 shrink-0 items-center justify-center text-muted" aria-label="Закрыть площадку">
          <X className="size-5" />
        </button>
      </div>
      {gamesHere > 0 && (
        <p className="mt-2 text-sm font-semibold">
          Здесь {gamesHere === 1 ? "уже есть игра" : `уже ${gamesHere} ${plural(gamesHere, ["игра", "игры", "игр"])}`}
        </p>
      )}
      <Link href={venueCreateHref(venue, cityId)} className="btn-primary mt-3 w-full">
        <Plus className="size-5" /> Собрать игру
      </Link>
    </section>
  );
}

function GameCard({ card: { lobby, km }, selected }: { card: Card; selected: boolean }) {
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
            <span className="truncate font-semibold">{sport?.label ?? "Игра"}</span>
            {km != null && <span className="shrink-0 text-[13px] font-medium text-accent">{km < 1 ? `${Math.round(km * 1000)} м` : `${km.toFixed(1)} км`}</span>}
          </span>
          <span className="mt-0.5 flex items-center gap-1 text-sm text-muted">
            <Clock className="size-3.5 shrink-0" />
            <span className="truncate">{formatDayTime(lobby.start_time)}</span>
          </span>
          <span className="flex items-center gap-1 text-sm text-muted">
            {hasPin ? <MapPin className="size-3.5 shrink-0" /> : <MapPinOff className="size-3.5 shrink-0" />}
            <span className="truncate">{lobby.location_name}</span>
          </span>
        </span>
      </span>
      <span className="mt-2 flex items-center justify-between text-sm font-semibold">
        <span className={free > 0 ? "text-ink" : "text-muted"}>
          {free > 0 ? `${free} ${plural(free, ["место", "места", "мест"])}` : "Мест нет"}
        </span>
        <span className="text-muted">{formatPrice(lobby.price_kzt).replace(" с человека", "")}</span>
      </span>
    </Link>
  );
}
