"use client";

import { useSyncExternalStore } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";

// Бесплатные векторные карты OpenFreeMap (данные OpenStreetMap), без ключа API
export const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

const QUERY = "(prefers-color-scheme: dark)";

function subscribe(onChange: () => void) {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

/** Тема устройства: карта переключается вместе с приложением. */
export function useDarkMode() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false);
}

/** Подписи на русском, если они есть в данных. */
export function applyRussianLabels(map: MapLibreMap) {
  for (const layer of map.getStyle().layers) {
    if (layer.type === "symbol" && layer.layout?.["text-field"]) {
      map.setLayoutProperty(layer.id, "text-field", ["coalesce", ["get", "name:ru"], ["get", "name"], ["get", "name:latin"]]);
    }
  }
}

/** Собственная тёмная палитра: сине-серый город, приглушённые парки и вода, читаемые дороги. */
const DARK = {
  ground: "#1b2029",
  residential: "#1e232d",
  institution: "#222834",
  park: "#1f302b",
  wood: "#1c2c28",
  pitch: "#21372f",
  sand: "#2a2b2c",
  ice: "#2a3140",
  water: "#16283c",
  waterway: "#1a3048",
  airport: "#2a3040",
  casing: "#141820",
  motorway: "#6f7b92",
  primary: "#5a6579",
  secondary: "#485264",
  street: "#3a4250",
  service: "#303744",
  path: "#343c4a",
  rail: "#3b4351",
  building: "#2a303c",
  buildingEdge: "#363d4b",
  building3d: "#343b49",
  boundary: "#4b5467",
  label: "#c6cedb",
  labelStrong: "#e4e9f1",
  labelWater: "#7295ba",
  labelPoi: "#a3aebd",
  halo: "#161a22",
};

function fillColor(id: string) {
  if (id === "park") return DARK.park;
  if (id === "landcover_wood") return DARK.wood;
  if (id === "landcover_grass") return DARK.park;
  if (id === "landcover_ice") return DARK.ice;
  if (id === "landcover_sand") return DARK.sand;
  if (id === "landuse_residential") return DARK.residential;
  if (id === "landuse_pitch") return DARK.pitch;
  if (id === "water") return DARK.water;
  if (id === "aeroway_fill") return DARK.airport;
  if (id === "building") return DARK.building;
  return DARK.institution;
}

function lineColor(id: string) {
  if (id.includes("casing")) return DARK.casing;
  if (id.startsWith("waterway")) return DARK.waterway;
  if (id.startsWith("aeroway")) return DARK.airport;
  if (id.startsWith("boundary")) return DARK.boundary;
  if (id === "park_outline") return DARK.park;
  if (id.includes("rail")) return DARK.rail;
  if (id.includes("motorway")) return DARK.motorway;
  if (id.includes("trunk_primary")) return DARK.primary;
  if (id.includes("secondary_tertiary")) return DARK.secondary;
  if (id.includes("service_track")) return DARK.service;
  if (id.includes("path_pedestrian")) return DARK.path;
  return DARK.street;
}

function labelColor(id: string) {
  if (id.startsWith("water")) return DARK.labelWater;
  if (id.startsWith("poi") || id === "airport") return DARK.labelPoi;
  if (id === "highway-name-major" || id.startsWith("label_city") || id.startsWith("label_country")) return DARK.labelStrong;
  return DARK.label;
}

/** Перекрашивает загруженный стиль: подробность карты и объёмные здания остаются теми же. */
export function applyDarkPalette(map: MapLibreMap) {
  for (const layer of map.getStyle().layers) {
    const { id } = layer;
    if (id === "natural_earth" || id === "road_area_pattern" || id === "landcover_wetland" || id.includes("shield")) {
      map.setLayoutProperty(id, "visibility", "none");
    } else if (layer.type === "background") {
      map.setPaintProperty(id, "background-color", DARK.ground);
    } else if (layer.type === "fill") {
      map.setPaintProperty(id, "fill-color", fillColor(id));
      if (id === "building") map.setPaintProperty(id, "fill-outline-color", DARK.buildingEdge);
      if (id === "park") map.setPaintProperty(id, "fill-outline-color", DARK.park);
    } else if (layer.type === "line") {
      map.setPaintProperty(id, "line-color", lineColor(id));
    } else if (layer.type === "fill-extrusion") {
      map.setPaintProperty(id, "fill-extrusion-color", DARK.building3d);
      map.setPaintProperty(id, "fill-extrusion-opacity", 0.94);
    } else if (layer.type === "symbol") {
      if (layer.layout?.["text-field"]) {
        map.setPaintProperty(id, "text-color", labelColor(id));
        map.setPaintProperty(id, "text-halo-color", DARK.halo);
        map.setPaintProperty(id, "text-halo-width", 1.3);
      }
      if (layer.layout?.["icon-image"]) map.setPaintProperty(id, "icon-opacity", id.startsWith("road_one_way") ? 0.22 : 0.72);
    }
  }
}
