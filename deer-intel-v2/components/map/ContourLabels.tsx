"use client";

// Elevation numbers rendered as our own map labels instead of baked into the
// USGS contour raster. The raster welds the numbers onto the index contour
// lines, so recoloring it can't give white lines AND legible numbers (white
// numbers blob, colored numbers tint the lines). Here the contour *lines* stay
// white from the raster layers, and the *numbers* come from the queryable
// index-contour features — crisp bold text we fully control (size, weight,
// outline), and always readable.
//
// Offline-first: when a saved map pack holds this view's contour tiles, the
// numbers come straight from the device and no query is made.

import { useCallback, useEffect, useRef, useState } from "react";
import { Marker, useMap, useMapEvents } from "react-leaflet";
import { divIcon } from "leaflet";
import {
  CONTOUR_LABELS_OFFLINE_SOURCE,
  fetchContourSegments,
  pickContourLabels,
  segmentsFromSavedTiles,
  type ContourLabel,
} from "@/lib/contourQuery";
import { matchOfflineQueryTiles } from "@/lib/offlineMaps";

export default function ContourLabels({ minZoom }: { minZoom: number }) {
  const map = useMap();
  const [labels, setLabels] = useState<ContourLabel[]>([]);
  const reqId = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (map.getZoom() < minZoom) {
      setLabels([]);
      return;
    }
    const b = map.getBounds();
    const view = {
      south: b.getSouth(),
      west: b.getWest(),
      north: b.getNorth(),
      east: b.getEast(),
    };
    const mine = ++reqId.current;
    try {
      const saved = await matchOfflineQueryTiles(CONTOUR_LABELS_OFFLINE_SOURCE, view);
      if (mine !== reqId.current) return;
      let segments = segmentsFromSavedTiles(saved.tiles);
      if (!saved.complete) {
        try {
          // Generalize the geometry hard — we only need points to place labels on.
          const offset = (view.east - view.west) / 120;
          segments = await fetchContourSegments(view, offset);
        } catch (error) {
          // No signal: a partly saved view still shows what it has.
          if (segments.length === 0) throw error;
        }
        if (mine !== reqId.current) return; // a newer request superseded this one
      }
      setLabels(pickContourLabels(segments, view));
    } catch {
      // Network/parse failure: keep whatever is shown, never break the map.
    }
  }, [map, minZoom]);

  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(load, 250);
  }, [load]);

  useMapEvents({ moveend: schedule, zoomend: schedule });
  useEffect(() => {
    schedule();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [schedule]);

  return (
    <>
      {labels.map((l) => (
        <Marker
          key={l.id}
          position={[l.lat, l.lng]}
          interactive={false}
          icon={divIcon({
            className: "di-contour-vlabel",
            html: `<span>${l.text}</span>`,
            iconSize: [0, 0],
          })}
        />
      ))}
    </>
  );
}
