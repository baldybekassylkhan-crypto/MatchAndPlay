"use client";

import maplibregl, { type Map as MapLibreMap, type Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import clsx from "clsx";
import { useEffect, useRef } from "react";
import { applyDarkPalette, applyRussianLabels, MAP_STYLE, useDarkMode } from "@/lib/map-theme";

export interface LatLng {
  lat: number;
  lng: number;
}

/** Небольшая плоская карта: выбор точки в формах и место на странице игры. */
export default function PointMap({
  center,
  marker,
  zoom = 13,
  onPick,
  className,
}: {
  center: LatLng;
  marker: LatLng | null;
  zoom?: number;
  onPick?: (p: LatLng) => void;
  className?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const pickRef = useRef(onPick);
  const dark = useDarkMode();
  const appliedDark = useRef(dark);

  useEffect(() => {
    pickRef.current = onPick;
  });

  useEffect(() => {
    if (!container.current) return;
    let map: MapLibreMap;
    try {
      map = new maplibregl.Map({
        container: container.current,
        style: MAP_STYLE,
        center: [center.lng, center.lat],
        zoom,
        scrollZoom: false,
        dragRotate: false,
        pitchWithRotate: false,
        attributionControl: false,
      });
    } catch {
      return; // Без WebGL остаётся поле адреса
    }
    mapRef.current = map;
    map.touchZoomRotate.disableRotation();
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    map.on("style.load", () => {
      applyRussianLabels(map);
      if (appliedDark.current) applyDarkPalette(map);
    });
    map.on("click", (e) => pickRef.current?.({ lat: e.lngLat.lat, lng: e.lngLat.lng }));
    return () => {
      markerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
    // Дальше центр и масштаб меняются через easeTo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (appliedDark.current === dark) return;
    appliedDark.current = dark;
    mapRef.current?.setStyle(MAP_STYLE, { diff: false });
  }, [dark]);

  useEffect(() => {
    mapRef.current?.easeTo({ center: [center.lng, center.lat], zoom, duration: 450 });
  }, [center.lat, center.lng, zoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!marker) {
      markerRef.current?.remove();
      markerRef.current = null;
    } else if (markerRef.current) {
      markerRef.current.setLngLat([marker.lng, marker.lat]);
    } else {
      const el = document.createElement("div");
      el.setAttribute("aria-label", "Выбранное место");
      const dot = document.createElement("div");
      dot.className = "map-point";
      el.append(dot);
      markerRef.current = new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat([marker.lng, marker.lat]).addTo(map);
    }
  }, [marker]);

  return <div ref={container} className={clsx("point-map bg-surface-2", className)} />;
}
