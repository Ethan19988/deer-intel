"use client";

import { useEffect, useState } from "react";
import {
  MOVEMENT_GRID_LIMITS,
  M_PER_DEG,
  bboxSizeM,
  type GridBbox,
} from "@/lib/landcover";
import type { LatLng, MovementGrid } from "@/lib/movementGridTypes";
import { boundsOfHuntArea, centerOfBounds } from "@/lib/useTerrainSet";
import type { Property } from "@/types/property";

// Browser side of /api/movement-grid: a fetch helper and a hook that resolves
// one property's grid (hunt-area bbox if drawn, else its saved coordinate),
// cached in memory and in sessionStorage so revisits within the tab are free.

export type MovementGridStatus = "idle" | "loading" | "ready" | "error";

const SESSION_PREFIX = "deer-intel:movement-grid:v1:";
const memory = new Map<string, MovementGrid>();

/** Fetch a grid for a point (and optional bbox). Throws on any failure. */
export async function fetchMovementGrid(
  point: LatLng,
  bbox?: GridBbox | null,
  signal?: AbortSignal,
): Promise<MovementGrid> {
  const params = new URLSearchParams({ lat: String(point.lat), lng: String(point.lng) });
  if (bbox) {
    params.set("minLat", String(bbox.minLat));
    params.set("minLng", String(bbox.minLng));
    params.set("maxLat", String(bbox.maxLat));
    params.set("maxLng", String(bbox.maxLng));
  }
  const res = await fetch(`/api/movement-grid?${params.toString()}`, { signal });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || `Movement grid request failed (${res.status}).`);
  }
  const body = (await res.json()) as { grid?: unknown };
  const grid = reviveMovementGrid(body.grid);
  if (!grid) throw new Error("Movement grid response was malformed.");
  return grid;
}

/**
 * Check a JSON grid's shape and restore what JSON loses: null elevations back
 * to NaN, null land-cover cells to 0. Returns null if it isn't a MovementGrid.
 */
export function reviveMovementGrid(value: unknown): MovementGrid | null {
  if (!value || typeof value !== "object") return null;
  const g = value as Record<string, unknown>;
  const origin = g.origin as { lat?: unknown; lng?: unknown } | undefined;
  const rows = g.rows;
  const cols = g.cols;
  if (
    !origin || typeof origin.lat !== "number" || typeof origin.lng !== "number" ||
    typeof g.cellM !== "number" || typeof g.cellLat !== "number" ||
    typeof g.cellLng !== "number" || typeof rows !== "number" || typeof cols !== "number" ||
    !Array.isArray(g.elevation) || g.elevation.length !== rows * cols
  ) {
    return null;
  }
  const landcover =
    Array.isArray(g.landcover) && g.landcover.length === rows * cols
      ? g.landcover.map((v) => (typeof v === "number" ? v : 0))
      : undefined;
  return {
    origin: { lat: origin.lat, lng: origin.lng },
    cellM: g.cellM,
    cellLat: g.cellLat,
    cellLng: g.cellLng,
    rows,
    cols,
    elevation: g.elevation.map((v) => (typeof v === "number" ? v : NaN)),
    ...(landcover ? { landcover } : {}),
    source: typeof g.source === "string" ? g.source : "",
  };
}

/**
 * Shrink a bbox about its center so neither side exceeds the API's limit — a
 * huge drawn outline still gets a read of its middle instead of a 400.
 */
export function clampGridBbox(bbox: GridBbox): GridBbox {
  const max = MOVEMENT_GRID_LIMITS.maxSideM * 0.99;
  const { heightM, widthM } = bboxSizeM(bbox);
  if (heightM <= max && widthM <= max) return bbox;
  const c = centerOfBounds(bbox);
  const halfLat = (Math.min(heightM, max) / 2) / M_PER_DEG;
  const halfLng = (Math.min(widthM, max) / 2) / (M_PER_DEG * Math.cos((c.lat * Math.PI) / 180));
  return { minLat: c.lat - halfLat, minLng: c.lng - halfLng, maxLat: c.lat + halfLat, maxLng: c.lng + halfLng };
}

type PropertyLike = Pick<Property, "latitude" | "longitude" | "huntArea"> | null | undefined;

/** What to request for a property: hunt-area bbox first, else its coordinate. */
export function movementGridRequestFor(
  property: PropertyLike,
): { point: LatLng; bbox: GridBbox | null; key: string } | null {
  if (!property) return null;
  const area = boundsOfHuntArea(property.huntArea);
  if (area) {
    const bbox = clampGridBbox(area);
    return {
      point: centerOfBounds(bbox),
      bbox,
      key: [bbox.minLat, bbox.minLng, bbox.maxLat, bbox.maxLng].map((v) => v.toFixed(5)).join(","),
    };
  }
  const { latitude: lat, longitude: lng } = property;
  if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  return { point: { lat, lng }, bbox: null, key: `${lat.toFixed(4)},${lng.toFixed(4)}` };
}

function readSession(key: string): MovementGrid | null {
  try {
    const raw = window.sessionStorage.getItem(SESSION_PREFIX + key);
    return raw ? reviveMovementGrid(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function writeSession(key: string, grid: MovementGrid): void {
  try {
    window.sessionStorage.setItem(SESSION_PREFIX + key, JSON.stringify(grid));
  } catch {
    // Quota, private mode, or storage disabled — memory cache still works.
  }
}

function cachedGrid(key: string): MovementGrid | null {
  const hit = memory.get(key);
  if (hit) return hit;
  const stored = readSession(key);
  if (stored) memory.set(key, stored);
  return stored;
}

/** The property's movement grid, fetched once per tab per ground. */
export function useMovementGrid(property: PropertyLike): {
  grid: MovementGrid | null;
  status: MovementGridStatus;
} {
  const req = movementGridRequestFor(property);
  const key = req?.key ?? "";

  const [state, setState] = useState<{ key: string; grid: MovementGrid | null; status: MovementGridStatus }>(
    { key: "", grid: null, status: "idle" },
  );

  useEffect(() => {
    if (!req) {
      setState({ key: "", grid: null, status: "idle" });
      return;
    }
    const hit = cachedGrid(req.key);
    if (hit) {
      setState({ key: req.key, grid: hit, status: "ready" });
      return;
    }
    const controller = new AbortController();
    setState({ key: req.key, grid: null, status: "loading" });
    fetchMovementGrid(req.point, req.bbox, controller.signal)
      .then((grid) => {
        memory.set(req.key, grid);
        writeSession(req.key, grid);
        if (!controller.signal.aborted) setState({ key: req.key, grid, status: "ready" });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ key: req.key, grid: null, status: "error" });
      });
    return () => controller.abort();
    // req is derived from `key`; re-run only when the ground changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Until the effect catches up with a new property, don't show the old grid.
  if (!req) return { grid: null, status: "idle" };
  if (state.key !== key) {
    const hit = memory.get(key);
    return hit ? { grid: hit, status: "ready" } : { grid: null, status: "loading" };
  }
  return { grid: state.grid, status: state.status };
}
