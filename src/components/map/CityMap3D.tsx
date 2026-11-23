"use client";

import maplibregl, { type GeoJSONSource, type Map as MapLibreMap, type Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import { applyDarkPalette, applyRussianLabels, MAP_STYLE, useDarkMode } from "@/lib/map-theme";
import { GLYPHS, sportGlyph, VENUE_GLYPHS } from "@/lib/sport-icons";
import { SPORTS } from "@/lib/sports";
import { lobbySlots, type LobbyWithMeta } from "@/lib/types";
import { VENUE_KIND_IDS, VENUE_KINDS, venueTitle, type Venue, type VenueKind } from "@/lib/venues";

const PITCH_3D = 58;
const BEARING_3D = -18;
const CITY_ZOOM = 15.2;
const MIN_START_ZOOM = 14.1;
const MAX_START_ZOOM = 15.6;

export interface MapPoint {
  lat: number;
  lng: number;
}

/** Несколько игр на одной площадке: раскладываем пины по небольшому кругу, чтобы все были видны. */
function spreadPins(lobbies: LobbyWithMeta[]) {
  const groups = new Map<string, LobbyWithMeta[]>();
  for (const l of lobbies) {
    const key = `${l.lat!.toFixed(4)}:${l.lng!.toFixed(4)}`;
    groups.set(key, [...(groups.get(key) ?? []), l]);
  }
  const out = new Map<string, [number, number]>();
  for (const list of groups.values()) {
    list.forEach((l, i) => {
      if (list.length === 1) {
        out.set(l.id, [l.lng!, l.lat!]);
        return;
      }
      const angle = (2 * Math.PI * i) / list.length;
      const radius = 0.00022;
      out.set(l.id, [l.lng! + (radius * Math.cos(angle)) / Math.cos((l.lat! * Math.PI) / 180), l.lat! + radius * Math.sin(angle)]);
    });
  }
  return out;
}

function pinElement(lobby: LobbyWithMeta, onSelect: (id: string) => void) {
  const { free } = lobbySlots(lobby);
  const sport = SPORTS[lobby.sport];
  const el = document.createElement("button");
  el.type = "button";
  el.className = "map-pin";
  el.setAttribute("aria-label", `${sport?.label ?? "Игра"}, ${lobby.location_name}, ${free > 0 ? `свободно мест: ${free}` : "мест нет"}`);

  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("fill", "none");
  icon.setAttribute("stroke", "currentColor");
  icon.setAttribute("stroke-width", "1.9");
  icon.setAttribute("stroke-linecap", "round");
  icon.setAttribute("stroke-linejoin", "round");
  icon.setAttribute("aria-hidden", "true");
  for (const d of GLYPHS[sportGlyph(lobby.sport)]) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    icon.append(path);
  }
  const count = document.createElement("span");
  count.className = "map-pin-count";
  count.textContent = free > 0 ? `+${free}` : "✕";
  el.append(icon, count);
  if (free === 0) el.classList.add("map-pin-full");

  el.addEventListener("click", (e) => {
    e.stopPropagation();
    onSelect(lobby.id);
  });
  return el;
}

const VENUE_SOURCE = "venues";
const VENUE_LAYERS = {
  clusters: "venue-clusters",
  count: "venue-cluster-count",
  selected: "venue-selected",
  points: "venue-points",
};

/** Круглый значок площадки: цвет и эмодзи своего типа. */
function venueIcon(kind: VenueKind) {
  const size = 72;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2);
  ctx.fillStyle = VENUE_KINDS[kind].color;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();
  // Тот же линейный значок, что и в интерфейсе
  const glyphSize = 38;
  ctx.translate((size - glyphSize) / 2, (size - glyphSize) / 2);
  ctx.scale(glyphSize / 24, glyphSize / 24);
  ctx.lineWidth = 1.9;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const d of GLYPHS[VENUE_GLYPHS[kind]]) ctx.stroke(new Path2D(d));
  return ctx.getImageData(0, 0, size, size);
}

function venuesGeoJson(venues: Venue[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: venues.map((v) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [v.lng, v.lat] },
      properties: { id: v.id, kind: v.k, title: v.n ? venueTitle(v) : "" },
    })),
  };
}

