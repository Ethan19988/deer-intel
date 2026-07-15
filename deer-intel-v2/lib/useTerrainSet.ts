"use client";

import { useEffect, useState } from "react";
import { resolveTerrainSet } from "@/lib/terrainMovementData";
import type { TerrainMovementSet } from "@/lib/terrainMovement";

// Resolve the terrain-prediction set for a property location:
//   1. a pipeline-generated 1 m set if one covers this ground (best), else
//   2. a live read fetched from /api/terrain (USGS 10 m), computed on demand.
// Results are cached per rounded coordinate so panning/revisiting is instant and
// each property is fetched at most once per session.

const liveCache = new Map<string, TerrainMovementSet | null>();

type Point = { lat: number; lng: number };
export type TerrainBbox = {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
};

export function useTerrainSet(
  point: Point | null | undefined,
  areaName?: string,
  bbox?: TerrainBbox | null,
): TerrainMovementSet | null {
  const staticSet = point ? resolveTerrainSet(point) : null;
  // Only fetch live when no built-in/generated set already covers the point.
  const bboxKey = bbox
    ? `|${bbox.minLat.toFixed(4)},${bbox.minLng.toFixed(4)},${bbox.maxLat.toFixed(4)},${bbox.maxLng.toFixed(4)}`
    : "";
  const key =
    point && !staticSet
      ? `${point.lat.toFixed(4)},${point.lng.toFixed(4)}${bboxKey}`
      : "";

  const [live, setLive] = useState<TerrainMovementSet | null>(() =>
    key && liveCache.has(key) ? (liveCache.get(key) ?? null) : null,
  );

  useEffect(() => {
    if (!key || !point) {
      setLive(null);
      return;
    }
    if (liveCache.has(key)) {
      setLive(liveCache.get(key) ?? null);
      return;
    }

    let active = true;
    const params = new URLSearchParams({
      lat: String(point.lat),
      lng: String(point.lng),
      name: areaName || "This property",
    });
    if (bbox) {
      params.set("minLat", String(bbox.minLat));
      params.set("minLng", String(bbox.minLng));
      params.set("maxLat", String(bbox.maxLat));
      params.set("maxLng", String(bbox.maxLng));
    }

    fetch(`/api/terrain?${params.toString()}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { set?: TerrainMovementSet | null } | null) => {
        const set = data?.set ?? null;
        liveCache.set(key, set);
        if (active) setLive(set);
      })
      .catch(() => {
        if (active) setLive(null);
      });

    return () => {
      active = false;
    };
    // point is captured via `key`; areaName only affects the payload label.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, areaName]);

  return staticSet ?? (key ? live : null);
}

/** Center of a bounding box — the anchor for a drawn hunt area. */
export function centerOfBounds(bbox: TerrainBbox): Point {
  return {
    lat: (bbox.minLat + bbox.maxLat) / 2,
    lng: (bbox.minLng + bbox.maxLng) / 2,
  };
}

/** Bounding box of a drawn hunt-area polygon, or null if it isn't a real area. */
export function boundsOfHuntArea(
  points: Array<{ lat: number; lng: number }> | undefined | null,
): TerrainBbox | null {
  if (!points || points.length < 3) return null;
  let minLat = Infinity;
  let minLng = Infinity;
  let maxLat = -Infinity;
  let maxLng = -Infinity;
  for (const p of points) {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng);
    maxLng = Math.max(maxLng, p.lng);
  }
  if (!Number.isFinite(minLat) || maxLat <= minLat || maxLng <= minLng) {
    return null;
  }
  return { minLat, minLng, maxLat, maxLng };
}
