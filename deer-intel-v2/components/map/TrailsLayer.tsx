"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { Polyline, Tooltip, useMap, useMapEvents } from "react-leaflet";
import {
  TRAILS_MIN_ZOOM,
  TRAILS_OVERPASS_ENDPOINTS,
  TRAILS_USGS_BASE,
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
  // Source-prefixed so OSM and USGS ids can't collide ("osm-123", "usgs-37-…").
  id: string;
  kind: TrailKind;
  label: string;
  detail: string;
  positions: Array<[number, number]>;
};

// A soft, faint brown for both — earthy and understated over satellite rather
// than a bright mark. Tracks run a shade darker than foot paths so the two are
// still tellable apart (helped by the dash pattern), and both stay clear of the
// blaze-orange used for pins/overlays.
const FOOT_COLOR = "#9c6b40";
const TRACK_COLOR = "#7f5530";
// A very light casing — just enough separation from bright ground to keep the
// faint line readable, without a dark outline making it look bold.
const CASING_COLOR = "rgba(28, 24, 18, 0.28)";

const DEBOUNCE_MS = 400;
const OVERPASS_TIMEOUT_S = 20;
// Give each request this long before we give up on it, so a slow/hung endpoint
// fails over quickly instead of stalling the layer.
const PER_REQUEST_TIMEOUT_MS = 8000;

// The USGS National Map transportation sublayers that are walk-in, non-public-
// vehicle ways. Merged with OSM to fill gaps (esp. on public land).
const USGS_TRAIL_LAYERS: Array<{ id: number; kind: TrailKind; noun: string }> = [
  { id: 37, kind: "foot", noun: "Trail" }, // Trails
  { id: 35, kind: "track", noun: "4WD road" }, // 4WD Roads
  { id: 36, kind: "track", noun: "Closed / gated road" }, // Closed Roads
];

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

// fetch() with its own timeout that still honors an outer abort (a newer fetch
// superseding this one). Throws on non-2xx, timeout, or abort.
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  outerSignal: AbortSignal,
): Promise<Response> {
  const controller = new AbortController();
  const relayAbort = () => controller.abort();
  outerSignal.addEventListener("abort", relayAbort);
  const timer = window.setTimeout(
    () => controller.abort(),
    PER_REQUEST_TIMEOUT_MS,
  );

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response;
  } finally {
    window.clearTimeout(timer);
    outerSignal.removeEventListener("abort", relayAbort);
  }
}

// --- OpenStreetMap (Overpass) source ---------------------------------------

type OverpassElement = {
  type: string;
  id: number;
  tags?: Record<string, string>;
  geometry?: Array<{ lat: number; lon: number }>;
};

function osmKind(highway: string | undefined): TrailKind {
  return highway === "track" ? "track" : "foot";
}

function osmNoun(kind: TrailKind, highway: string | undefined): string {
  if (kind === "track") return "Track / two-track road";
  if (highway === "bridleway") return "Bridleway";
  if (highway === "steps") return "Steps";
  if (highway === "footway") return "Footway";
  if (highway === "cycleway") return "Cycleway / rail-trail";
  return "Foot path";
}

function osmSurfaceDetail(tags: Record<string, string>): string {
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
  const kind = osmKind(tags.highway);
  const noun = osmNoun(kind, tags.highway);

  return {
    id: `osm-${el.id}`,
    kind,
    label: tags.name ? tags.name : noun,
    detail: tags.name ? noun : osmSurfaceDetail(tags),
    positions: el.geometry.map((point) => [point.lat, point.lon]),
  };
}

// Try each Overpass mirror in turn; the first that answers wins. Throws only if
// every mirror fails (so the caller can still fall back to the USGS source).
async function fetchOsmTrails(
  overpassBody: string,
  signal: AbortSignal,
): Promise<Trail[]> {
  let lastError: unknown;

  for (const endpoint of TRAILS_OVERPASS_ENDPOINTS) {
    if (signal.aborted) throw new DOMException("aborted", "AbortError");
    try {
      const response = await fetchWithTimeout(
        endpoint,
        {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=UTF-8" },
          body: overpassBody,
        },
        signal,
      );
      const data = (await response.json()) as { elements?: OverpassElement[] };
      return (data.elements ?? [])
        .map(elementToTrail)
        .filter((trail): trail is Trail => trail !== null);
    } catch (error) {
      if (signal.aborted) throw error;
      lastError = error; // this mirror failed; try the next
    }
  }

  throw lastError ?? new Error("all Overpass mirrors failed");
}

// --- USGS National Map source ----------------------------------------------

type GeoJsonLine = {
  type: "LineString" | "MultiLineString" | string;
  coordinates: number[][] | number[][][];
};

type UsgsFeature = {
  geometry?: GeoJsonLine | null;
  properties?: Record<string, unknown> | null;
};

