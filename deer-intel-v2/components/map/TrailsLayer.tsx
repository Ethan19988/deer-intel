"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { Polyline, Tooltip, useMap, useMapEvents } from "react-leaflet";
import {
  TRAILS_MIN_ZOOM,
  TRAILS_OVERPASS_ENDPOINTS,
} from "@/lib/propertyMap";

type TrailsLayerProps = {
  enabled: boolean;
  /**
   * Bubbles a one-line status ("Zoom in…", "Finding trails…", "No mapped
   * trails…") up to the map's shared notice bar, or null when there's nothing
   * to say. Mirrors how the parcel layer reports its state.
   */
  onStatus?: (message: string | null) => void;
};

// Foot-only ways vs. drivable-by-nothing-but-a-quad tracks. Split so the eye can
// tell a two-track logging road from a deer-trail footpath at a glance.
type TrailKind = "foot" | "track";

type Trail = {
  id: number;
  kind: TrailKind;
  label: string;
  detail: string;
  positions: Array<[number, number]>;
};

// Amber for foot paths, saddle-brown for tracks — both warm and legible over
// green/gray satellite, and clear of the blaze-orange used for pins/overlays.
const FOOT_COLOR = "#f2c14e";
const TRACK_COLOR = "#c98a3c";
const CASING_COLOR = "rgba(20, 24, 18, 0.55)";

const DEBOUNCE_MS = 500;
const OVERPASS_TIMEOUT_S = 25;
// Give each mirror this long before we give up on it and try the next one, so a
// hung endpoint can't leave the layer stuck on "Finding trails…" forever.
const PER_ENDPOINT_TIMEOUT_MS = 12000;

// Every OSM highway class you travel on foot, not by vehicle:
//  - track      unpaved dirt / two-track / old logging roads (often gated)
//  - path       the catch-all trail, incl. informal deer/social trails
//  - footway    built walkways and sidewalks
//  - bridleway  horse trails (walkable)
//  - steps      stairs / step runs
//  - cycleway   bike paths and rail-trails (walkable)
//  - pedestrian foot-only ways (area plazas are filtered out below)
// Public vehicle roads (residential/service/unclassified/…) are other highway
// classes and are deliberately not requested.
const HIGHWAY_FILTER =
  "^(track|path|footway|bridleway|steps|cycleway|pedestrian)$";

function overpassQuery(bounds: string): string {
  return (
    `[out:json][timeout:${OVERPASS_TIMEOUT_S}];` +
    `way["highway"~"${HIGHWAY_FILTER}"](${bounds});` +
    `out geom;`
  );
}