function addVenueLayers(map: MapLibreMap, dark: boolean) {
  for (const kind of VENUE_KIND_IDS) {
    const name = `venue-${kind}`;
    if (!map.hasImage(name)) map.addImage(name, venueIcon(kind), { pixelRatio: 2 });
  }
  if (map.getSource(VENUE_SOURCE)) return;

  map.addSource(VENUE_SOURCE, {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
    cluster: true,
    clusterRadius: 42,
    clusterMaxZoom: 14,
  });
  map.addLayer({
    id: VENUE_LAYERS.clusters,
    type: "circle",
    source: VENUE_SOURCE,
    filter: ["has", "point_count"],
    paint: {
      "circle-color": dark ? "#2c2c2e" : "#ffffff",
      "circle-opacity": 0.94,
      "circle-radius": ["step", ["get", "point_count"], 13, 10, 15, 40, 18],
      "circle-stroke-color": dark ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.12)",
      "circle-stroke-width": 0.5,
    },
  });
  map.addLayer({
    id: VENUE_LAYERS.count,
    type: "symbol",
    source: VENUE_SOURCE,
    filter: ["has", "point_count"],
    layout: {
      "text-field": ["get", "point_count_abbreviated"],
      "text-font": ["Noto Sans Bold"],
      "text-size": 12,
      "text-allow-overlap": true,
    },
    paint: { "text-color": dark ? "#ffffff" : "#1c1c1e" },
  });
  map.addLayer({
    id: VENUE_LAYERS.selected,
    type: "circle",
    source: VENUE_SOURCE,
    filter: ["==", ["get", "id"], ""],
    paint: { "circle-radius": 25, "circle-color": "#007aff", "circle-opacity": 0.3, "circle-stroke-color": "#007aff", "circle-stroke-width": 3 },
  });
  map.addLayer({
    id: VENUE_LAYERS.points,
    type: "symbol",
    source: VENUE_SOURCE,
    filter: ["!", ["has", "point_count"]],
    layout: {
      "icon-image": ["concat", "venue-", ["get", "kind"]],
      "icon-size": ["interpolate", ["linear"], ["zoom"], 14, 0.58, 16, 0.78, 18, 1],
      "icon-allow-overlap": true,
      "text-field": ["step", ["zoom"], "", 16.2, ["get", "title"]],
      "text-font": ["Noto Sans Bold"],
      "text-size": 11,
      "text-offset": [0, 1.4],
      "text-anchor": "top",
      "text-optional": true,
      "text-max-width": 9,
    },
    paint: {
      "text-color": dark ? "#f2f2f7" : "#111111",
      "text-halo-color": dark ? "#000000" : "#ffffff",
      "text-halo-width": 1.6,
    },
  });
}