function asString(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function usgsFeatureToTrails(
  feature: UsgsFeature,
  layer: { id: number; kind: TrailKind; noun: string },
): Trail[] {
  const geometry = feature.geometry;
  if (!geometry) return [];

  const props = feature.properties ?? {};
  const oid =
    (props.objectid as number | undefined) ??
    (props.OBJECTID as number | undefined) ??
    0;
  const name = asString(props.name) || asString(props.maplabel);
  const surface = asString(props.trailsurface);
  const type = asString(props.trailtype);
  const label = name || layer.noun;
  const detail = name
    ? layer.noun
    : [surface, type].filter(Boolean).join(" · ");

  // Normalize LineString and MultiLineString to a list of coordinate rings.
  const rings: number[][][] =
    geometry.type === "LineString"
      ? [geometry.coordinates as number[][]]
      : geometry.type === "MultiLineString"
        ? (geometry.coordinates as number[][][])
        : [];

  return rings
    .map((ring, index) => ({
      id: `usgs-${layer.id}-${oid}-${index}`,
      kind: layer.kind,
      label,
      detail,
      positions: ring
        .filter((c) => Array.isArray(c) && c.length >= 2)
        .map((c) => [c[1], c[0]] as [number, number]),
    }))
    .filter((trail) => trail.positions.length >= 2);
}

// Best-effort: each layer is queried independently and a failing one simply
// contributes nothing, so USGS never breaks the OSM result.
async function fetchUsgsTrails(
  envelope: string,
  signal: AbortSignal,
): Promise<Trail[]> {
  const perLayer = await Promise.all(
    USGS_TRAIL_LAYERS.map(async (layer) => {
      const url =
        `${TRAILS_USGS_BASE}/${layer.id}/query?` +
        `geometry=${envelope}&geometryType=esriGeometryEnvelope&inSR=4326` +
        `&outSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*` +
        `&returnGeometry=true&f=geojson`;
      try {
        const response = await fetchWithTimeout(url, { method: "GET" }, signal);
        const data = (await response.json()) as { features?: UsgsFeature[] };
        return (data.features ?? []).flatMap((feature) =>
          usgsFeatureToTrails(feature, layer),
        );
      } catch {
        return [] as Trail[];
      }
    }),
  );

  return perLayer.flat();
}

// A padded bbox for both sources: an Overpass "S,W,N,E" string and the same box
// as numbers, so a small pan doesn't refire the query.
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
  // Each source's latest results are held separately so we can paint whichever
  // one lands first (USGS is usually quick; Overpass can be slow) instead of
  // waiting on the slower one. A generation counter drops stale async results.
  const genRef = useRef(0);
  const osmRef = useRef<Trail[]>([]);
  const usgsRef = useRef<Trail[]>([]);
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
    const gen = (genRef.current += 1);

    // A fresh area (no prior box) starts clean; within-box pans keep the current
    // lines up while the next batch loads instead of flashing empty.
    if (fetchedBoxRef.current === null) {
      osmRef.current = [];
      usgsRef.current = [];
      setTrails([]);
    }
    report("Finding trails…");

    const overpassBody = overpassQuery(padded.query);
    // ArcGIS envelope is xmin,ymin,xmax,ymax = W,S,E,N.
    const envelope = `${padded.west},${padded.south},${padded.east},${padded.north}`;
    const fetchBox = {
      south: padded.south,
      west: padded.west,
      north: padded.north,
      east: padded.east,
    };

    // Paint whatever's arrived so far; drop the "finding" note once anything is
    // on the map.
    const paint = () => {
      if (gen !== genRef.current || controller.signal.aborted) return;
      const merged = [...usgsRef.current, ...osmRef.current];
      setTrails(merged);
      if (merged.length > 0) report(null);
    };

    // Once BOTH sources have settled, record the fetched box and give a final
    // read (nothing found, or nothing reachable).
    let osmSettled = false;
    let usgsSettled = false;
    let osmOk = false;
    let usgsOk = false;
    const settle = () => {
      if (gen !== genRef.current || controller.signal.aborted) return;
      if (!osmSettled || !usgsSettled) return;
      if (!osmOk && !usgsOk) {
        fetchedBoxRef.current = null;
        report("Trails are unavailable right now — try again in a moment.");
        return;
      }
      fetchedBoxRef.current = fetchBox;
      const total = usgsRef.current.length + osmRef.current.length;
      if (total === 0) report("No mapped trails in this view.");
    };

    // Fire both independently so the slower one (usually Overpass) never holds
    // up drawing the faster one. USGS is the richer source on hunting ground.
    void fetchUsgsTrails(envelope, controller.signal)
      .then((list) => {
        if (gen !== genRef.current) return;
        usgsRef.current = list;
        usgsOk = true;
        paint();
      })
      .catch(() => {})
      .finally(() => {
        usgsSettled = true;
        settle();
      });

    void fetchOsmTrails(overpassBody, controller.signal)
      .then((list) => {
        if (gen !== genRef.current) return;
        osmRef.current = list;
        osmOk = true;
        paint();
      })
      .catch(() => {})
      .finally(() => {
        osmSettled = true;
        settle();
      });
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
        const weight = trail.kind === "track" ? 3.4 : 2.8;
        const dashArray = trail.kind === "track" ? "10 6" : "2 6";

        return (
          <Fragment key={trail.id}>
            {/* Light casing — a soft edge so a pale trail still reads over
                bright fields/gravel, kept thin and faint so it's noticeable
                but not a bold outline. */}
            <Polyline
              positions={trail.positions}
              pathOptions={{
                color: CASING_COLOR,
                weight: weight + 1.2,
                opacity: 0.24,
                lineCap: "round",
              }}
              interactive={false}
            />
            <Polyline
              positions={trail.positions}
              pathOptions={{
                color,
                weight,
                opacity: 0.75,
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
