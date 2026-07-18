"use client";

import { useMemo } from "react";
import { CircleMarker, Popup } from "react-leaflet";
import { useDeerIntelStore } from "@/lib/deerIntelStore";
import { aggregateCameraActivity } from "@/lib/terrainLearning";

// A heat map of where deer actually are, learned from the hunter's own cameras:
// each located camera is drawn as a circle sized + coloured by how much deer
// activity it has logged (bucks weighted double). Graduated symbols, not a
// smoothed raster — activity is real at the camera and unknown between them, so
// interpolating would lie. Reads local data; pairs with the terrain prediction.
export default function CameraHeatLayer() {
  const state = useDeerIntelStore();

  const cams = useMemo(() => {
    return aggregateCameraActivity(state.cameras, state.cameraChecks)
      .map((c) => ({ ...c, activity: c.bucks * 2 + c.does + c.fawns }))
      .filter((c) => c.activity > 0)
      .sort((a, b) => a.activity - b.activity); // hottest drawn last (on top)
  }, [state.cameras, state.cameraChecks]);

  if (!cams.length) return null;
  const max = Math.max(...cams.map((c) => c.activity));

  return (
    <>
      {cams.map((c) => {
        const t = max > 0 ? c.activity / max : 0;
        const radius = 9 + 22 * Math.sqrt(t); // area ~ activity
        const color = heatColor(t);
        return (
          <CircleMarker
            key={`${c.name}-${c.lat}-${c.lng}`}
            center={[c.lat, c.lng]}
            radius={radius}
            pathOptions={{
              color,
              fillColor: color,
              weight: 1.5,
              opacity: 0.9,
              fillOpacity: 0.4,
            }}
          >
            <Popup>
              <div style={{ fontSize: 13, lineHeight: 1.4 }}>
                <strong>{c.name}</strong>
                <div>
                  {c.bucks} bucks · {c.does} does · {c.fawns} fawns
                </div>
                <div style={{ color: "#555" }}>
                  {c.bucks + c.does + c.fawns} deer logged
                  {c.lastMs
                    ? ` · last ${new Date(c.lastMs).toLocaleDateString()}`
                    : ""}
                </div>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
}

// Cold-to-hot ramp: amber (light activity) → orange → red (hottest).
function heatColor(t: number): string {
  const stops = [
    [242, 193, 78], // #f2c14e
    [239, 122, 36], // #ef7a24
    [209, 53, 43], // #d1352b
  ];
  const x = Math.min(1, Math.max(0, t)) * (stops.length - 1);
  const i = Math.floor(x);
  const f = x - i;
  const a = stops[i];
  const b = stops[Math.min(i + 1, stops.length - 1)];
  const rgb = a.map((v, k) => Math.round(v + (b[k] - v) * f));
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}
