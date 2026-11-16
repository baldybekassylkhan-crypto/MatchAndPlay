"use client";

import dynamic from "next/dynamic";

// Leaflet работает только в браузере.
export const MapView = dynamic(() => import("@/components/map/LeafletMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-surface-2" />,
});

export type { LatLng } from "@/components/map/LeafletMap";
