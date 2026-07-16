"use client";

import { useSyncExternalStore } from "react";
import {
  MAP_LAYER_BY_ID,
  MAP_OVERLAYS,
  type MapLayerId,
  type MapOverlayId,
  type MapOverlayState,
} from "@/lib/propertyMap";

// The base map layer the map opens on. Device-local (its own localStorage key,
// like the theme and units), since which base map reads best is a per-device
// preference and not something to sync. A ?layer= URL param still wins for that
// visit (e.g. the sidebar's LiDAR shortcut).
const MAP_LAYER_STORAGE_KEY = "deer-intel:default-map-layer";

// Which data overlays the map opens with. Same device-local reasoning as the
// base layer: a hunter who always scouts with contours and slope on shouldn't
// re-toggle them every visit.
const MAP_OVERLAYS_STORAGE_KEY = "deer-intel:default-map-overlays";

export const DEFAULT_MAP_LAYER: MapLayerId = "hybrid";

// Everything off, matching how the map behaved before this was configurable.
export const DEFAULT_MAP_OVERLAYS: MapOverlayState = {
  contours: false,
  slope: false,
  propertyLines: false,
  wind: false,
  movement: false,
  terrain: false,
};

function isMapLayerId(value: unknown): value is MapLayerId {
  return typeof value === "string" && value in MAP_LAYER_BY_ID;
}

let cachedRaw: string | null = null;
let cachedLayer: MapLayerId = DEFAULT_MAP_LAYER;
let cachedOverlayRaw: string | null = null;
let cachedOverlays: MapOverlayState = DEFAULT_MAP_OVERLAYS;

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

/**
 * The saved default overlay state, merged over the defaults so an overlay added
 * later (or a partial/corrupt payload) still resolves to a complete record.
 * Returns a cached object while the stored string is unchanged, which keeps the
 * useSyncExternalStore snapshot referentially stable.
 */
export function readDefaultMapOverlays(): MapOverlayState {
  if (typeof window === "undefined") return DEFAULT_MAP_OVERLAYS;

  let raw: string | null;
  try {
    raw = window.localStorage.getItem(MAP_OVERLAYS_STORAGE_KEY);
  } catch {
    return DEFAULT_MAP_OVERLAYS;
  }

  if (raw === cachedOverlayRaw) return cachedOverlays;

  cachedOverlayRaw = raw;
  cachedOverlays = parseOverlays(raw);
  return cachedOverlays;
}

function parseOverlays(raw: string | null): MapOverlayState {
  if (!raw) return DEFAULT_MAP_OVERLAYS;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return DEFAULT_MAP_OVERLAYS;
  }

  if (!parsed || typeof parsed !== "object") return DEFAULT_MAP_OVERLAYS;

  const record = parsed as Record<string, unknown>;
  const next = { ...DEFAULT_MAP_OVERLAYS };

  for (const overlay of MAP_OVERLAYS) {
    if (typeof record[overlay.id] === "boolean") {
      next[overlay.id] = record[overlay.id] as boolean;
    }
  }

  return next;
}

const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

export function setDefaultMapOverlay(
  overlayId: MapOverlayId,
  enabled: boolean,
): void {
  const next = { ...readDefaultMapOverlays(), [overlayId]: enabled };
  const raw = JSON.stringify(next);

  cachedOverlayRaw = raw;
  cachedOverlays = next;

  try {
    window.localStorage.setItem(MAP_OVERLAYS_STORAGE_KEY, raw);
  } catch {
    // Ignore write failures (private mode / quota); the cached value still
    // applies for this session.
  }

  notifyListeners();
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

// Both map preferences share one listener set and one storage handler: a change
// to either key notifies every hook, and the ones whose snapshot didn't change
// bail out on the === check for free.
function subscribe(listener: () => void) {
  listeners.add(listener);

  function handleStorage(event: StorageEvent) {
    // key === null means the whole store was cleared, so drop both caches.
    if (event.key === null) {
      cachedRaw = null;
      cachedOverlayRaw = null;
    } else if (event.key === MAP_LAYER_STORAGE_KEY) {
      cachedRaw = null;
    } else if (event.key === MAP_OVERLAYS_STORAGE_KEY) {
      cachedOverlayRaw = null;
    } else {
      return;
    }

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

function getOverlaysSnapshot(): MapOverlayState {
  return readDefaultMapOverlays();
}

function getOverlaysServerSnapshot(): MapOverlayState {
  return DEFAULT_MAP_OVERLAYS;
}

export function useDefaultMapOverlays(): MapOverlayState {
  return useSyncExternalStore(
    subscribe,
    getOverlaysSnapshot,
    getOverlaysServerSnapshot,
  );
}
