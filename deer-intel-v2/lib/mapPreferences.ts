"use client";

import { useSyncExternalStore } from "react";
import { MAP_LAYER_BY_ID, type MapLayerId } from "@/lib/propertyMap";

// The base map layer the map opens on. Device-local (its own localStorage key,
// like the theme and units), since which base map reads best is a per-device
// preference and not something to sync. A ?layer= URL param still wins for that
// visit (e.g. the sidebar's LiDAR shortcut).
const MAP_LAYER_STORAGE_KEY = "deer-intel:default-map-layer";

export const DEFAULT_MAP_LAYER: MapLayerId = "hybrid";

function isMapLayerId(value: unknown): value is MapLayerId {
  return typeof value === "string" && value in MAP_LAYER_BY_ID;
}

let cachedRaw: string | null = null;
let cachedLayer: MapLayerId = DEFAULT_MAP_LAYER;

export function readDefaultMapLayer(): MapLayerId {
  if (typeof window === "undefined") return DEFAULT_MAP_LAYER;

  let raw: string | null;
  try {
    raw = window.localStorage.getItem(MAP_LAYER_STORAGE_KEY);
  } catch {
    return DEFAULT_MAP_LAYER;
  }

  if (raw === cachedRaw) return cachedLayer;

  cachedRaw = raw;
  cachedLayer = isMapLayerId(raw) ? raw : DEFAULT_MAP_LAYER;
  return cachedLayer;
}

const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

export function setDefaultMapLayer(layer: MapLayerId): void {
  cachedRaw = layer;
  cachedLayer = layer;

  try {
    window.localStorage.setItem(MAP_LAYER_STORAGE_KEY, layer);
  } catch {
    // Ignore write failures (private mode / quota); the cached value still
    // applies for this session.
  }

  notifyListeners();
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  function handleStorage(event: StorageEvent) {
    if (event.key !== MAP_LAYER_STORAGE_KEY && event.key !== null) return;
    cachedRaw = null;
    notifyListeners();
  }

  window.addEventListener("storage", handleStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", handleStorage);
  };
}

function getSnapshot(): MapLayerId {
  return readDefaultMapLayer();
}

function getServerSnapshot(): MapLayerId {
  return DEFAULT_MAP_LAYER;
}

export function useDefaultMapLayer(): MapLayerId {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
