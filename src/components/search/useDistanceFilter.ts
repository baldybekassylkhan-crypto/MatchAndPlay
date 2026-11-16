"use client";

import { useEffect, useMemo, useState } from "react";
import { distanceKm } from "@/lib/geo";
import type { LobbyWithMeta } from "@/lib/types";

export type GeoState = "idle" | "locating" | "ready" | "denied";

/**
 * Фильтр «до N км» на устройстве: координаты пользователя никуда не отправляются.
 * Лобби без точки на карте при включённом фильтре скрываются.
 */
export function useDistanceFilter(lobbies: LobbyWithMeta[], maxKm: number | null) {
  const [geo, setGeo] = useState<GeoState>("idle");
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!maxKm || pos) return;
    if (!("geolocation" in navigator)) {
      setGeo("denied");
      return;
    }
    setGeo("locating");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setPos({ lat: coords.latitude, lng: coords.longitude });
        setGeo("ready");
      },
      () => setGeo("denied"),
      { timeout: 10000, maximumAge: 300000 },
    );
  }, [maxKm, pos]);

  const result = useMemo(() => {
    if (!maxKm || !pos) return lobbies.map((lobby) => ({ lobby, km: null as number | null }));
    return lobbies
      .filter((l) => l.lat != null && l.lng != null)
      .map((lobby) => ({ lobby, km: distanceKm(pos.lat, pos.lng, lobby.lat!, lobby.lng!) }))
      .filter((x) => x.km <= maxKm);
  }, [lobbies, maxKm, pos]);

  return { items: result, geo: maxKm ? geo : ("idle" as GeoState) };
}
