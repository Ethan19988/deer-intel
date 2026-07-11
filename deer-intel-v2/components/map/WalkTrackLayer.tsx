"use client";

import { Fragment, useMemo } from "react";
import { divIcon } from "leaflet";
import { Marker, Polyline } from "react-leaflet";
import type { WalkTrack, WalkTrackPoint } from "@/types/walkTrack";

// Draws recorded walk trails on the map: the property's saved trails as calm
// orange lines, plus the one being recorded right now as a brighter, live line
// with a pulsing head at the hunter's current position. A dark casing under each
// line keeps it legible over bright satellite imagery.

const TRACK_COLOR = "#ff8a1f";
const ACTIVE_TRACK_COLOR = "#ffb300";
const CASING_COLOR = "rgba(10, 15, 10, 0.55)";

function toLatLngs(points: WalkTrackPoint[]): [number, number][] {
  return points.map((point) => [point.lat, point.lng]);
}

function endpointIcon(kind: "start" | "end" | "live") {
  return divIcon({
    className: "di-walk-endpoint-icon",
    html: `<span class="di-walk-endpoint di-walk-endpoint--${kind}"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

export default function WalkTrackLayer({
  tracks,
  activePoints,
  isTracking,
}: {
  tracks: WalkTrack[];
  activePoints: WalkTrackPoint[];
  isTracking: boolean;
}) {
  const startIcon = useMemo(() => endpointIcon("start"), []);
  const endIcon = useMemo(() => endpointIcon("end"), []);
  const liveIcon = useMemo(() => endpointIcon("live"), []);

  const activeLatLngs = toLatLngs(activePoints);
  const liveHead = activePoints[activePoints.length - 1];

  return (
    <>
      {tracks.map((track) => {
        const latLngs = toLatLngs(track.points);
        const start = track.points[0];
        const end = track.points[track.points.length - 1];

        return (
          <Fragment key={track.id}>
            <Polyline
              positions={latLngs}
              pathOptions={{ color: CASING_COLOR, weight: 7, opacity: 0.9 }}
              interactive={false}
            />
            <Polyline
              positions={latLngs}
              pathOptions={{ color: TRACK_COLOR, weight: 3.5, opacity: 0.95 }}
              interactive={false}
            />
            {start ? (
              <Marker
                position={[start.lat, start.lng]}
                icon={startIcon}
                interactive={false}
                keyboard={false}
              />
            ) : null}
            {end ? (
              <Marker
                position={[end.lat, end.lng]}
                icon={endIcon}
                interactive={false}
                keyboard={false}
              />
            ) : null}
          </Fragment>
        );
      })}

      {isTracking && activeLatLngs.length >= 2 ? (
        <>
          <Polyline
            positions={activeLatLngs}
            pathOptions={{ color: CASING_COLOR, weight: 8, opacity: 0.9 }}
            interactive={false}
          />
          <Polyline
            positions={activeLatLngs}
            pathOptions={{ color: ACTIVE_TRACK_COLOR, weight: 4, opacity: 1 }}
            interactive={false}
          />
        </>
      ) : null}

      {isTracking && liveHead ? (
        <Marker
          position={[liveHead.lat, liveHead.lng]}
          icon={liveIcon}
          interactive={false}
          keyboard={false}
          zIndexOffset={1100}
        />
      ) : null}
    </>
  );
}
