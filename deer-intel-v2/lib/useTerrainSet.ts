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

export function useTerrainSet(
  point: Point | null | undefined,
  areaName?: string,
): TerrainMovementSet | null {
  const staticSet = point ? resolveTerrainSet(point) : null;
  // Only fetch live when no built-in/generated set already covers the point.
  const key =
    point && !staticSet
      ? `${point.lat.toFixed(4)},${point.lng.toFixed(4)}`
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