export default function CityMap3D({
  center,
  lobbies,
  selectedId,
  onSelect,
  venues,
  selectedVenueId,
  onSelectVenue,
  showVenues,
  userPos,
  is3D,
  recenter,
  onFail,
}: {
  center: MapPoint;
  /** Только игры с точкой на карте */
  lobbies: LobbyWithMeta[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  venues: Venue[];
  selectedVenueId: string | null;
  onSelectVenue: (id: string | null) => void;
  showVenues: boolean;
  userPos: MapPoint | null;
  is3D: boolean;
  /** Увеличивается, когда нужно снова показать пользователя */
  recenter: number;
  onFail: () => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markers = useRef(new Map<string, { marker: Marker; el: HTMLElement }>());
  const userMarker = useRef<Marker | null>(null);
  const framed = useRef(false);
  const selectRef = useRef(onSelect);
  const failRef = useRef(onFail);
  const lobbiesRef = useRef(lobbies);
  const selectVenueRef = useRef(onSelectVenue);
  const venuesRef = useRef(venues);
  const showVenuesRef = useRef(showVenues);
  const venuesReady = useRef(false);
  const selectedVenueRef = useRef(selectedVenueId);
  const dark = useDarkMode();
  const darkRef = useRef(dark);

  useEffect(() => {
    selectedVenueRef.current = selectedVenueId;
    selectRef.current = onSelect;
    failRef.current = onFail;
    lobbiesRef.current = lobbies;
    selectVenueRef.current = onSelectVenue;
    venuesRef.current = venues;
    showVenuesRef.current = showVenues;
  });

  // Создаём карту один раз
  useEffect(() => {
    if (!container.current) return;
    const pins = markers.current;
    let map: MapLibreMap;
    try {
      map = new maplibregl.Map({
        container: container.current,
        style: MAP_STYLE,
        center: [center.lng, center.lat],
        zoom: CITY_ZOOM,
        pitch: PITCH_3D,
        bearing: BEARING_3D,
        maxPitch: 75,
        attributionControl: false,
      });
    } catch {
      failRef.current();
      return;
    }
    mapRef.current = map;
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");

    const failTimer = setTimeout(() => {
      if (!map.isStyleLoaded()) failRef.current();
    }, 15000);

    map.on("style.load", () => {
      clearTimeout(failTimer);
      applyRussianLabels(map);
      if (darkRef.current) applyDarkPalette(map);
      else if (map.getLayer("building-3d")) map.setPaintProperty("building-3d", "fill-extrusion-opacity", 0.92);

      addVenueLayers(map, darkRef.current);
      venuesReady.current = true;
      map.setFilter(VENUE_LAYERS.selected, ["==", ["get", "id"], selectedVenueRef.current ?? ""]);
      (map.getSource(VENUE_SOURCE) as GeoJSONSource).setData(venuesGeoJson(venuesRef.current));
      for (const id of Object.values(VENUE_LAYERS)) {
        map.setLayoutProperty(id, "visibility", showVenuesRef.current ? "visible" : "none");
      }
    });

    map.on("load", () => {
      if (framed.current) return;
      framed.current = true;
      // Подпись авторов карты свёрнута в значок «i», по нажатию раскрывается
      const collapseAttribution = () => {
        const attribution = map.getContainer().querySelector(".maplibregl-ctrl-attrib");
        attribution?.classList.remove("maplibregl-compact-show");
        attribution?.removeAttribute("open");
      };
      collapseAttribution();
      map.once("idle", collapseAttribution);
      const points = lobbiesRef.current;
      if (points.length === 0) return;
      const bounds = new maplibregl.LngLatBounds();
      for (const l of points) bounds.extend([l.lng!, l.lat!]);
      // Показываем все игры, но не отдаляемся настолько, чтобы пропали объёмные здания
      const { clientHeight, clientWidth } = map.getContainer();
      const camera = map.cameraForBounds(bounds, {
        padding: {
          top: Math.min(170, clientHeight * 0.25),
          bottom: Math.min(290, clientHeight * 0.38),
          left: Math.min(50, clientWidth * 0.12),
          right: Math.min(70, clientWidth * 0.16),
        },
        maxZoom: MAX_START_ZOOM,
        bearing: BEARING_3D,
      });
      map.jumpTo({
        center: camera?.center ?? bounds.getCenter(),
        // Наклонённая камера видит дальний край хуже, поэтому немного отдаляем
        zoom: Math.max(MIN_START_ZOOM, (camera?.zoom ?? MAX_START_ZOOM) - 0.35),
        pitch: PITCH_3D,
        bearing: BEARING_3D,
      });
    });

    map.on("click", async (e) => {
      if (venuesReady.current && showVenuesRef.current) {
        // Палец шире значка: ищем площадку в небольшом квадрате вокруг нажатия
        const box: [[number, number], [number, number]] = [
          [e.point.x - 14, e.point.y - 14],
          [e.point.x + 14, e.point.y + 14],
        ];
        const [feature] = map.queryRenderedFeatures(box, { layers: [VENUE_LAYERS.points, VENUE_LAYERS.clusters] });
        if (feature?.properties?.cluster_id != null) {
          const source = map.getSource(VENUE_SOURCE) as GeoJSONSource;
          const zoom = await source.getClusterExpansionZoom(feature.properties.cluster_id as number);
          map.easeTo({ center: (feature.geometry as GeoJSON.Point).coordinates as [number, number], zoom: zoom + 0.2, duration: 500 });
          return;
        }
        if (feature?.properties?.id) {
          selectVenueRef.current(feature.properties.id as string);
          return;
        }
      }
      selectRef.current(null);
      selectVenueRef.current(null);
    });
    for (const layer of [VENUE_LAYERS.points, VENUE_LAYERS.clusters]) {
      map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
    }
    map.on("webglcontextlost", () => failRef.current());

    return () => {
      clearTimeout(failTimer);
      pins.clear();
      userMarker.current = null;
      venuesReady.current = false;
      map.remove();
      mapRef.current = null;
    };
    // Город меняется через key у компонента, поэтому центр читаем только при создании
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Тема устройства поменялась: слои площадок пересоздаст обработчик style.load
  useEffect(() => {
    if (darkRef.current === dark) return;
    darkRef.current = dark;
    venuesReady.current = false;
    mapRef.current?.setStyle(MAP_STYLE, { diff: false });
  }, [dark]);

  // Пины игр
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const positions = spreadPins(lobbies);
    const current = markers.current;

    for (const [id, item] of current) {
      if (!positions.has(id)) {
        item.marker.remove();
        current.delete(id);
      }
    }
    for (const lobby of lobbies) {
      const position = positions.get(lobby.id)!;
      const existing = current.get(lobby.id);
      if (existing) {
        existing.marker.setLngLat(position);
        continue;
      }
      const el = pinElement(lobby, (id) => selectRef.current(id));
      const marker = new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat(position).addTo(map);
      current.set(lobby.id, { marker, el });
    }
  }, [lobbies]);

  // Выбранная игра: выделяем пин и подводим к нему камеру
  useEffect(() => {
    for (const [id, { el }] of markers.current) el.classList.toggle("map-pin-selected", id === selectedId);
    const map = mapRef.current;
    const item = selectedId ? markers.current.get(selectedId) : null;
    if (!map || !item) return;
    map.easeTo({
      center: item.marker.getLngLat(),
      zoom: Math.max(map.getZoom(), 15.8),
      // Пин остаётся выше карточек игр
      offset: [0, -Math.min(120, map.getContainer().clientHeight * 0.14)],
      duration: 800,
    });
  }, [selectedId]);

  // Площадки: данные, видимость и выбранная
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !venuesReady.current) return;
    (map.getSource(VENUE_SOURCE) as GeoJSONSource).setData(venuesGeoJson(venues));
  }, [venues]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !venuesReady.current) return;
    for (const id of Object.values(VENUE_LAYERS)) map.setLayoutProperty(id, "visibility", showVenues ? "visible" : "none");
  }, [showVenues]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !venuesReady.current) return;
    map.setFilter(VENUE_LAYERS.selected, ["==", ["get", "id"], selectedVenueId ?? ""]);
    const venue = selectedVenueId ? venuesRef.current.find((v) => v.id === selectedVenueId) : null;
    if (!venue) return;
    map.easeTo({
      center: [venue.lng, venue.lat],
      zoom: Math.max(map.getZoom(), 16),
      offset: [0, -Math.min(120, map.getContainer().clientHeight * 0.14)],
      duration: 800,
    });
  }, [selectedVenueId]);

  // Точка пользователя: координаты остаются на устройстве
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userPos) return;
    if (!userMarker.current) {
      const el = document.createElement("div");
      el.className = "map-user-dot";
      el.setAttribute("aria-label", "Вы здесь");
      userMarker.current = new maplibregl.Marker({ element: el }).setLngLat([userPos.lng, userPos.lat]).addTo(map);
    } else {
      userMarker.current.setLngLat([userPos.lng, userPos.lat]);
    }
  }, [userPos]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userPos || recenter === 0) return;
    map.flyTo({ center: [userPos.lng, userPos.lat], zoom: 15.6, offset: [0, -70], speed: 1.2 });
    // Реагируем только на нажатие кнопки
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenter]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo(is3D ? { pitch: PITCH_3D, bearing: BEARING_3D, duration: 600 } : { pitch: 0, bearing: 0, duration: 600 });
  }, [is3D]);

  return <div ref={container} className="city-map size-full" role="application" aria-label="Карта города с играми" />;
}
