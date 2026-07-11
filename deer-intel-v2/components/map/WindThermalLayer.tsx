"use client";

import { useMemo } from "react";
import { Polygon } from "react-leaflet";
import type { StandWindStatus } from "@/lib/standWind";
import {
  scentConeOptionsForSpeed,
  scentConePolygon,
} from "@/lib/windViz";

export type WindStandPoint = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  /** How today's wind reads for this stand, when it maps to a saved stand. */
  status: StandWindStatus;
};

// Cone tint by how today's wind reads for the stand: green favors sitting it,
// red is a wrong wind that carries scent to the deer, amber is off/marginal.
// Neutral orange is the fallback when a cone can't be tied to a saved stand's
// best/avoid winds.
const CONE_COLORS: Record<StandWindStatus, string> = {
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

// A blaze-orange scent cone drifting down-wind from each stand — the ground a
// deer would wind you from on today's wind. The apex sits on the stand so it
// reads as "your scent, from here."
export default function WindThermalLayer({
  standPoints,
  windFromCompass,
  speedMph,
}: WindThermalLayerProps) {
  const cones = useMemo(() => {
    const options = scentConeOptionsForSpeed(speedMph);

    return standPoints
      .map((stand) => {
        const positions = scentConePolygon(
          { lat: stand.lat, lng: stand.lng },
          windFromCompass,
          options,
        );
        return positions
          ? { id: stand.id, positions, color: CONE_COLORS[stand.status] }
          : null;
      })
      .filter(
        (
          cone,
        ): cone is {
          id: string;
          positions: Array<[number, number]>;
          color: string;
        } => cone !== null,
      );
  }, [standPoints, windFromCompass, speedMph]);

  if (cones.length === 0) return null;

  return (
    <>
      {cones.map((cone) => (
        <Polygon
          key={`scent-${cone.id}`}
          positions={cone.positions}
          pathOptions={{
            color: cone.color,
            weight: 1,
            opacity: 0.75,
            fillColor: cone.color,
            fillOpacity: 0.18,
          }}
          interactive={false}
        />
      ))}
    </>
  );
}
