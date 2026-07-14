"use client";

import { useMemo } from "react";
import { Polygon } from "react-leaflet";
import type { StandWindStatus } from "@/lib/standWind";
import {
  scentConeOptionsForSpeed,
  windArrowPolygon,
} from "@/lib/windViz";

export type WindStandPoint = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  /** How today's wind reads for this stand, when it maps to a saved stand. */
  status: StandWindStatus;
};

// Arrow tint by how today's wind reads for the stand: green favors sitting it,
// red is a wrong wind that carries scent to the deer, amber is off/marginal.
// Neutral orange is the fallback when a stand pin isn't tied to a saved stand's
// best/avoid winds.
const ARROW_COLORS: Record<StandWindStatus, string> = {
  good: "#3fb950",
  avoid: "#ef4444",
  marginal: "#f5b301",
  unknown: "#f97316",
};

type WindThermalLayerProps = {
  standPoints: WindStandPoint[];
  windFromCompass: string;
  speedMph: number | null;
};

// An arrow at each stand pointing the way the wind blows — the direction your
// scent carries on today's wind. The tail sits on the stand, so it reads as
// "your scent leaves here, headed that way."
export default function WindThermalLayer({
  standPoints,
  windFromCompass,
  speedMph,
}: WindThermalLayerProps) {
  const arrows = useMemo(() => {
    const options = scentConeOptionsForSpeed(speedMph);

    return standPoints
      .map((stand) => {
        const positions = windArrowPolygon(
          { lat: stand.lat, lng: stand.lng },
          windFromCompass,
          options,
        );
        return positions
          ? { id: stand.id, positions, color: ARROW_COLORS[stand.status] }
          : null;
      })
      .filter(
        (
          arrow,
        ): arrow is {
          id: string;
          positions: Array<[number, number]>;
          color: string;
        } => arrow !== null,
      );
  }, [standPoints, windFromCompass, speedMph]);

  if (arrows.length === 0) return null;

  return (
    <>
      {arrows.map((arrow) => (
        <Polygon
          key={`wind-${arrow.id}`}
          positions={arrow.positions}
          pathOptions={{
            color: arrow.color,
            weight: 1.5,
            opacity: 0.95,
            fillColor: arrow.color,
            fillOpacity: 0.55,
          }}
          interactive={false}
        />
      ))}
    </>
  );
}
