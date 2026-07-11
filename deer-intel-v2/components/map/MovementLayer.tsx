"use client";

import { Fragment } from "react";
import { CircleMarker, Polyline } from "react-leaflet";
import {
  corridorDirection,
  type CorridorEvidence,
  type CorridorLevel,
  type MovementCorridor,
  type MovementPeriod,
} from "@/lib/movementPrediction";

type MovementLayerProps = {
  corridors: MovementCorridor[];
  period: MovementPeriod;
  /** Per-corridor camera evidence, keyed by corridor id. */
  evidenceById?: Record<string, CorridorEvidence>;
};

const CORRIDOR_COLOR = "#a855f7";
const CORRIDOR_HOT_COLOR = "#c084fc";

// Predicted bedding→food travel corridors. The line traces the link; a filled
// dot marks the end deer are heading toward this time of day (food at dusk,
// bedding at dawn). Midday/night have no strong pull, so the line reads two-way
// (dashed, no dot). Corridors backed by nearby camera hits at this period glow
// brighter (hot); quiet-camera corridors fade back (cold).
export default function MovementLayer({
  corridors,
  period,
  evidenceById,
}: MovementLayerProps) {
  if (corridors.length === 0) return null;

  const direction = corridorDirection(period);

  return (
    <>
      {corridors.map((corridor) => {
        const positions: Array<[number, number]> = [
          [corridor.bedding.lat, corridor.bedding.lng],
          [corridor.resource.lat, corridor.resource.lng],
        ];
        const destination =
          direction === "to-bedding"
            ? corridor.bedding
            : direction === "to-resource"
              ? corridor.resource
              : null;

        const level = evidenceById?.[corridor.id]?.level ?? "none";
        const style = corridorStyle(level, corridor.strength, direction);

        return (
          <Fragment key={corridor.id}>
            {level === "hot" ? (
              <Polyline
                positions={positions}
                pathOptions={{
                  color: CORRIDOR_HOT_COLOR,
                  weight: style.weight + 6,
                  opacity: 0.18,
                }}
                interactive={false}
              />
            ) : null}
            <Polyline
              positions={positions}
              pathOptions={{
                color: style.color,
                weight: style.weight,
                opacity: style.opacity,
                dashArray: style.dashArray,
              }}
              interactive={false}
            />
            {destination ? (
              <CircleMarker
                center={[destination.lat, destination.lng]}
                radius={style.dotRadius}
                pathOptions={{
                  color: style.color,
                  weight: 1.5,
                  opacity: level === "cold" ? 0.5 : 0.9,
                  fillColor: style.color,
                  fillOpacity: level === "cold" ? 0.4 : 0.85,
                }}
                interactive={false}
              />
            ) : null}
          </Fragment>
        );
      })}
    </>
  );
}

function corridorStyle(
  level: CorridorLevel,
  strength: number,
  direction: "to-resource" | "to-bedding" | "two-way",
) {
  const baseWeight = 2 + strength * 3;
  const baseOpacity = 0.5 + strength * 0.35;
  const twoWayDash = direction === "two-way" ? "6 7" : undefined;

  if (level === "hot") {
    return {
      color: CORRIDOR_HOT_COLOR,
      weight: baseWeight + 2.5,
      opacity: 0.95,
      dashArray: twoWayDash,
      dotRadius: 6 + strength * 4,
    };
  }
  if (level === "warm") {
    return {
      color: CORRIDOR_COLOR,
      weight: baseWeight + 1,
      opacity: Math.max(baseOpacity, 0.78),
      dashArray: twoWayDash,
      dotRadius: 5 + strength * 3,
    };
  }
  if (level === "cold") {
    return {
      color: CORRIDOR_COLOR,
      weight: baseWeight,
      opacity: 0.3,
      dashArray: "3 7",
      dotRadius: 4 + strength * 2,
    };
  }
  return {
    color: CORRIDOR_COLOR,
    weight: baseWeight,
    opacity: baseOpacity,
    dashArray: twoWayDash,
    dotRadius: 5 + strength * 3,
  };
}
