"use client";

// Elevation numbers rendered as our own map labels instead of baked into the
// USGS contour raster. The raster welds the numbers onto the index contour
// lines, so recoloring it can't give white lines AND legible numbers (white
// numbers blob, colored numbers tint the lines). Here the contour *lines* stay
// white from the raster layers, and the *numbers* come from the queryable
// index-contour features — crisp bold text we fully control (size, weight,
// outline), and always readable.

import { useCallback, useEffect, useRef, useState } from "react";
import { Marker, useMap, useMapEvents } from "react-leaflet";
import { divIcon } from "leaflet";

const SERVICE =
  "https://carto.nationalmap.gov/arcgis/rest/services/contours/MapServer";
// Index-contour feature layers that carry CONTOURELEVATION: 100-ft (11) + 50-ft (16).
const LAYERS = [11, 16];
const MAX_LABELS = 48;

type ContourLabel = { id: string; lat: number; lng: number; text: string };

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
    const bbox = `${b.getWest()},${b.getSouth()},${b.getEast()},${b.getNorth()}`;
    // Generalize the geometry hard — we only need points to place labels on.
    const offset = (b.getEast() - b.getWest()) / 120;
    const mine = ++reqId.current;
    try {
      const segments: { elev: number; pts: [number, number][] }[] = [];
      await Promise.all(
        LAYERS.map(async (layer) => {
          const url =
            `${SERVICE}/${layer}/query?where=1%3D1` +
            `&geometry=${encodeURIComponent(bbox)}` +
            `&geometryType=esriGeometryEnvelope&inSR=4326` +
            `&spatialRel=esriSpatialRelIntersects&outFields=CONTOURELEVATION` +
            `&returnGeometry=true&maxAllowableOffset=${offset}` +
            `&outSR=4326&f=json&resultRecordCount=250`;
          const res = await fetch(url);
          const json = await res.json();
          for (const f of json.features ?? []) {
            const elev = f.attributes?.CONTOURELEVATION;
            const paths = f.geometry?.paths;
            if (typeof elev !== "number" || !Array.isArray(paths)) continue;
            for (const path of paths) segments.push({ elev, pts: path });
          }
        }),
      );
      if (mine !== reqId.current) return; // a newer request superseded this one

      // Thin the labels onto a ~9x9 grid of the view so they spread evenly and
      // never pile up (grid in degrees; close enough to even pixel spacing).
      const cellLat = (b.getNorth() - b.getSouth()) / 9;
      const cellLng = (b.getEast() - b.getWest()) / 9;
      const seen = new Set<string>();
      const next: ContourLabel[] = [];
      for (const seg of segments) {
        for (const [lng, lat] of seg.pts) {
          if (
            lat < b.getSouth() ||
            lat > b.getNorth() ||
            lng < b.getWest() ||
            lng > b.getEast()
          )
            continue;
          const key = `${Math.round(lat / cellLat)}_${Math.round(lng / cellLng)}`;
          if (seen.has(key)) continue;
          seen.add(key);
          next.push({ id: `${seg.elev}-${key}`, lat, lng, text: `${seg.elev}` });
          if (next.length >= MAX_LABELS) break;
        }
        if (next.length >= MAX_LABELS) break;
      }
      setLabels(next);
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
