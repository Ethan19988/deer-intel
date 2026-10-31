"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { Polyline, Tooltip, useMap, useMapEvents } from "react-leaflet";
import { TRAILS_MIN_ZOOM } from "@/lib/propertyMap";
import {
  TRAILS_OFFLINE_SOURCE,
  fetchOsmTrails,
  fetchUsgsTrails,
  mergeTrails,
  overpassQuery,
  trailsFromSavedTiles,
  type Trail,
} from "@/lib/trailQuery";
import { matchOfflineQueryTiles } from "@/lib/offlineMaps";

type TrailsLayerProps = {
  enabled: boolean;
  /**
   * Bubbles a one-line status ("Zoom in…", "Finding trails…", "No mapped
   * trails…") up to the map's shared notice bar, or null when there's nothing
   * to say. Mirrors how the parcel layer reports its state.
   */
  onStatus?: (message: string | null) => void;
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
  // Trails an offline map pack saved for this view (empty when none).
  const savedRef = useRef<Trail[]>([]);
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
      savedRef.current = [];
      setTrails([]);
    }

    // Offline-first: trails a saved map pack holds for this view draw straight
    // from the device. When the pack covers the whole view there's nothing to
    // ask the network for — which is what makes the layer work with no signal.
    const viewBox = {
      south: bounds.getSouth(),
      west: bounds.getWest(),
      north: bounds.getNorth(),
      east: bounds.getEast(),
    };
    const saved = await matchOfflineQueryTiles(TRAILS_OFFLINE_SOURCE, viewBox);
    if (gen !== genRef.current || controller.signal.aborted) return;
    savedRef.current = trailsFromSavedTiles(saved.tiles);
    if (saved.complete) {
      osmRef.current = [];
      usgsRef.current = [];
      setTrails(savedRef.current);
      fetchedBoxRef.current = viewBox;
      report(savedRef.current.length === 0 ? "No mapped trails in this view." : null);
      return;
    }
    if (savedRef.current.length > 0) {
      setTrails(mergeTrails([savedRef.current, usgsRef.current, osmRef.current]));
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
      const merged = mergeTrails([usgsRef.current, osmRef.current, savedRef.current]);
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
        report(
          savedRef.current.length > 0
            ? "Showing saved trails — live trails are unavailable right now."
            : "Trails are unavailable right now — try again in a moment.",
        );
        return;
      }
      fetchedBoxRef.current = fetchBox;
      const total = usgsRef.current.length + osmRef.current.length + savedRef.current.length;
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