// POST the query to one endpoint with its own timeout, while still honoring the
// outer abort (a newer fetch superseding this one). Throws on non-2xx, timeout,
// or abort so the caller can fall through to the next mirror.
async function fetchOverpass(
  endpoint: string,
  body: string,
  outerSignal: AbortSignal,
): Promise<Response> {
  const controller = new AbortController();
  const relayAbort = () => controller.abort();
  outerSignal.addEventListener("abort", relayAbort);
  const timer = window.setTimeout(() => controller.abort(), PER_ENDPOINT_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body,
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Overpass ${response.status}`);
    return response;
  } finally {
    window.clearTimeout(timer);
    outerSignal.removeEventListener("abort", relayAbort);
  }
}

type OverpassElement = {
  type: string;
  id: number;
  tags?: Record<string, string>;
  geometry?: Array<{ lat: number; lon: number }>;
};

function classifyKind(highway: string | undefined): TrailKind {
  return highway === "track" ? "track" : "foot";
}

function kindNoun(kind: TrailKind, highway: string | undefined): string {
  if (kind === "track") return "Track / two-track road";
  if (highway === "bridleway") return "Bridleway";
  if (highway === "steps") return "Steps";
  if (highway === "footway") return "Footway";
  if (highway === "cycleway") return "Cycleway / rail-trail";
  return "Foot path";
}

function surfaceDetail(tags: Record<string, string>): string {
  const parts: string[] = [];
  if (tags.surface) parts.push(tags.surface.replace(/_/g, " "));
  if (tags.tracktype) parts.push(tags.tracktype);
  if (tags.sac_scale) parts.push(tags.sac_scale.replace(/_/g, " "));
  return parts.join(" · ");
}

function elementToTrail(el: OverpassElement): Trail | null {
  if (el.type !== "way" || !el.geometry || el.geometry.length < 2) return null;

  const tags = el.tags ?? {};
  // Squares/plazas mapped as filled areas aren't routes — skip so they don't
  // draw as a stray closed outline.
  if (tags.area === "yes") return null;
  const kind = classifyKind(tags.highway);
  const noun = kindNoun(kind, tags.highway);

  return {
    id: el.id,
    kind,
    label: tags.name ? tags.name : noun,
    detail: tags.name ? noun : surfaceDetail(tags),
    positions: el.geometry.map((point) => [point.lat, point.lon]),
  };
}

// A padded bbox string ("S,W,N,E") for Overpass, and a check for whether the
// current view is already inside the last fetched area so a small pan doesn't
// refire the query.
function padBounds(
  south: number,
  west: number,
  north: number,
  east: number,
): { query: string; south: number; west: number; north: number; east: number } {
  const latPad = (north - south) * 0.25;
  const lngPad = (east - west) * 0.25;
  const s = south - latPad;
  const w = west - lngPad;
  const n = north + latPad;
  const e = east + lngPad;

  return { query: `${s},${w},${n},${e}`, south: s, west: w, north: n, east: e };
}

export default function TrailsLayer({ enabled, onStatus }: TrailsLayerProps) {
  const map = useMap();
  const [trails, setTrails] = useState<Trail[]>([]);
  // Bumped on pan/zoom purely to re-run the on-screen cull below; the value
  // itself is never read.
  const [, forceCullRerun] = useState(0);

  const debounceRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // The padded bounds the current `trails` were fetched for. A view still inside
  // this box needs no new request.
  const fetchedBoxRef = useRef<{
    south: number;
    west: number;
    north: number;
    east: number;
  } | null>(null);

  const report = useCallback(
    (message: string | null) => {
      onStatus?.(message);
    },
    [onStatus],
  );

  const runFetch = useCallback(async () => {
    if (map.getZoom() < TRAILS_MIN_ZOOM) {
      fetchedBoxRef.current = null;
      setTrails([]);
      report("Zoom in to see walking trails and tracks.");
      return;
    }

    const bounds = map.getBounds();
    const box = fetchedBoxRef.current;
    if (
      box &&
      bounds.getSouth() >= box.south &&
      bounds.getWest() >= box.west &&
      bounds.getNorth() <= box.north &&
      bounds.getEast() <= box.east
    ) {
      // Still inside what we already have — leave it be.
      return;
    }

    const padded = padBounds(
      bounds.getSouth(),
      bounds.getWest(),
      bounds.getNorth(),
      bounds.getEast(),
    );

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // A fresh area (no prior box) starts clean; within-box pans keep the current
    // lines up while the next batch loads instead of flashing empty.
    if (fetchedBoxRef.current === null) setTrails([]);
    report("Finding trails…");

    const body = overpassQuery(padded.query);

    // Try each mirror in turn; the first that answers wins. Only after every one
    // has failed do we surface an error.
    for (let i = 0; i < TRAILS_OVERPASS_ENDPOINTS.length; i += 1) {
      if (controller.signal.aborted) return;

      try {
        const response = await fetchOverpass(
          TRAILS_OVERPASS_ENDPOINTS[i],
          body,
          controller.signal,
        );
        const data = (await response.json()) as { elements?: OverpassElement[] };
        const next = (data.elements ?? [])
          .map(elementToTrail)
          .filter((trail): trail is Trail => trail !== null);

        fetchedBoxRef.current = {
          south: padded.south,
          west: padded.west,
          north: padded.north,
          east: padded.east,
        };
        setTrails(next);
        report(next.length === 0 ? "No mapped trails in this view." : null);
        return;
      } catch {
        // Superseded by a newer fetch — stop silently, don't flag an error.
        if (controller.signal.aborted) return;
        // Otherwise this mirror failed/timed out; fall through to the next one.
      }
    }

    // Every mirror failed.
    fetchedBoxRef.current = null;
    report("Trails are unavailable right now — try again in a moment.");
  }, [map, report]);

  const queueFetch = useCallback(() => {
    if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null;
      void runFetch();
    }, DEBOUNCE_MS);
  }, [runFetch]);

  // Redraw on view change so we can drop in freshly-fetched paths.
  useMapEvents({
    moveend: () => {
      forceCullRerun((value) => value + 1);
      if (enabled) queueFetch();
    },
    zoomend: () => {
      forceCullRerun((value) => value + 1);
      if (enabled) queueFetch();
    },
  });

  useEffect(() => {
    if (!enabled) {
      abortRef.current?.abort();
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      // Drop the fetched-area marker so re-enabling refetches (and clears) for
      // wherever the map is now. The lines themselves stop rendering the moment
      // `enabled` is false, so there's no stale draw to clear here.
      fetchedBoxRef.current = null;
      report(null);
      return;
    }

    // Kick the first load off the effect's synchronous path (runFetch may reset
    // state before it awaits) so React isn't asked to re-render mid-effect.
    const startTimer = window.setTimeout(() => void runFetch(), 0);
    return () => window.clearTimeout(startTimer);
  }, [enabled, runFetch, report]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    };
  }, []);

  if (!enabled || trails.length === 0) return null;

  // Only draw what's on screen (+ a margin): the fetched box can be large, and
  // rendering thousands of offscreen polylines is what stalls mobile.
  const bounds = map.getBounds();
  const latMargin = (bounds.getNorth() - bounds.getSouth()) * 0.3;
  const lngMargin = (bounds.getEast() - bounds.getWest()) * 0.3;
  const viewSouth = bounds.getSouth() - latMargin;
  const viewNorth = bounds.getNorth() + latMargin;
  const viewWest = bounds.getWest() - lngMargin;
  const viewEast = bounds.getEast() + lngMargin;

  return (
    <>
      {trails.map((trail) => {
        const inView = trail.positions.some(
          ([lat, lng]) =>
            lat >= viewSouth &&
            lat <= viewNorth &&
            lng >= viewWest &&
            lng <= viewEast,
        );
        if (!inView) return null;

        const color = trail.kind === "track" ? TRACK_COLOR : FOOT_COLOR;
        const weight = trail.kind === "track" ? 3 : 2.4;
        const dashArray = trail.kind === "track" ? "10 6" : "2 6";

        return (
          <Fragment key={trail.id}>
            {/* Dark casing so a pale trail reads over bright fields/gravel. */}
            <Polyline
              positions={trail.positions}
              pathOptions={{
                color: CASING_COLOR,
                weight: weight + 2,
                opacity: 0.5,
                lineCap: "round",
              }}
              interactive={false}
            />
            <Polyline
              positions={trail.positions}
              pathOptions={{
                color,
                weight,
                opacity: 0.95,
                dashArray,
                lineCap: "round",
              }}
            >
              <Tooltip sticky direction="top" opacity={1}>
                <strong>{trail.label}</strong>
                {trail.detail ? (
                  <>
                    <br />
                    <span style={{ opacity: 0.75 }}>{trail.detail}</span>
                  </>
                ) : null}
              </Tooltip>
            </Polyline>
          </Fragment>
        );
      })}
    </>
  );
}
